import { getRoom, updateRoom, Room } from '@/lib/roomStore'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import Groq from 'groq-sdk'

const anthropic = new Anthropic()

function getGroq() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY! })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const body = await req.json().catch(() => ({}))
  const side = String(body.side ?? '').toUpperCase()
  const content = String(body.content ?? '').trim()

  if (side !== 'A' && side !== 'B') {
    return NextResponse.json({ error: 'side는 A 또는 B여야 해요' }, { status: 400 })
  }
  if (!content) {
    return NextResponse.json({ error: '이야기를 입력해주세요' }, { status: 400 })
  }
  if (content.length > 500) {
    return NextResponse.json({ error: '500자를 초과할 수 없어요' }, { status: 400 })
  }

  const room = await getRoom(code)
  if (!room) return NextResponse.json({ error: '방을 찾을 수 없어요' }, { status: 404 })

  if (side === 'A' && room.submissionA) {
    return NextResponse.json({ error: '이미 제출했어요' }, { status: 400 })
  }
  if (side === 'B' && room.submissionB) {
    return NextResponse.json({ error: '이미 제출했어요' }, { status: 400 })
  }

  const update = side === 'A' ? { submissionA: content } : { submissionB: content }
  const updated = await updateRoom(code, update)
  if (!updated) return NextResponse.json({ error: '제출 처리 중 오류가 발생했어요' }, { status: 500 })

  const bothSubmitted = !!(updated.submissionA && updated.submissionB)

  if (bothSubmitted) {
    await updateRoom(code, { status: 'analyzing' })
    void analyzeAndDecide(
      code,
      updated.nicknameA,
      updated.nicknameB!,
      updated.submissionA!,
      updated.submissionB!,
      updated.judge,
    )
  }

  return NextResponse.json({ success: true, analyzing: bothSubmitted })
}

// ── AI 호출 헬퍼 ───────────────────────────────────────────────
async function callAI(prompt: string, judge: string): Promise<string> {
  try {
    if (judge === 'claude') {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      })
      return msg.content[0].type === 'text' ? msg.content[0].text : ''
    } else {
      // groq (기본)
      const completion = await getGroq().chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2048,
      })
      return completion.choices[0]?.message?.content ?? ''
    }
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string; error?: { type?: string; message?: string } }
    console.error(`[${judge} API 오류]`, {
      status: err.status,
      message: err.error?.message ?? err.message,
    })
    throw e
  }
}

// 3회 순차 심의 — 병렬 호출 시 rate limit 위험으로 순차 처리
async function deliberate(prompt: string, finalPrompt: (opinions: string[]) => string, judge: string): Promise<string> {
  const opinions: string[] = []

  for (let i = 0; i < 3; i++) {
    try {
      opinions.push(await callAI(prompt, judge))
    } catch (e) {
      console.warn(`[${i + 1}차 심의 실패]`, e)
    }
  }

  if (opinions.length === 0) throw new Error('모든 심의 실패')
  if (opinions.length === 1) return opinions[0]

  const clarifyCount = opinions.filter(t => t.includes('[재제출 필요]')).length
  if (clarifyCount >= 1) {
    return opinions.find(t => t.includes('[재제출 필요]'))!
  }

  const aVotes = opinions.filter(t => t.includes('[승자: A]')).length
  const bVotes = opinions.filter(t => t.includes('[승자: B]')).length

  // 만장일치면 첫 결과 반환
  if (aVotes === opinions.length || bVotes === opinions.length) return opinions[0]

  // 의견 갈림 → 종합 판결 호출
  return callAI(finalPrompt(opinions), judge)
}

export async function analyzeAndDecide(
  code: string,
  nicknameA: string,
  nicknameB: string,
  subA: string,
  subB: string,
  judge = 'gemini',
) {
  const MIN_MS = 8000
  const start = Date.now()

  const applyResult = async (text: string) => {
    const elapsed = Date.now() - start
    if (elapsed < MIN_MS) await new Promise(r => setTimeout(r, MIN_MS - elapsed))

    if (text.includes('[재제출 필요]')) {
      const qA = extractBetween(text, '[A질문]:', '[B질문]:') ?? '이 상황에서 어떤 부분이 가장 중요했나요? 구체적으로 설명해주세요.'
      const qB = extractAfter(text, '[B질문]:') ?? '상대방의 입장에서 이해하기 어려운 부분이 있었나요? 설명해주세요.'
      await updateRoom(code, { status: 'clarifying', clarificationA: qA.trim(), clarificationB: qB.trim() })
    } else {
      const winner = text.includes('[승자: B]') ? 'B' : 'A'
      const cleanText = text.replace(/\[승자: (A|B)\]/g, '').trim()
      await updateRoom(code, { status: 'verdict', verdictText: cleanText, winner })
    }
  }

  try {
    const prompt = buildInitialPrompt(nicknameA, nicknameB, subA, subB)
    const text = await deliberate(prompt, (ops) => buildSynthesisPrompt(ops, nicknameA, nicknameB), judge)
    await applyResult(text)
  } catch (e) {
    console.error('[AI 1차 분석 오류]', e)
    try {
      const text = await callAI(buildInitialPrompt(nicknameA, nicknameB, subA, subB), judge)
      await applyResult(text)
    } catch (e2) {
      console.error('[AI 단순 판결도 실패]', e2)
      const elapsed = Date.now() - start
      if (elapsed < MIN_MS) await new Promise(r => setTimeout(r, MIN_MS - elapsed))
      await updateRoom(code, { status: 'failed' })
    }
  }
}

// 2차 최종 판결 (clarification 이후) — 3회 심의
export async function requestFinalVerdict(
  code: string,
  nicknameA: string,
  nicknameB: string,
  subA: string,
  subB: string,
  clarQuestionA: string,
  clarQuestionB: string,
  resubA: string,
  resubB: string,
  judge = 'gemini',
) {
  const MIN_MS = 8000
  const start = Date.now()

  const saveVerdict = async (text: string) => {
    const elapsed = Date.now() - start
    if (elapsed < MIN_MS) await new Promise(r => setTimeout(r, MIN_MS - elapsed))
    const winner = text.includes('[승자: B]') ? 'B' : 'A'
    const cleanText = text.replace(/\[승자: (A|B)\]/g, '').trim()
    await updateRoom(code, { status: 'verdict', verdictText: cleanText, winner })
  }

  try {
    const prompt = buildFinalPrompt(nicknameA, nicknameB, subA, subB, clarQuestionA, clarQuestionB, resubA, resubB)
    const text = await deliberate(prompt, (ops) => buildSynthesisPrompt(ops, nicknameA, nicknameB), judge)
    await saveVerdict(text)
  } catch (e) {
    console.error('[AI 최종 판결 오류]', e)
    try {
      const text = await callAI(buildFinalPrompt(nicknameA, nicknameB, subA, subB, clarQuestionA, clarQuestionB, resubA, resubB), judge)
      await saveVerdict(text)
    } catch (e2) {
      console.error('[AI 최종 판결 단순 시도도 실패]', e2)
      const elapsed = Date.now() - start
      if (elapsed < MIN_MS) await new Promise(r => setTimeout(r, MIN_MS - elapsed))
      await updateRoom(code, { status: 'failed' })
    }
  }
}

function extractBetween(text: string, startTag: string, endTag: string): string | null {
  const start = text.indexOf(startTag)
  const end = text.indexOf(endTag)
  if (start === -1 || end === -1 || end <= start) return null
  return text.slice(start + startTag.length, end)
}

function extractAfter(text: string, startTag: string): string | null {
  const start = text.indexOf(startTag)
  if (start === -1) return null
  const after = text.slice(start + startTag.length)
  // 다음 [태그] 전까지만
  const nextTag = after.indexOf('[')
  return nextTag === -1 ? after : after.slice(0, nextTag)
}

function buildInitialPrompt(nicknameA: string, nicknameB: string, subA: string, subB: string): string {
  return `당신은 "결이"입니다. 사람들 사이의 갈등을 신중하고 따뜻하게 중재하는 AI예요.

먼저 아래 **재제출 필요 조건**을 확인하세요. 하나라도 해당하면 반드시 재제출을 요청해야 합니다.

---

**[재제출 필요 조건 — 반드시 먼저 체크]**

다음 중 하나라도 해당하면 판결하지 말고 반드시 [재제출 필요]를 출력하세요:

1. **사실 충돌**: A와 B가 같은 사건에 대해 서로 다른 사실을 주장하는 경우
   - 예: A는 "10만원을 빌렸다"고 하는데 B는 "20만원을 빌렸다"고 하는 경우
   - 예: A는 "6시에 만나기로 했다"는데 B는 "6시 30분으로 알았다"고 하는 경우
   - 예: A는 "확정된 약속이었다"는데 B는 "검토 중이었다"고 하는 경우

2. **핵심 전제 부정**: B가 A 이야기의 핵심 전제 자체를 부정하거나, A가 B 이야기의 핵심 전제를 부정하는 경우

3. **중요 경위 한쪽만 언급**: 판결에 결정적인 맥락(약속, 합의, 발언)을 한쪽만 주장하고 상대방은 전혀 언급하지 않은 경우

---

**[판결 가능 조건]**

두 사람이 같은 사실 관계를 인정하고, 그 해석이나 감정·대응 방식에서 의견이 다른 경우에만 판결할 수 있습니다.

---

---

[${nicknameA}의 이야기 (A 측)]
${subA}

[${nicknameB}의 이야기 (B 측)]
${subB}

---

**논점이 어긋난 경우** — 아래 형식으로만 출력하세요:

[재제출 필요]
[A질문]: (${nicknameA}에게 물어볼 구체적 질문. 상대방 ${nicknameB}의 주장 중 A가 언급하지 않은 핵심 부분을 짚어주세요.)
[B질문]: (${nicknameB}에게 물어볼 구체적 질문. 상대방 ${nicknameA}의 주장 중 B가 언급하지 않은 핵심 부분을 짚어주세요.)

**논점이 맞닿은 경우** — 아래 판결 형식으로 출력하세요:

## 결이의 판결

**갈등 성격**
(이 갈등이 감정·관계형인지 사실·행동형인지 한 문장으로)

**${nicknameA}의 입장 검토**
(주장의 합리성, 일관성, 아쉬운 점 2~3문장)

**${nicknameB}의 입장 검토**
(주장의 합리성, 일관성, 아쉬운 점 2~3문장)

**결이의 비교 분석**
(두 입장을 비교. 감정형이면 어느 방향성이 관계에 더 좋은지, 사실형이면 누가 더 신빙성·일관성이 있는지 3~4문장)

**결이의 판결**
(누구의 손을 들어주는지 명확히. 이유 포함. 지는 쪽이 어느 부분에서 더 명확했어야 했는지도 언급)

**결이의 한마디**
(이기는 쪽 격려, 지는 쪽 위로 + 두 사람 관계를 위한 따뜻한 조언 2~3문장)

마지막 줄에 반드시 아래 둘 중 하나만 (다른 내용 없이):
[승자: A]
[승자: B]`
}

function buildFinalPrompt(
  nicknameA: string, nicknameB: string,
  subA: string, subB: string,
  questionA: string, questionB: string,
  resubA: string, resubB: string,
): string {
  return `당신은 "결이"입니다. 사람들 사이의 갈등을 신중하고 따뜻하게 중재하는 AI예요.

이 갈등은 처음 제출 후 양측에 추가 질문을 했고, 이제 모든 이야기가 모였어요.
이번엔 반드시 A 또는 B 중 한 명의 손을 들어주는 최종 판결을 내려야 해요.

---

[${nicknameA}의 처음 이야기 (A 측)]
${subA}

[결이의 질문에 대한 ${nicknameA}의 추가 답변]
질문: ${questionA}
답변: ${resubA}

---

[${nicknameB}의 처음 이야기 (B 측)]
${subB}

[결이의 질문에 대한 ${nicknameB}의 추가 답변]
질문: ${questionB}
답변: ${resubB}

---

아래 형식으로 최종 판결을 작성해주세요:

## 결이의 최종 판결

**갈등 성격**
(이 갈등이 감정·관계형인지 사실·행동형인지 한 문장으로)

**${nicknameA}의 입장 종합 검토**
(처음 이야기와 추가 답변을 합쳐서 2~3문장)

**${nicknameB}의 입장 종합 검토**
(처음 이야기와 추가 답변을 합쳐서 2~3문장)

**결이의 최종 분석**
(모든 정보를 종합한 비교 분석. 단 0.1%라도 더 합리적인 쪽을 판단. 3~4문장)

**결이의 판결**
(최종 판결. 누가 더 합리적이었는지, 왜 그쪽의 손을 드는지 명확하게)

**결이의 한마디**
(이기는 쪽 격려, 지는 쪽 위로 + 두 사람이 앞으로 더 잘 지낼 수 있는 조언 2~3문장)

마지막 줄에 반드시 아래 둘 중 하나만 (다른 내용 없이):
[승자: A]
[승자: B]`
}

// ── 재심 판결 ─────────────────────────────────────────────────
export async function requestRetrial(code: string, room: Room) {
  const MIN_MS = 8000
  const start = Date.now()

  const saveVerdict = async (text: string) => {
    const elapsed = Date.now() - start
    if (elapsed < MIN_MS) await new Promise(r => setTimeout(r, MIN_MS - elapsed))
    const winner = text.includes('[승자: B]') ? 'B' : 'A'
    const cleanText = text.replace(/\[승자: (A|B)\]/g, '').trim()
    await updateRoom(code, { status: 'verdict', verdictText: cleanText, winner, retrialDone: true })
  }

  const prompt = buildRetrialPrompt(room)
  try {
    const text = await deliberate(
      prompt,
      (ops) => buildSynthesisPrompt(ops, room.nicknameA, room.nicknameB!),
      room.judge,
    )
    await saveVerdict(text)
  } catch (e) {
    console.error('[재심 AI 오류]', e)
    try {
      const text = await callAI(prompt, room.judge)
      await saveVerdict(text)
    } catch (e2) {
      console.error('[재심 단순 시도도 실패]', e2)
      const elapsed = Date.now() - start
      if (elapsed < MIN_MS) await new Promise(r => setTimeout(r, MIN_MS - elapsed))
      await updateRoom(code, { status: 'failed' })
    }
  }
}

function buildRetrialPrompt(room: Room): string {
  const { nicknameA, nicknameB, submissionA, submissionB,
    clarificationA, clarificationB, resubmissionA, resubmissionB,
    appealText, winnerNote, appealBy } = room
  const loserNickname = appealBy === 'A' ? nicknameA : nicknameB!
  const winnerNickname = appealBy === 'A' ? nicknameB! : nicknameA

  let prompt = `당신은 "결이"입니다. 이 사건에 대해 이미 판결을 내렸지만, ${loserNickname}이(가) 억울함을 표현하며 재심을 신청했어요.
모든 내용을 더욱 신중하게 검토하여 최종 재심 판결을 내려주세요.

---

[${nicknameA}의 처음 이야기 (A 측)]
${submissionA}
`

  if (clarificationA && resubmissionA) {
    prompt += `
[결이의 질문에 대한 ${nicknameA}의 추가 답변]
질문: ${clarificationA}
답변: ${resubmissionA}
`
  }

  prompt += `
---

[${nicknameB}의 처음 이야기 (B 측)]
${submissionB}
`

  if (clarificationB && resubmissionB) {
    prompt += `
[결이의 질문에 대한 ${nicknameB}의 추가 답변]
질문: ${clarificationB}
답변: ${resubmissionB}
`
  }

  prompt += `
---

[재심 신청 — ${loserNickname}의 억울한 점]
${appealText}

[이긴 측 ${winnerNickname}의 추가 의견]
${winnerNote ? winnerNote : '(없음)'}

---

위 모든 내용을 다시 종합하여 재심 판결을 내려주세요.
이전 판결이 맞다면 같은 결론을 내려도 되고, 재심 내용을 보고 생각이 바뀌었다면 달라도 됩니다.
반드시 A 또는 B 중 하나의 손을 들어야 합니다.

아래 형식으로 재심 판결문을 작성해주세요:

## 결이의 재심 판결

**재심 검토**
(재심 신청 내용과 이긴 측 추가 의견을 검토한 결과. 어떤 새로운 시각을 고려했는지 2~3문장)

**${nicknameA}의 입장 재검토**
(처음 이야기 + 추가 답변(있으면) + 재심 내용을 종합 2~3문장)

**${nicknameB}의 입장 재검토**
(처음 이야기 + 추가 답변(있으면) + 재심 내용을 종합 2~3문장)

**결이의 최종 분석**
(모든 내용을 바탕으로 한 최종 비교 분석 3~4문장)

**결이의 재심 판결**
(최종 판결. 왜 이 결론인지 명확하게)

**결이의 한마디**
(양측에게 따뜻한 마무리 2~3문장)

마지막 줄에 반드시 아래 둘 중 하나만 (다른 내용 없이):
[승자: A]
[승자: B]`

  return prompt
}

// 3회 심의 결과를 종합하는 최종 프롬프트
function buildSynthesisPrompt(opinions: string[], nicknameA: string, nicknameB: string): string {
  return `당신은 "결이"입니다. 아래는 같은 갈등 케이스에 대한 세 번의 독립적인 분석 결과예요.
세 분석을 종합하여 가장 균형 잡힌 최종 판결을 내려주세요.
반드시 A 또는 B 중 하나의 손을 들어야 합니다.

[1차 분석]
${opinions[0]}

[2차 분석]
${opinions[1]}

[3차 분석]
${opinions[2]}

세 분석을 바탕으로 최종 판결문을 아래 형식으로 작성하세요:

## 결이의 판결

**갈등 성격**
(한 문장)

**${nicknameA}의 입장 검토**
(2~3문장)

**${nicknameB}의 입장 검토**
(2~3문장)

**결이의 비교 분석**
(3~4문장. 세 번의 검토를 종합한 신중한 분석)

**결이의 판결**
(명확한 판결과 이유)

**결이의 한마디**
(이기는 쪽 격려, 지는 쪽 위로 + 관계 조언 2~3문장)

마지막 줄에 반드시 아래 둘 중 하나만 (다른 내용 없이):
[승자: A]
[승자: B]`
}
