import { NextRequest, NextResponse } from 'next/server'
import { MESHY_BASE, meshyHeaders, meshyGuard } from '@/lib/meshy'

// image→3D 작업 생성. body: { imageDataUri, ai_model?, should_texture?, pose_mode? }
// imageDataUri는 data:image/...;base64,... 형식 (클라이언트에서 파일을 읽어 전송).
export async function POST(req: NextRequest) {
  const blocked = meshyGuard(req)
  if (blocked) return blocked

  const body = await req.json().catch(() => ({}))
  const imageUrl: string | undefined = body.imageDataUri || body.image_url
  if (!imageUrl) {
    return NextResponse.json({ error: 'imageDataUri가 필요해요' }, { status: 400 })
  }

  let res: Response
  try {
    res = await fetch(`${MESHY_BASE}/image-to-3d`, {
      method: 'POST',
      headers: meshyHeaders(),
      body: JSON.stringify({
        image_url: imageUrl,
        ai_model: body.ai_model ?? 'latest',
        should_texture: body.should_texture ?? true,
        multi_view_thumbnails: true,
        ...(body.pose_mode ? { pose_mode: body.pose_mode } : {}),
      }),
    })
  } catch (e) {
    return NextResponse.json({ error: 'Meshy 요청 실패', detail: String(e) }, { status: 502 })
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return NextResponse.json(
      { error: data?.message ?? 'Meshy 생성 실패', detail: data },
      { status: res.status },
    )
  }
  // 성공 응답: { "result": "<task_id>" }
  return NextResponse.json({ taskId: data.result })
}
