// Meshy 3D 생성 API 공용 헬퍼 (서버 전용)
// MESHY_API_KEY는 절대 클라이언트로 노출하지 않는다. 모든 호출은 서버 라우트에서만.
// 참고: docs.meshy.ai/en/api/image-to-3d

export const MESHY_BASE = 'https://api.meshy.ai/openapi/v1'

export function meshyHeaders(): Record<string, string> {
  const key = process.env.MESHY_API_KEY
  if (!key) throw new Error('MESHY_API_KEY 환경변수가 설정되지 않았어요')
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }
}

// 이 라우트들은 크레딧을 소모할 수 있으므로 실배포에서는 무단 호출을 막는다.
// 로컬(dev)에서는 그냥 통과. 프로덕션이면 x-admin-secret 헤더가 ADMIN_SECRET과 일치해야 한다.
export function meshyGuard(req: Request): Response | null {
  if (process.env.NODE_ENV === 'production') {
    if (req.headers.get('x-admin-secret') !== process.env.ADMIN_SECRET) {
      return new Response('Not available', { status: 403 })
    }
  }
  return null
}
