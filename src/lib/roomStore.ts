import { getSupabase } from './supabase'

export type RoomStatus = 'waiting' | 'partial' | 'analyzing' | 'clarifying' | 'verdict' | 'failed' | 'appealing'
export type Winner = 'A' | 'B'

export interface Room {
  code: string
  status: RoomStatus
  nicknameA: string
  nicknameB: string | null
  submissionA: string | null
  submissionB: string | null
  clarificationA: string | null  // 결이가 A에게 묻는 추가 질문
  clarificationB: string | null  // 결이가 B에게 묻는 추가 질문
  resubmissionA: string | null   // A의 추가 답변
  resubmissionB: string | null   // B의 추가 답변
  verdictText: string | null
  winner: Winner | null
  judge: string                  // 판사 모델 ('gemini' | 'claude')
  appealBy: 'A' | 'B' | null    // 재심 신청한 쪽
  appealText: string | null      // 재심 신청 내용
  winnerNote: string | null      // 이긴 쪽 추가 의견
  retrialDone: boolean           // 재심 완료 여부
  createdAt: number
}

function toRoom(row: Record<string, unknown>): Room {
  return {
    code: row.code as string,
    status: row.status as RoomStatus,
    nicknameA: row.nickname_a as string,
    nicknameB: (row.nickname_b as string | null) ?? null,
    submissionA: (row.submission_a as string | null) ?? null,
    submissionB: (row.submission_b as string | null) ?? null,
    clarificationA: (row.clarification_a as string | null) ?? null,
    clarificationB: (row.clarification_b as string | null) ?? null,
    resubmissionA: (row.resubmission_a as string | null) ?? null,
    resubmissionB: (row.resubmission_b as string | null) ?? null,
    verdictText: (row.verdict_text as string | null) ?? null,
    winner: (row.winner as Winner | null) ?? null,
    judge: (row.judge as string | null) ?? 'gemini',
    appealBy: (row.appeal_by as 'A' | 'B' | null) ?? null,
    appealText: (row.appeal_text as string | null) ?? null,
    winnerNote: (row.winner_note as string | null) ?? null,
    retrialDone: (row.retrial_done as boolean) ?? false,
    createdAt: row.created_at as number,
  }
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function createRoom(nicknameA: string, judge = 'gemini'): Promise<Room> {
  const db = getSupabase()
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateCode()
    const { data, error } = await db
      .from('rooms')
      .insert({ code, status: 'waiting', nickname_a: nicknameA, judge, created_at: Date.now() })
      .select()
      .single()

    if (!error && data) return toRoom(data)
    if (error?.code !== '23505') throw error
  }
  throw new Error('방 코드 생성에 실패했어요')
}

export async function getRoom(code: string): Promise<Room | null> {
  const db = getSupabase()
  const { data, error } = await db
    .from('rooms')
    .select()
    .eq('code', code.toUpperCase().trim())
    .single()

  if (error || !data) return null
  return toRoom(data)
}

export async function updateRoom(code: string, updates: Partial<Room>): Promise<Room | null> {
  const db = getSupabase()
  const dbUpdates: Record<string, unknown> = {}
  if (updates.status !== undefined) dbUpdates.status = updates.status
  if (updates.nicknameB !== undefined) dbUpdates.nickname_b = updates.nicknameB
  if (updates.submissionA !== undefined) dbUpdates.submission_a = updates.submissionA
  if (updates.submissionB !== undefined) dbUpdates.submission_b = updates.submissionB
  if (updates.clarificationA !== undefined) dbUpdates.clarification_a = updates.clarificationA
  if (updates.clarificationB !== undefined) dbUpdates.clarification_b = updates.clarificationB
  if (updates.resubmissionA !== undefined) dbUpdates.resubmission_a = updates.resubmissionA
  if (updates.resubmissionB !== undefined) dbUpdates.resubmission_b = updates.resubmissionB
  if (updates.verdictText !== undefined) dbUpdates.verdict_text = updates.verdictText
  if (updates.winner !== undefined) dbUpdates.winner = updates.winner
  if (updates.judge !== undefined) dbUpdates.judge = updates.judge
  if (updates.appealBy !== undefined) dbUpdates.appeal_by = updates.appealBy
  if (updates.appealText !== undefined) dbUpdates.appeal_text = updates.appealText
  if (updates.winnerNote !== undefined) dbUpdates.winner_note = updates.winnerNote
  if (updates.retrialDone !== undefined) dbUpdates.retrial_done = updates.retrialDone

  const { data, error } = await db
    .from('rooms')
    .update(dbUpdates)
    .eq('code', code.toUpperCase().trim())
    .select()
    .single()

  if (error || !data) return null
  return toRoom(data)
}

export async function joinRoom(code: string, nicknameB: string): Promise<Room | { error: string }> {
  const room = await getRoom(code)
  if (!room) return { error: '방을 찾을 수 없어요' }
  if (room.nicknameB) return { error: '이미 두 명이 참여한 방이에요' }
  if (room.status === 'verdict') return { error: '이미 판결이 완료된 방이에요' }

  const updated = await updateRoom(code, { nicknameB, status: 'partial' })
  if (!updated) return { error: '참여 처리 중 오류가 발생했어요' }
  return updated
}
