'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Press_Start_2P } from 'next/font/google'
import { McHead3D, McHead } from '@/components/McHead'

const pixelFont = Press_Start_2P({ subsets: ['latin'], weight: '400' })

// ── Types ──────────────────────────────────────────────────────
type Side = 'A' | 'B'
type RoomStatus = 'waiting' | 'partial' | 'analyzing' | 'clarifying' | 'verdict' | 'failed' | 'appealing'

interface Session {
  roomCode: string
  mySide: Side
  myNickname: string
}

interface RoomData {
  code: string
  status: RoomStatus
  nicknameA: string
  nicknameB: string | null
  submittedA: boolean
  submittedB: boolean
  submissionA: string | null
  submissionB: string | null
  clarificationA: string | null
  clarificationB: string | null
  resubmittedA: boolean
  resubmittedB: boolean
  resubmissionA: string | null
  resubmissionB: string | null
  verdictText: string | null
  winner: 'A' | 'B' | null
  appealBy: 'A' | 'B' | null
  retrialDone: boolean
  appealText: string | null
  appealLoserSubmitted: boolean
  winnerResponded: boolean
}

// ── Sub-components ─────────────────────────────────────────────
function Torch() {
  return (
    <div className="mc-torch-wrap" aria-hidden>
      <div className="mc-torch-fire" />
      <div className="mc-torch-stick" />
    </div>
  )
}

function ScalesAnimation() {
  return (
    <div className="mc-scales-wrap" aria-hidden>
      <svg width="72" height="56" viewBox="0 0 72 56" style={{ imageRendering: 'pixelated', display: 'block' }}>
        <rect x="33" y="12" width="6" height="38" fill="#5C3A1A" />
        <rect x="20" y="48" width="32" height="5" fill="#3A1C00" />
        <rect x="24" y="44" width="24" height="4" fill="#3A1C00" />
        <rect x="30" y="6" width="12" height="6" fill="#5C3A1A" />
        <rect x="34" y="2" width="4" height="4" fill="#5C3A1A" />
        <g className="mc-scales-beam">
          <rect x="4" y="8" width="64" height="5" fill="#8B5E3C" />
          <rect x="7" y="13" width="3" height="16" fill="#7A7A7A" />
          <rect x="62" y="13" width="3" height="16" fill="#7A7A7A" />
          <rect x="2" y="29" width="14" height="4" fill="#FFD700" />
          <rect x="4" y="33" width="10" height="2" fill="#E6C000" />
          <rect x="56" y="29" width="14" height="4" fill="#FFD700" />
          <rect x="58" y="33" width="10" height="2" fill="#E6C000" />
        </g>
      </svg>
    </div>
  )
}

function GavelAnimation() {
  return (
    <div className="mc-gavel-wrap" aria-hidden>
      <div className="mc-gavel-pivot">
        <svg width="64" height="56" viewBox="0 0 64 56" style={{ imageRendering: 'pixelated', display: 'block' }}>
          <rect x="28" y="24" width="8" height="28" fill="#5C3A1A" />
          <rect x="26" y="46" width="12" height="6" fill="#3A1C00" />
          <rect x="6" y="6" width="52" height="22" fill="#8B5E3C" />
          <rect x="6" y="6" width="52" height="6" fill="#3A1C00" />
          <rect x="6" y="22" width="52" height="6" fill="#3A1C00" />
          <rect x="8" y="12" width="48" height="4" fill="#A0714A" />
        </svg>
      </div>
    </div>
  )
}

function SmallGavelAnimation() {
  return (
    <div className="mc-small-gavel-wrap" aria-hidden>
      <div className="mc-small-gavel-pivot">
        <svg width="26" height="22" viewBox="0 0 64 56" style={{ imageRendering: 'pixelated', display: 'block' }}>
          <rect x="28" y="24" width="8" height="28" fill="#5C3A1A" />
          <rect x="26" y="46" width="12" height="6" fill="#3A1C00" />
          <rect x="6" y="6" width="52" height="22" fill="#8B5E3C" />
          <rect x="6" y="6" width="52" height="6" fill="#3A1C00" />
          <rect x="6" y="22" width="52" height="6" fill="#3A1C00" />
          <rect x="8" y="12" width="48" height="4" fill="#A0714A" />
        </svg>
      </div>
    </div>
  )
}

// ── Gemini 연결 테스트 버튼 (임시) ────────────────────────────
function PingButton() {
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'fail'>('idle')
  const [msg, setMsg] = useState('')

  async function ping() {
    setState('loading')
    try {
      const res = await fetch('/api/ping')
      const data = await res.json()
      if (data.ok) { setState('ok'); setMsg(data.reply ?? '연결 성공') }
      else { setState('fail'); setMsg(data.error ?? '실패') }
    } catch { setState('fail'); setMsg('네트워크 오류') }
  }

  return (
    <div style={{ marginTop: 16, textAlign: 'center' }}>
      <button
        className="mc-btn mc-btn-outline"
        style={{ fontSize: '0.65rem', padding: '4px 12px' }}
        onClick={ping}
        disabled={state === 'loading'}
      >
        {state === 'loading' ? '결이 연결 확인 중...' : '결이 연결 테스트'}
      </button>
      {msg && (
        <div style={{ marginTop: 6, fontSize: '0.65rem', color: state === 'ok' ? '#4caf50' : '#e53935' }}>
          {state === 'ok' ? '✔ ' : '✕ '}{msg}
        </div>
      )}
    </div>
  )
}

// ── Lobby Screen ───────────────────────────────────────────────
function LobbyScreen({ onSession }: { onSession: (s: Session) => void }) {
  const [mode, setMode] = useState<'home' | 'create' | 'join'>('home')
  const [nickname, setNickname] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!nickname.trim()) return setError('닉네임을 입력해주세요')
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nickname: nickname.trim() }) })
      const data = await res.json()
      if (!res.ok) return setError(data.error)
      onSession({ roomCode: data.code, mySide: 'A', myNickname: nickname.trim() })
    } catch { setError('네트워크 오류가 발생했어요') } finally { setLoading(false) }
  }

  async function handleJoin() {
    if (!joinCode.trim()) return setError('초대 코드를 입력해주세요')
    if (!nickname.trim()) return setError('닉네임을 입력해주세요')
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/rooms/${joinCode.trim().toUpperCase()}/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nickname: nickname.trim() }) })
      const data = await res.json()
      if (!res.ok) return setError(data.error)
      onSession({ roomCode: joinCode.trim().toUpperCase(), mySide: 'B', myNickname: nickname.trim() })
    } catch { setError('네트워크 오류가 발생했어요') } finally { setLoading(false) }
  }

  return (
    <div className="mc-scene">
      <div className="mc-courtroom">
        <header className="mc-header">
          <Torch />
          <h1 className={`${pixelFont.className} mc-header-title`}>my-ally</h1>
          <Torch />
        </header>
        <section className="mc-judge-section">
          <div className="mc-platform">
            <div className="mc-speech-bubble">
              {mode === 'home' && '안녕하세요! 갈등 중재를 시작해요'}
              {mode === 'create' && '닉네임을 알려주세요 :)'}
              {mode === 'join' && '코드와 닉네임을 입력해주세요'}
            </div>
            <McHead3D type="judge" size={56} />
            <div className="mc-nameplate">결이</div>
          </div>
          <div className="mc-platform-step" />
        </section>
        <section className="mc-lobby-section">
          {mode === 'home' && (
            <>
              <button className="mc-btn mc-btn-green" onClick={() => { setMode('create'); setError('') }}>⚔ 새 케이스 만들기</button>
              <div className="mc-divider">또는</div>
              <button className="mc-btn mc-btn-gray" onClick={() => { setMode('join'); setError('') }}>🔑 코드로 참여하기</button>
              <PingButton />
            </>
          )}
          {mode === 'create' && (
            <div className="mc-form">
              <label className="mc-label">나의 닉네임</label>
              <input className="mc-input" placeholder="예: 김민준, 화난사람, ..." maxLength={20} value={nickname} onChange={e => setNickname(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} autoFocus />
              {error && <p className="mc-error">{error}</p>}
              <div className="mc-form-actions">
                <button className="mc-btn mc-btn-outline" onClick={() => { setMode('home'); setError('') }}>← 뒤로</button>
                <button className="mc-btn mc-btn-green" onClick={handleCreate} disabled={loading}>{loading ? '생성 중...' : '방 만들기'}</button>
              </div>
            </div>
          )}
          {mode === 'join' && (
            <div className="mc-form">
              <label className="mc-label">초대 코드</label>
              <input className="mc-input mc-input-code" placeholder="예: MXTP4K" maxLength={6} value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} autoFocus />
              <label className="mc-label" style={{ marginTop: 12 }}>나의 닉네임</label>
              <input className="mc-input" placeholder="예: 이수아, 억울한사람, ..." maxLength={20} value={nickname} onChange={e => setNickname(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleJoin()} />
              {error && <p className="mc-error">{error}</p>}
              <div className="mc-form-actions">
                <button className="mc-btn mc-btn-outline" onClick={() => { setMode('home'); setError('') }}>← 뒤로</button>
                <button className="mc-btn mc-btn-blue" onClick={handleJoin} disabled={loading}>{loading ? '참여 중...' : '참여하기'}</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

// ── Submit / Clarify Overlay ───────────────────────────────────
interface SubmitOverlayProps {
  mySide: Side
  myNickname: string
  roomCode: string
  clarificationQuestion?: string | null
  onClose: () => void
  onDone: (text: string) => void
}

function SubmitOverlay({ mySide, myNickname, roomCode, clarificationQuestion, onClose, onDone }: SubmitOverlayProps) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isClarify = !!clarificationQuestion

  async function handleSubmit() {
    if (!text.trim()) return setError(isClarify ? '답변을 입력해주세요' : '이야기를 입력해주세요')
    setLoading(true); setError('')
    try {
      const endpoint = isClarify ? `/api/rooms/${roomCode}/clarify` : `/api/rooms/${roomCode}/submit`
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ side: mySide, content: text.trim() }) })
      const data = await res.json()
      if (!res.ok) return setError(data.error)
      onDone(text.trim())
    } catch { setError('네트워크 오류가 발생했어요') } finally { setLoading(false) }
  }

  return (
    <div className="mc-overlay">
      <div className="mc-overlay-panel">
        <div className="mc-overlay-header">
          <span className={mySide === 'A' ? 'mc-side-badge-a' : 'mc-side-badge-b'}>
            {myNickname}{isClarify ? '의 추가 답변' : '의 이야기'}
          </span>
        </div>
        {isClarify ? (
          <div className="mc-clarification-question">
            <div className="mc-clarification-label">결이의 질문</div>
            <div className="mc-clarification-text">{clarificationQuestion}</div>
          </div>
        ) : (
          <p className="mc-overlay-hint">어떤 상황이었나요? 솔직하게 적어주세요.<br />상대방은 판결 전까지 볼 수 없어요.</p>
        )}
        <textarea className="mc-textarea" placeholder={isClarify ? '결이의 질문에 답변해주세요...' : '예: 우리가 약속을 잡았는데 상대방이 갑자기...'} maxLength={500} value={text} onChange={e => setText(e.target.value)} autoFocus />
        <div className="mc-char-count">{text.length} / 500</div>
        {error && <p className="mc-error">{error}</p>}
        <div className="mc-form-actions">
          <button className="mc-btn mc-btn-outline" onClick={onClose} disabled={loading}>취소</button>
          <button className={`mc-btn ${mySide === 'A' ? 'mc-btn-blue' : 'mc-btn-red'}`} onClick={handleSubmit} disabled={loading || !text.trim()}>
            {loading ? '제출 중...' : '제출하기'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 간단 마크다운 렌더러 ────────────────────────────────────────
function VerdictMarkdown({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="mc-verdict-md">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="mc-verdict-spacer" />
        if (line.startsWith('## ')) return <div key={i} className="mc-verdict-h2">{line.slice(3)}</div>
        if (line.startsWith('### ')) return <div key={i} className="mc-verdict-h3">{line.slice(4)}</div>

        // **bold** 인라인 처리
        const parts = line.split(/(\*\*[^*]+\*\*)/)
        const rendered = parts.map((part, j) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={j}>{part.slice(2, -2)}</strong>
            : part
        )
        // 줄 전체가 **bold** 하나면 소제목으로
        if (parts.length === 3 && !parts[0] && !parts[2]) {
          return <div key={i} className="mc-verdict-section-title">{parts[1].slice(2, -2)}</div>
        }
        return <div key={i} className="mc-verdict-line">{rendered}</div>
      })}
    </div>
  )
}

// ── Failed Actions ─────────────────────────────────────────────
function FailedActions({ roomCode, onRetry, onHome }: { roomCode: string; onRetry: () => void; onHome: () => void }) {
  const [retrying, setRetrying] = useState(false)

  async function handleRetry() {
    setRetrying(true)
    try {
      const res = await fetch(`/api/rooms/${roomCode}/retry`, { method: 'POST' })
      if (res.ok) {
        onRetry() // poll 즉시 한 번 실행해서 analyzing 상태 반영
      }
    } catch { /* ignore */ } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="mc-exit-section" style={{ gap: 8 }}>
      <button className="mc-btn mc-btn-green" onClick={handleRetry} disabled={retrying}>
        {retrying ? '연결 중...' : '다시 판결 받기'}
      </button>
      <button className="mc-btn mc-btn-outline mc-exit-btn" onClick={onHome}>
        퇴소하기
      </button>
    </div>
  )
}

// ── Appeal Overlay (재심 내용 제출 / 이긴 쪽 추가 의견) ────────
interface AppealOverlayProps {
  side: Side
  action: 'loser-submit' | 'respond'
  roomCode: string
  onClose: () => void
  onDone: () => void
}

function AppealOverlay({ side, action, roomCode, onClose, onDone }: AppealOverlayProps) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isLoser = action === 'loser-submit'

  async function handleSubmit() {
    if (!text.trim()) return setError(isLoser ? '억울한 내용을 입력해주세요' : '내용을 입력해주세요')
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/rooms/${roomCode}/appeal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ side, action, content: text.trim() }),
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error)
      onDone()
    } catch { setError('네트워크 오류가 발생했어요') }
    finally { setLoading(false) }
  }

  return (
    <div className="mc-overlay">
      <div className="mc-overlay-panel">
        <div className="mc-overlay-header">
          <span className={side === 'A' ? 'mc-side-badge-a' : 'mc-side-badge-b'}>
            {isLoser ? '재심 내용 제출' : '추가 의견 제출'}
          </span>
        </div>
        <p className="mc-overlay-hint">
          {isLoser ? '무엇이 억울한지 구체적으로 적어주세요.\n상대방에게도 공유돼요.' : '추가로 하고 싶은 말을 적어주세요.'}
        </p>
        <textarea
          className="mc-textarea"
          placeholder={isLoser ? '억울한 점을 구체적으로 적어주세요...' : '추가 의견을 적어주세요...'}
          maxLength={500}
          value={text}
          onChange={e => setText(e.target.value)}
          autoFocus
        />
        <div className="mc-char-count">{text.length} / 500</div>
        {error && <p className="mc-error">{error}</p>}
        <div className="mc-form-actions">
          <button className="mc-btn mc-btn-outline" onClick={onClose} disabled={loading}>취소</button>
          <button
            className={`mc-btn ${isLoser ? 'mc-btn-red' : 'mc-btn-green'}`}
            onClick={handleSubmit}
            disabled={loading || !text.trim()}
          >
            {loading ? '제출 중...' : '제출하기'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Verdict Modal ──────────────────────────────────────────────
interface VerdictModalProps {
  roomData: RoomData
  session: Session
  mySubmission: string | null
  onClose: () => void
}

function VerdictModal({ roomData, session, mySubmission, onClose }: VerdictModalProps) {
  const [showMyStory, setShowMyStory] = useState(false)
  const [appealSec, setAppealSec] = useState(12)
  const [appealStarting, setAppealStarting] = useState(false)
  const [appealError, setAppealError] = useState('')

  const winner = roomData.winner
  const isWinner = winner === session.mySide
  const winnerNickname = winner === 'A' ? roomData.nicknameA : roomData.nicknameB
  const myStoryText = (session.mySide === 'A' ? roomData.submissionA : roomData.submissionB) ?? mySubmission
  const myResubmission = session.mySide === 'A' ? roomData.resubmissionA : roomData.resubmissionB
  const canAppeal = !isWinner && !roomData.retrialDone
  const modalTitle = roomData.retrialDone ? '결이의 재심 판결문' : '결이의 판결문'

  // 진 쪽 12초 카운트다운
  useEffect(() => {
    if (!canAppeal || appealSec === 0) return
    const t = setInterval(() => setAppealSec(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [canAppeal, appealSec])

  // 억울해요! → 즉시 재심 시작, 재판장으로 돌아가기
  async function handleStartAppeal() {
    setAppealStarting(true)
    setAppealError('')
    try {
      const res = await fetch(`/api/rooms/${roomData.code}/appeal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ side: session.mySide, action: 'start' }),
      })
      const data = await res.json()
      if (res.ok) {
        onClose()
      } else {
        setAppealError(data.error ?? '오류가 발생했어요')
        setAppealStarting(false)
      }
    } catch {
      setAppealError('네트워크 오류가 발생했어요')
      setAppealStarting(false)
    }
  }

  return (
    <div className="mc-overlay">
      <div className="mc-overlay-panel mc-verdict-modal">
        <button className="mc-modal-close" onClick={onClose} aria-label="닫기">✕</button>
        <div className="mc-modal-header">{modalTitle}</div>

        <div className={`mc-winner-banner ${isWinner ? 'win' : 'lose'}`}>
          {isWinner ? '결이가 내 손을 들어줬어요' : `${winnerNickname}의 손을 들어줬어요`}
        </div>

        {roomData.verdictText && <VerdictMarkdown text={roomData.verdictText} />}

        {/* 내가 제출한 이야기 보기 */}
        {myStoryText && (
          <div className="mc-my-story-section">
            <button className="mc-btn mc-btn-outline mc-my-story-toggle" onClick={() => setShowMyStory(v => !v)}>
              {showMyStory ? '내 이야기 접기 ▲' : '내가 제출한 이야기 보기 ▼'}
            </button>
            {showMyStory && (
              <div className="mc-my-story-text">
                {myStoryText}
                {myResubmission && (
                  <>
                    <div className="mc-my-story-divider">— 추가 답변 —</div>
                    {myResubmission}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* 진 쪽: 닫기(50%) + 억울해요!(50%) */}
        {canAppeal && (
          <>
            {appealError && <p className="mc-error" style={{ marginTop: 8 }}>{appealError}</p>}
            <div className="mc-form-actions" style={{ marginTop: 12 }}>
              <button className="mc-btn mc-btn-outline" onClick={onClose}>닫기</button>
              <button
                className="mc-btn mc-btn-red"
                onClick={handleStartAppeal}
                disabled={appealSec > 0 || appealStarting}
              >
                {appealSec > 0 ? `억울해요! (${appealSec}초)` : (appealStarting ? '...' : '억울해요!')}
              </button>
            </div>
          </>
        )}

        {/* 이긴 쪽 or 재심완료: 닫기만 (100%) */}
        {!canAppeal && (
          <div className="mc-form-actions" style={{ marginTop: 12 }}>
            <button className="mc-btn mc-btn-outline" onClick={onClose}>닫기</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Courtroom Screen ───────────────────────────────────────────
function CourtroomScreen({ session, onHome }: { session: Session; onHome: () => void }) {
  const [roomData, setRoomData] = useState<RoomData | null>(null)
  const [showSubmit, setShowSubmit] = useState(false)
  const [showVerdict, setShowVerdict] = useState(false)
  const [mySubmission, setMySubmission] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  // 퇴소 카운트다운 (진 쪽)
  const [exitSec, setExitSec] = useState(30)
  const [accepted, setAccepted] = useState(false)
  // 재심 관련
  const [showAppealSubmit, setShowAppealSubmit] = useState(false)
  const [showWinnerSubmit, setShowWinnerSubmit] = useState(false)
  const [winnerMaintaining, setWinnerMaintaining] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevStatusRef = useRef<RoomStatus | null>(null)

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/rooms/${session.roomCode}`)
      if (!res.ok) return
      const data = await res.json()
      setRoomData(data)
      if (data.status === 'verdict') {
        if (pollRef.current) {
          clearInterval(pollRef.current)
          pollRef.current = null
        }
      }
    } catch { /* ignore */ }
  }, [session.roomCode])

  useEffect(() => {
    poll()
    pollRef.current = setInterval(poll, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [poll])

  // 상태 변화 시 모달 자동 열기 (verdict만)
  useEffect(() => {
    if (!roomData) return
    const prev = prevStatusRef.current
    const cur = roomData.status
    if (prev !== cur && cur === 'verdict') {
      setShowVerdict(true)
    }
    // verdict가 아니면 카운트 리셋
    if (cur !== 'verdict') {
      setExitSec(30)
      setAccepted(false)
    }
    prevStatusRef.current = cur
  }, [roomData?.status])

  // 퇴소 카운트다운 (verdict 상태에서 진 쪽)
  useEffect(() => {
    if (!roomData || roomData.status !== 'verdict') return
    if (roomData.retrialDone || roomData.winner === session.mySide) return
    if (accepted || exitSec === 0) return
    const t = setInterval(() => setExitSec(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [roomData?.status, roomData?.retrialDone, roomData?.winner, session.mySide, accepted, exitSec])

  async function handleWinnerMaintain() {
    setWinnerMaintaining(true)
    try {
      const res = await fetch(`/api/rooms/${session.roomCode}/appeal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ side: session.mySide, action: 'respond', content: '' }),
      })
      if (res.ok) poll()
    } catch { /* ignore */ }
    finally { setWinnerMaintaining(false) }
  }

  async function copyCode() {
    await navigator.clipboard.writeText(session.roomCode).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!roomData) {
    return (
      <div className="mc-scene">
        <div className="mc-courtroom">
          <header className="mc-header"><Torch /><span className={`${pixelFont.className} mc-header-title`}>my-ally</span><Torch /></header>
          <div style={{ padding: 40, textAlign: 'center', color: '#7A5C3A', fontWeight: 700 }}>로딩 중...</div>
        </div>
      </div>
    )
  }

  const mySubmitted = session.mySide === 'A' ? roomData.submittedA : roomData.submittedB
  const otherNickname = session.mySide === 'A' ? roomData.nicknameB : roomData.nicknameA
  const otherJoined = !!otherNickname
  const myClarification = session.mySide === 'A' ? roomData.clarificationA : roomData.clarificationB
  const myResubmitted = session.mySide === 'A' ? roomData.resubmittedA : roomData.resubmittedB
  const otherResubmitted = session.mySide === 'A' ? roomData.resubmittedB : roomData.resubmittedA

  const isVerdict = roomData.status === 'verdict'
  const isAnalyzing = roomData.status === 'analyzing'
  const isClarifying = roomData.status === 'clarifying'
  const isFailed = roomData.status === 'failed'
  const isAppealing = roomData.status === 'appealing'
  const isWinnerNow = roomData.winner === session.mySide
  const canExit = isWinnerNow || roomData.retrialDone || accepted || exitSec === 0

  // 판사 말풍선
  const appealerNickname = roomData.appealBy === 'A' ? roomData.nicknameA : roomData.nicknameB
  let judgeSpeech: React.ReactNode = '양쪽 이야기를 기다리고 있어요'
  if (isAppealing) {
    if (!isWinnerNow) {
      judgeSpeech = roomData.appealLoserSubmitted
        ? '재심 내용을 제출했어요. 상대방의 응답을 기다려요!'
        : '억울한 내용을 제출해주세요!'
    } else {
      judgeSpeech = roomData.appealLoserSubmitted
        ? '재심 내용을 확인하고 응답해주세요!'
        : `${appealerNickname}이(가) 재심을 요청했어요`
    }
  } else if (isVerdict) {
    judgeSpeech = '판결이 나왔어요!'
  } else if (isClarifying) {
    judgeSpeech = myResubmitted ? `${otherNickname}의 답변을 기다리고 있어요` : '논점을 더 명확히 해야겠어요. 추가 질문을 드릴게요!'
  } else if (!otherJoined) {
    judgeSpeech = '상대방이 참여하길 기다리고 있어요'
  } else if (mySubmitted && !roomData.submittedB && session.mySide === 'A') {
    judgeSpeech = `${otherNickname}의 이야기를 기다리고 있어요`
  } else if (mySubmitted && !roomData.submittedA && session.mySide === 'B') {
    judgeSpeech = `${otherNickname}의 이야기를 기다리고 있어요`
  } else if (!mySubmitted) {
    judgeSpeech = '이제 이야기를 제출해주세요!'
  }

  const desks = session.mySide === 'A'
    ? [
        { side: 'A' as Side, nickname: session.myNickname, submitted: roomData.submittedA, resubmitted: roomData.resubmittedA, isMe: true },
        { side: 'B' as Side, nickname: otherNickname, submitted: roomData.submittedB, resubmitted: roomData.resubmittedB, isMe: false },
      ]
    : [
        { side: 'A' as Side, nickname: roomData.nicknameA, submitted: roomData.submittedA, resubmitted: roomData.resubmittedA, isMe: false },
        { side: 'B' as Side, nickname: session.myNickname, submitted: roomData.submittedB, resubmitted: roomData.resubmittedB, isMe: true },
      ]

  return (
    <>
      <div className="mc-scene">
        <div className="mc-courtroom">
          {/* Header */}
          <header className="mc-header">
            <Torch />
            <div className="mc-header-center">
              <span className={`${pixelFont.className} mc-header-title`}>my-ally</span>
              <span className="mc-room-code" onClick={copyCode} title="클릭해서 복사">
                {copied ? '✔ 복사됨' : session.roomCode}
              </span>
            </div>
            <Torch />
          </header>

          {/* Judge section */}
          <section className="mc-judge-section">
            {isAnalyzing ? (
              <div className="mc-analyzing-section">
                <ScalesAnimation />
                <McHead3D type="judge" size={56} />
                <div className="mc-nameplate">결이</div>
                <div className="mc-analyzing-text">신중하게 검토 중...</div>
              </div>
            ) : isFailed ? (
              <div className="mc-failed-section">
                <div className="mc-platform">
                  <div className="mc-speech-bubble">
                    지금 결이와 연결이 안 됐어요.<br />잠시 후 다시 시도해주세요.
                  </div>
                  <McHead3D type="judge" size={56} />
                  <div className="mc-nameplate">결이</div>
                </div>
                <div className="mc-platform-step" />
                <FailedActions roomCode={session.roomCode} onRetry={poll} onHome={onHome} />
              </div>
            ) : (
              <>
                <div className="mc-platform">
                  <div className={`mc-speech-bubble${(isVerdict || isAppealing) ? ' mc-speech-verdict' : ''}`}>
                    {judgeSpeech}
                    {(isVerdict || isAppealing) && (
                      <button className="mc-verdict-peek-btn" onClick={() => setShowVerdict(true)}>
                        {isAppealing && !isWinnerNow ? '재심 상태 확인 ▶' : '판결 확인하기 ▶'}
                      </button>
                    )}
                  </div>
                  <div style={{ position: 'relative', display: 'inline-block', overflow: 'visible' }}>
                    <McHead3D type="judge" size={56} />
                    {isVerdict && <SmallGavelAnimation key={roomData.verdictText ?? 'verdict'} />}
                  </div>
                  <div className="mc-nameplate">결이</div>
                </div>
                <div className="mc-platform-step" />
              </>
            )}
          </section>

          {/* Floor section — verdict 포함 항상 표시 */}
          <section className="mc-floor-section">
            <div className="mc-pillar" />
            {desks.map(desk => {
              let statusText = '...'
              let statusClass = 'waiting'
              if (desk.nickname) {
                // 재심 진행 중
                if (isAppealing) {
                  const deskIsWinner = desk.isMe ? isWinnerNow : !isWinnerNow
                  if (deskIsWinner) {
                    statusText = roomData.winnerResponded ? '✔ 응답 완료' : '응답 대기 중'
                    statusClass = roomData.winnerResponded ? 'submitted' : 'waiting'
                  } else {
                    statusText = roomData.appealLoserSubmitted ? '✔ 재심 제출됨' : '재심 대기 중'
                    statusClass = roomData.appealLoserSubmitted ? 'submitted' : 'waiting'
                  }
                } else if (isClarifying) {
                  const myR = desk.isMe ? myResubmitted : otherResubmitted
                  statusText = myR ? '✔ 답변 완료' : (desk.isMe ? '추가 질문 있음' : '답변 대기 중')
                  statusClass = myR ? 'submitted' : 'waiting'
                } else {
                  statusText = desk.submitted ? '✔ 제출 완료' : (isVerdict ? '제출 완료' : '대기 중')
                  statusClass = (desk.submitted || isVerdict) ? 'submitted' : 'waiting'
                }
              }

              return (
                <div key={desk.side} className="mc-desk">
                  <div className={`mc-desk-surface ${desk.side === 'A' ? 'mc-desk-surface--blue' : 'mc-desk-surface--red'}`}>
                    <McHead type={desk.side} size={48} />
                    <div className="mc-desk-label">{desk.nickname ?? '참여 대기 중...'}</div>
                    <div className={`mc-desk-status ${statusClass}`}>{statusText}</div>
                  </div>

                  {/* 재심 진행 중 — 내 데스크 버튼 */}
                  {desk.isMe && isAppealing && (
                    <>
                      {/* 진 쪽: 재심 내용 제출 버튼 */}
                      {!isWinnerNow && (
                        roomData.appealLoserSubmitted
                          ? <div className="mc-desk-placeholder" />
                          : <button
                              className={`mc-btn ${desk.side === 'A' ? 'mc-btn-blue' : 'mc-btn-red'}`}
                              onClick={() => setShowAppealSubmit(true)}
                            >
                              재심 내용 제출하기
                            </button>
                      )}

                      {/* 이긴 쪽: 상대방 제출 후 응답 가능 */}
                      {isWinnerNow && (
                        roomData.winnerResponded
                          ? <div className="mc-desk-placeholder" />
                          : !roomData.appealLoserSubmitted
                            ? <div className="mc-desk-placeholder" />
                            : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                                <button
                                  className={`mc-btn ${desk.side === 'A' ? 'mc-btn-blue' : 'mc-btn-red'}`}
                                  onClick={handleWinnerMaintain}
                                  disabled={winnerMaintaining}
                                >
                                  {winnerMaintaining ? '...' : '의견 유지'}
                                </button>
                                <button
                                  className="mc-btn mc-btn-outline"
                                  style={{ fontSize: '0.65rem' }}
                                  onClick={() => setShowWinnerSubmit(true)}
                                >
                                  추가 의견 제출
                                </button>
                              </div>
                            )
                      )}
                    </>
                  )}

                  {/* 일반 상태 — 내 데스크 버튼 */}
                  {desk.isMe && !isVerdict && !isAppealing && (
                    <>
                      {!isClarifying && (
                        <button
                          className={`mc-btn ${desk.side === 'A' ? 'mc-btn-blue' : 'mc-btn-red'}`}
                          onClick={() => setShowSubmit(true)}
                          disabled={mySubmitted || isAnalyzing}
                        >
                          {mySubmitted ? '제출됨 ✔' : '제출하기'}
                        </button>
                      )}
                      {isClarifying && !myResubmitted && (
                        <button className={`mc-btn ${desk.side === 'A' ? 'mc-btn-blue' : 'mc-btn-red'}`} onClick={() => setShowSubmit(true)}>
                          추가 답변 제출
                        </button>
                      )}
                      {isClarifying && myResubmitted && <div className="mc-desk-placeholder" />}
                    </>
                  )}

                  {/* 상대방 데스크 or verdict 상태 — 빈 자리 */}
                  {(!desk.isMe || isVerdict) && !isAppealing && <div className="mc-desk-placeholder" />}
                </div>
              )
            })}
            <div className="mc-pillar" />
          </section>

          {/* 하단 — verdict 상태 퇴소/납득 */}
          {isVerdict && (
            <div className="mc-exit-section">
              {!isWinnerNow && !roomData.retrialDone && !accepted && exitSec > 0 && (
                <button
                  className="mc-btn mc-btn-outline"
                  style={{ minWidth: 100 }}
                  onClick={() => setAccepted(true)}
                >
                  납득하기
                </button>
              )}
              <button
                className="mc-btn mc-btn-outline mc-exit-btn"
                onClick={onHome}
                disabled={!canExit}
              >
                {canExit ? '퇴소하기' : `퇴소하기 (${exitSec}초)`}
              </button>
            </div>
          )}
        </div>
      </div>

      {showSubmit && (
        <SubmitOverlay
          mySide={session.mySide}
          myNickname={session.myNickname}
          roomCode={session.roomCode}
          clarificationQuestion={isClarifying ? myClarification : null}
          onClose={() => setShowSubmit(false)}
          onDone={(text) => {
            setShowSubmit(false)
            if (!mySubmission) setMySubmission(text)
            poll()
          }}
        />
      )}

      {showVerdict && (roomData.status === 'verdict' || roomData.status === 'appealing') && (
        <VerdictModal
          roomData={roomData}
          session={session}
          mySubmission={mySubmission}
          onClose={() => {
            setShowVerdict(false)
            // 억울해요! 클릭 후 상태가 appealing으로 바뀌었을 수 있으므로 poll 재시작
            if (!pollRef.current) {
              poll()
              pollRef.current = setInterval(poll, 3000)
            }
          }}
        />
      )}

      {/* 재심 내용 제출 (진 쪽) */}
      {showAppealSubmit && (
        <AppealOverlay
          side={session.mySide}
          action="loser-submit"
          roomCode={session.roomCode}
          onClose={() => setShowAppealSubmit(false)}
          onDone={() => { setShowAppealSubmit(false); poll() }}
        />
      )}

      {/* 추가 의견 제출 (이긴 쪽) */}
      {showWinnerSubmit && (
        <AppealOverlay
          side={session.mySide}
          action="respond"
          roomCode={session.roomCode}
          onClose={() => setShowWinnerSubmit(false)}
          onDone={() => { setShowWinnerSubmit(false); poll() }}
        />
      )}
    </>
  )
}

// ── App Root ───────────────────────────────────────────────────
export default function Home() {
  const [session, setSession] = useState<Session | null>(null)
  if (!session) return <LobbyScreen onSession={setSession} />
  return <CourtroomScreen session={session} onHome={() => setSession(null)} />
}
