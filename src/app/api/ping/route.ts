import Groq from 'groq-sdk'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: '안녕? 한 단어로만 대답해.' }],
      max_tokens: 20,
    })
    const reply = completion.choices[0]?.message?.content ?? ''
    return NextResponse.json({ ok: true, reply })
  } catch (e: unknown) {
    const err = e as { message?: string; status?: number }
    return NextResponse.json({ ok: false, error: err.message ?? '알 수 없는 오류' }, { status: 500 })
  }
}
