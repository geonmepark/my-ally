import { getSupabase } from './supabase'
import type { User } from '@supabase/supabase-js'

export const NAME_CHANGE_COOLDOWN_MS = 24 * 60 * 60 * 1000 // 이름 변경 1일 1회
export const DISPLAY_NAME_MAX = 20

export interface Profile {
  userId: string
  displayName: string
  avatarUrl: string | null
  nameChangedAt: string | null
}

function toProfile(row: Record<string, unknown>): Profile {
  return {
    userId: row.user_id as string,
    displayName: row.display_name as string,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    nameChangedAt: (row.name_changed_at as string | null) ?? null,
  }
}

// SNS 메타데이터에서 초기 표시 이름/아바타를 뽑는다.
function seedFromUser(user: User): { displayName: string; avatarUrl: string | null } {
  const m = (user.user_metadata ?? {}) as Record<string, unknown>
  const name =
    (m.full_name as string) ||
    (m.name as string) ||
    (user.email ? user.email.split('@')[0] : '') ||
    '사용자'
  const avatarUrl = (m.avatar_url as string) || (m.picture as string) || null
  return { displayName: String(name).slice(0, DISPLAY_NAME_MAX), avatarUrl }
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const db = getSupabase()
  const { data, error } = await db.from('profiles').select().eq('user_id', userId).maybeSingle()
  if (error || !data) return null
  return toProfile(data)
}

// 프로필이 없으면 SNS 메타데이터로 생성(lazy-seed) 후 반환.
export async function getOrCreateProfile(user: User): Promise<Profile> {
  const existing = await getProfile(user.id)
  if (existing) return existing

  const seed = seedFromUser(user)
  const db = getSupabase()
  const { data, error } = await db
    .from('profiles')
    .insert({ user_id: user.id, display_name: seed.displayName, avatar_url: seed.avatarUrl })
    .select()
    .single()

  // 동시 요청 등으로 이미 생성됐다면 다시 읽어서 반환
  if (error) {
    const again = await getProfile(user.id)
    if (again) return again
    throw error
  }
  return toProfile(data)
}

export type UpdateProfileResult =
  | { ok: true; profile: Profile }
  | { ok: false; error: string; nextChangeAt?: string }

// displayName/avatarUrl 갱신. displayName 변경은 24h 1회 제한.
export async function updateProfile(
  user: User,
  patch: { displayName?: string; avatarUrl?: string | null },
): Promise<UpdateProfileResult> {
  const current = await getOrCreateProfile(user)
  const updates: Record<string, unknown> = {}

  if (patch.displayName !== undefined) {
    const name = patch.displayName.trim()
    if (!name) return { ok: false, error: '이름을 입력해주세요' }
    if (name.length > DISPLAY_NAME_MAX) {
      return { ok: false, error: `이름은 ${DISPLAY_NAME_MAX}자 이하로 입력해주세요` }
    }
    if (name !== current.displayName) {
      if (current.nameChangedAt) {
        const elapsed = Date.now() - new Date(current.nameChangedAt).getTime()
        if (elapsed < NAME_CHANGE_COOLDOWN_MS) {
          const nextChangeAt = new Date(
            new Date(current.nameChangedAt).getTime() + NAME_CHANGE_COOLDOWN_MS,
          ).toISOString()
          return { ok: false, error: '이름은 하루에 한 번만 변경할 수 있어요', nextChangeAt }
        }
      }
      updates.display_name = name
      updates.name_changed_at = new Date().toISOString()
    }
  }

  if (patch.avatarUrl !== undefined) {
    updates.avatar_url = patch.avatarUrl
  }

  if (Object.keys(updates).length === 0) {
    return { ok: true, profile: current }
  }

  updates.updated_at = new Date().toISOString()
  const db = getSupabase()
  const { data, error } = await db
    .from('profiles')
    .update(updates)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error || !data) return { ok: false, error: '프로필 저장 중 오류가 발생했어요' }
  return { ok: true, profile: toProfile(data) }
}
