/**
 * McHead — 마인크래프트 스타일 8×8 픽셀 아트 캐릭터 헤드
 *
 * 각 픽셀은 SVG <rect>로 렌더링되어 완전한 픽셀 아트 룩을 보장합니다.
 * image-rendering: pixelated 적용으로 흐림 없음.
 */

type Row = readonly string[] // 8개 컬러 hex 문자열

// ── 색상 팔레트 상수 ──────────────────────────────────────────
const SK = '#F5CBA7' // 피부색 (skin)
const EY = '#1A1A1A' // 눈
const MT = '#7A2020' // 입
const __ = '#00000000' // 투명 (미사용 영역)

// ── 결이 (판사) — 흰 가발 + 네이비 법복 + 금장 ───────────────
const JUDGE_PIXELS: readonly Row[] = [
  ['#E0E0E0','#E0E0E0','#E0E0E0','#E0E0E0','#E0E0E0','#E0E0E0','#E0E0E0','#E0E0E0'],
  ['#C8C8C8','#E0E0E0','#E0E0E0','#E0E0E0','#E0E0E0','#E0E0E0','#E0E0E0','#C8C8C8'],
  [SK,       SK,       SK,       SK,       SK,       SK,       SK,       SK      ],
  [SK,       EY,       EY,       SK,       SK,       EY,       EY,       SK      ],
  [SK,       SK,       SK,       SK,       SK,       SK,       SK,       SK      ],
  [SK,       SK,       MT,       MT,       MT,       MT,       SK,       SK      ],
  ['#1E3A5F','#1E3A5F','#FFD700','#1E3A5F','#1E3A5F','#FFD700','#1E3A5F','#1E3A5F'],
  ['#1E3A5F','#1E3A5F','#1E3A5F','#1E3A5F','#1E3A5F','#1E3A5F','#1E3A5F','#1E3A5F'],
] as const

// ── 당사자 A — 갈색 머리 + 파란 옷 ──────────────────────────
const CHAR_A_PIXELS: readonly Row[] = [
  ['#5C3A1A','#5C3A1A','#5C3A1A','#5C3A1A','#5C3A1A','#5C3A1A','#5C3A1A','#5C3A1A'],
  ['#3A1C00','#5C3A1A','#5C3A1A','#5C3A1A','#5C3A1A','#5C3A1A','#5C3A1A','#3A1C00'],
  [SK,       SK,       SK,       SK,       SK,       SK,       SK,       SK      ],
  [SK,       EY,       EY,       SK,       SK,       EY,       EY,       SK      ],
  [SK,       SK,       SK,       SK,       SK,       SK,       SK,       SK      ],
  [SK,       SK,       MT,       MT,       MT,       SK,       SK,       SK      ],
  ['#2563EB','#2563EB','#2563EB','#2563EB','#2563EB','#2563EB','#2563EB','#2563EB'],
  ['#1D4ED8','#1D4ED8','#1D4ED8','#1D4ED8','#1D4ED8','#1D4ED8','#1D4ED8','#1D4ED8'],
] as const

// ── 당사자 B — 검은 머리 + 빨간 옷 ──────────────────────────
const CHAR_B_PIXELS: readonly Row[] = [
  ['#1A1A1A','#1A1A1A','#1A1A1A','#1A1A1A','#1A1A1A','#1A1A1A','#1A1A1A','#1A1A1A'],
  ['#080808','#1A1A1A','#1A1A1A','#1A1A1A','#1A1A1A','#1A1A1A','#1A1A1A','#080808'],
  [SK,       SK,       SK,       SK,       SK,       SK,       SK,       SK      ],
  [SK,       EY,       EY,       SK,       SK,       EY,       EY,       SK      ],
  [SK,       SK,       SK,       SK,       SK,       SK,       SK,       SK      ],
  [SK,       SK,       MT,       MT,       MT,       SK,       SK,       SK      ],
  ['#DC2626','#DC2626','#DC2626','#DC2626','#DC2626','#DC2626','#DC2626','#DC2626'],
  ['#B91C1C','#B91C1C','#B91C1C','#B91C1C','#B91C1C','#B91C1C','#B91C1C','#B91C1C'],
] as const

export type HeadType = 'judge' | 'A' | 'B'

const PIXEL_MAP: Record<HeadType, readonly Row[]> = {
  judge: JUDGE_PIXELS,
  A: CHAR_A_PIXELS,
  B: CHAR_B_PIXELS,
}

interface McHeadProps {
  type: HeadType
  /** 출력 크기 (px). 8의 배수 권장. 기본값 64 */
  size?: number
  /** CSS class */
  className?: string
}

export function McHead({ type, size = 64, className }: McHeadProps) {
  const pixels = PIXEL_MAP[type]
  const cellSize = size / 8

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 8 8"
      style={{ imageRendering: 'pixelated', display: 'block' }}
      className={className}
      aria-hidden
    >
      {pixels.map((row, y) =>
        row.map((color, x) =>
          color && color !== __ ? (
            <rect key={`${y}-${x}`} x={x} y={y} width={1} height={1} fill={color} />
          ) : null,
        ),
      )}
    </svg>
  )
}

// 3D 틸트가 적용된 마인크래프트 헤드 (CSS perspective)
export function McHead3D({ type, size = 64 }: McHeadProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        filter: 'drop-shadow(2px 4px 0 rgba(0,0,0,0.35))',
        transform: 'perspective(120px) rotateY(-8deg) rotateX(4deg)',
        transformOrigin: 'center center',
      }}
    >
      <McHead type={type} size={size} />
    </div>
  )
}
