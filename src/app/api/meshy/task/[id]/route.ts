import { NextRequest, NextResponse } from 'next/server'
import { MESHY_BASE, meshyHeaders, meshyGuard } from '@/lib/meshy'

// image→3D 작업 폴링. GET /api/meshy/task/:id
// 상태: PENDING | IN_PROGRESS | SUCCEEDED | FAILED | CANCELED
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const blocked = meshyGuard(req)
  if (blocked) return blocked

  const { id } = await params

  let res: Response
  try {
    res = await fetch(`${MESHY_BASE}/image-to-3d/${id}`, { headers: meshyHeaders() })
  } catch (e) {
    return NextResponse.json({ error: 'Meshy 조회 실패', detail: String(e) }, { status: 502 })
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return NextResponse.json({ error: data?.message ?? 'Meshy 조회 실패' }, { status: res.status })
  }

  return NextResponse.json({
    id: data.id,
    status: data.status,
    progress: data.progress,
    model_urls: data.model_urls,
    thumbnail_url: data.thumbnail_url,
    thumbnail_urls: data.thumbnail_urls,
  })
}
