import { NextRequest, NextResponse } from 'next/server'
import { meshyGuard } from '@/lib/meshy'

// GLB 등 Meshy 에셋을 같은 출처로 프록시. (assets.meshy.ai가 CORS 헤더를 안 줘서
// 브라우저 <model-viewer>가 직접 fetch하면 차단됨 → 서버 경유로 우회)
// GET /api/meshy/proxy?url=<encoded meshy asset url>
export async function GET(req: NextRequest) {
  const blocked = meshyGuard(req)
  if (blocked) return blocked

  const url = req.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'url 파라미터가 필요해요' }, { status: 400 })

  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    return NextResponse.json({ error: '올바른 url이 아니에요' }, { status: 400 })
  }
  // 오픈 프록시 방지: meshy.ai 도메인만 허용
  if (host !== 'meshy.ai' && !host.endsWith('.meshy.ai')) {
    return NextResponse.json({ error: '허용되지 않은 호스트' }, { status: 403 })
  }

  let upstream: Response
  try {
    upstream = await fetch(url)
  } catch (e) {
    return NextResponse.json({ error: '에셋 다운로드 실패', detail: String(e) }, { status: 502 })
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: `에셋 응답 ${upstream.status}` }, { status: 502 })
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'model/gltf-binary',
      'Cache-Control': 'no-store',
    },
  })
}
