'use client'

import React, { useEffect, useRef, useState } from 'react'

// ─────────────────────────────────────────────────────────────
// Meshy Lab — 셀카 → 3D 캐릭터 품질 평가용 플레이그라운드 (dev 도구)
// 사진 업로드 → image→3D 생성 → 폴링 → model-viewer로 360° 회전 → 작업 기록 갤러리
// 백엔드 라우트(/api/meshy/*)가 MESHY_API_KEY로 Meshy를 호출. 키는 브라우저에 안 옴.
// ─────────────────────────────────────────────────────────────

const HISTORY_KEY = 'meshy-lab-history-v1'
const POLL_MS = 3000

// Meshy 에셋은 CORS 차단되므로 백엔드 프록시 경유로 로드
function proxied(u?: string): string | undefined {
  return u ? `/api/meshy/proxy?url=${encodeURIComponent(u)}` : undefined
}

type HistoryItem = {
  taskId: string
  inputThumb: string // 다운스케일된 입력 이미지 (localStorage 용량 절약)
  glb?: string
  thumbnail?: string
  status: string
  createdAt: number
}

// 파일 → 풀해상도 data URI (Meshy 전송용)
function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// 입력 이미지를 작은 썸네일 data URI로 축소 (기록 보관용; localStorage 쿼터 보호)
async function downscale(dataUri: string, max = 256): Promise<string> {
  const img = document.createElement('img')
  await new Promise<void>((res, rej) => {
    img.onload = () => res()
    img.onerror = rej
    img.src = dataUri
  })
  const scale = Math.min(1, max / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.7)
}

// model-viewer 커스텀 엘리먼트 (TS intrinsic 타입 회피 위해 createElement 사용)
function ModelViewer({ src, poster }: { src: string; poster?: string }) {
  return React.createElement('model-viewer', {
    src,
    poster,
    'camera-controls': true,
    'auto-rotate': true,
    'shadow-intensity': '1',
    exposure: '1',
    style: {
      width: '100%',
      height: 480,
      background: '#15151a',
      borderRadius: 12,
      display: 'block',
    },
  })
}

type Staged = { id: string; name: string; dataUri: string; busy: boolean; progress: number; error?: string }

export default function MeshyLabPage() {
  const [staged, setStaged] = useState<Staged[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [viewerGlb, setViewerGlb] = useState<string | undefined>()
  const [viewerPoster, setViewerPoster] = useState<string | undefined>()
  const fileRef = useRef<HTMLInputElement>(null)

  // model-viewer 커스텀 엘리먼트 로드 (CDN module script 직접 주입)
  useEffect(() => {
    if (customElements.get('model-viewer')) return
    const s = document.createElement('script')
    s.type = 'module'
    s.src = 'https://unpkg.com/@google/model-viewer@4.1.0/dist/model-viewer.min.js'
    document.head.appendChild(s)
  }, [])

  // 기록 로드/저장
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY)
      if (raw) setHistory(JSON.parse(raw))
    } catch {}
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
    } catch {}
  }, [history])

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const next: Staged[] = []
    for (const f of files) {
      const dataUri = await fileToDataUri(f)
      next.push({ id: `${Date.now()}-${f.name}`, name: f.name, dataUri, busy: false, progress: 0 })
    }
    setStaged((s) => [...next, ...s])
    if (fileRef.current) fileRef.current.value = ''
  }

  function updateStaged(id: string, patch: Partial<Staged>) {
    setStaged((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  }

  async function generate(item: Staged) {
    updateStaged(item.id, { busy: true, progress: 0, error: undefined })
    try {
      const createRes = await fetch('/api/meshy/image-to-3d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageDataUri: item.dataUri }),
      })
      const created = await createRes.json()
      if (!createRes.ok) throw new Error(created.error || '생성 요청 실패')
      const taskId: string = created.taskId

      const inputThumb = await downscale(item.dataUri)
      // 폴링
      while (true) {
        await new Promise((r) => setTimeout(r, POLL_MS))
        const r = await fetch(`/api/meshy/task/${taskId}`)
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || '조회 실패')
        updateStaged(item.id, { progress: d.progress ?? 0 })
        if (d.status === 'SUCCEEDED') {
          const glb: string | undefined = d.model_urls?.glb
          const thumbnail: string | undefined = d.thumbnail_url
          setHistory((h) => [
            { taskId, inputThumb, glb, thumbnail, status: d.status, createdAt: Date.now() },
            ...h,
          ])
          if (glb) {
            setViewerGlb(proxied(glb))
            setViewerPoster(thumbnail)
          }
          updateStaged(item.id, { busy: false, progress: 100 })
          break
        }
        if (d.status === 'FAILED' || d.status === 'CANCELED') {
          throw new Error(`작업 ${d.status}`)
        }
      }
    } catch (e) {
      updateStaged(item.id, { busy: false, error: String(e instanceof Error ? e.message : e) })
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24, color: '#e6e6e6' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Meshy Lab</h1>
      <p style={{ color: '#9a9aa5', marginBottom: 20, fontSize: 14 }}>
        셀카 → 3D 캐릭터 품질 테스트. 사진을 올리고 “3D 생성”을 누르면 Meshy가 모델을 만들고,
        아래 뷰어에서 드래그로 360° 돌려볼 수 있어요. (dev 전용)
      </p>

      {/* 뷰어 */}
      <div style={{ marginBottom: 24 }}>
        {viewerGlb ? (
          <ModelViewer src={viewerGlb} poster={viewerPoster} />
        ) : (
          <div
            style={{
              height: 480,
              background: '#15151a',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6a6a75',
            }}
          >
            아직 생성된 3D 모델이 없어요
          </div>
        )}
      </div>

      {/* 업로드 */}
      <div style={{ marginBottom: 16 }}>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg"
          multiple
          onChange={onPick}
          style={{ color: '#e6e6e6' }}
        />
      </div>

      {/* 스테이징된 업로드 */}
      {staged.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 12,
            marginBottom: 28,
          }}
        >
          {staged.map((s) => (
            <div key={s.id} style={{ background: '#1d1d24', borderRadius: 10, padding: 10 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.dataUri}
                alt={s.name}
                style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 6 }}
              />
              <div style={{ fontSize: 11, color: '#9a9aa5', margin: '6px 0', wordBreak: 'break-all' }}>
                {s.name}
              </div>
              {s.error && <div style={{ fontSize: 11, color: '#ff6b6b' }}>{s.error}</div>}
              <button
                disabled={s.busy}
                onClick={() => generate(s)}
                style={{
                  width: '100%',
                  padding: '8px 0',
                  borderRadius: 6,
                  border: 'none',
                  background: s.busy ? '#3a3a44' : '#5b8cff',
                  color: '#fff',
                  fontSize: 13,
                  cursor: s.busy ? 'default' : 'pointer',
                }}
              >
                {s.busy ? `생성 중… ${s.progress}%` : '3D 생성'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 작업 기록 갤러리 */}
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>작업 기록</h2>
      {history.length === 0 ? (
        <p style={{ color: '#6a6a75', fontSize: 13 }}>아직 기록이 없어요.</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: 12,
          }}
        >
          {history.map((h) => (
            <div
              key={h.taskId}
              onClick={() => h.glb && (setViewerGlb(proxied(h.glb)), setViewerPoster(h.thumbnail))}
              style={{
                background: '#1d1d24',
                borderRadius: 10,
                padding: 8,
                cursor: h.glb ? 'pointer' : 'default',
              }}
            >
              <div style={{ display: 'flex', gap: 6 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={h.inputThumb}
                  alt="input"
                  title="입력 사진"
                  style={{ width: '50%', height: 80, objectFit: 'cover', borderRadius: 5 }}
                />
                {h.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={h.thumbnail}
                    alt="result"
                    title="3D 결과 썸네일"
                    style={{ width: '50%', height: 80, objectFit: 'cover', borderRadius: 5 }}
                  />
                ) : (
                  <div style={{ width: '50%', height: 80, background: '#15151a', borderRadius: 5 }} />
                )}
              </div>
              <div style={{ fontSize: 10, color: '#6a6a75', marginTop: 6 }}>
                {new Date(h.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
