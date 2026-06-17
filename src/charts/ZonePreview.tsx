import { CATEGORY_COLORS } from '@/map/layers/vectorStyled'
import type { VectorCategory } from '@/data/sample-vectors'

// Vignette SVG d'une zone (anneau de polygone normalisé). Extrait de DataTablePanel pour
// être importable SANS tirer Recharts : la modale du catalogue de couches (eager) s'en
// sert, alors que DataTablePanel (avec Recharts) reste en chunk lazy séparé.
export function ZonePreview({
  ring,
  category,
}: {
  ring: [number, number][]
  category: VectorCategory
}) {
  const color = CATEGORY_COLORS[category]
  const xs = ring.map((p) => p[0])
  const ys = ring.map((p) => p[1])
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const spanX = Math.max(...xs) - minX || 1
  const spanY = Math.max(...ys) - minY || 1
  const span = Math.max(spanX, spanY)
  const SIZE = 36
  const PAD = 4
  const inner = SIZE - PAD * 2
  const points = ring
    .map(([lng, lat]) => {
      const x = PAD + ((lng - minX + (span - spanX) / 2) / span) * inner
      const y = PAD + (1 - (lat - minY + (span - spanY) / 2) / span) * inner
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="rounded-md border border-border/60 bg-background/40"
      aria-hidden
    >
      <polygon
        points={points}
        fill={color}
        fillOpacity={0.35}
        stroke={color}
        strokeWidth={1.25}
        strokeLinejoin="round"
      />
    </svg>
  )
}
