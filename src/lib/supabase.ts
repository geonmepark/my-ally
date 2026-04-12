import { createClient, SupabaseClient } from '@supabase/supabase-js'

// 서버사이드 전용 — service_role key는 절대 클라이언트에 노출하면 안 됩니다.
// 빌드 시점에 env가 없을 수 있으므로 최초 호출 시 lazy 초기화합니다.
let _client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _client
}
