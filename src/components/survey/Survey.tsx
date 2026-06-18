import { cn } from '@/lib/utils'
import { buildContours } from './contour'

// Vocabulaire visuel « feuille de relevé », partagé entre le splash, l'écran de fin,
// le cadre des charts et le panneau de contact. La signature (courbes de niveau) reste
// rare ; les repères de calage et libellés mono assurent la cohésion discrète ailleurs.

// Champ topographique animé. Sans `animate`, les isolignes sont statiques (fond discret).
export function ContourField({
  cx,
  cy,
  radii,
  peakCount = 2,
  squash,
  viewBox = { w: 448, h: 600 },
  animate = true,
  className,
}: {
  cx: number
  cy: number
  radii: number[]
  peakCount?: number
  squash?: number
  viewBox?: { w: number; h: number }
  animate?: boolean
  className?: string
}) {
  const rings = buildContours({ cx, cy, radii, peakCount, squash })
  return (
    <svg
      aria-hidden
      className={cn('pointer-events-none', animate && 'gp-contour', className)}
      viewBox={`0 0 ${viewBox.w} ${viewBox.h}`}
      preserveAspectRatio="xMidYMid slice"
    >
      {rings.map((c, i) => (
        <path
          key={i}
          d={c.d}
          pathLength={1}
          fill="none"
          stroke={c.peak ? '#ffeb04' : '#00b5e1'}
          strokeWidth={c.peak ? 1.3 : 1}
          strokeOpacity={c.peak ? 0.55 : Math.max(0.07, 0.26 - i * 0.022)}
          style={animate ? { animationDelay: `${c.delay}ms` } : undefined}
        />
      ))}
    </svg>
  )
}

// Tailwind a besoin de classes littérales : deux jeux d'offsets statiques.
const CORNER_SETS = {
  2: ['top-2 left-2', 'top-2 right-2', 'bottom-2 left-2', 'bottom-2 right-2'],
  3: ['top-3 left-3', 'top-3 right-3', 'bottom-3 left-3', 'bottom-3 right-3'],
} as const

// Repères de calage : la surface est cadrée comme un tirage de relevé.
export function CalibrationCorners({
  offset = 3,
  tone = 'bg-white/25',
}: {
  offset?: 2 | 3
  tone?: string
}) {
  return (
    <>
      {CORNER_SETS[offset].map((pos, i) => (
        <span
          key={pos}
          aria-hidden
          className={cn('gp-frame pointer-events-none absolute h-3 w-3', pos)}
          style={{ animationDelay: `${280 + i * 40}ms` }}
        >
          <span className={cn('absolute top-1/2 left-0 h-px w-full -translate-y-1/2', tone)} />
          <span className={cn('absolute top-0 left-1/2 h-full w-px -translate-x-1/2', tone)} />
        </span>
      ))}
    </>
  )
}

// Libellé mono = lecture d'instrument (coordonnées du relevé).
export function CoordLabel({
  lat,
  lon,
  className,
}: {
  lat: number
  lon: number
  className?: string
}) {
  return (
    <span className={cn('font-mono tabular-nums', className)}>
      {lat}° N · {lon}° E
    </span>
  )
}

// Légende calée sur les primitives de données SIG — ce qu'une vraie légende cartographique
// montre, et qui couvre les capacités parcourues dans la visite.
const GIS_PRIMITIVES = [
  {
    name: 'Lignes',
    sub: 'réseaux, mesures',
    glyph: (
      <g stroke="#00b5e1" strokeWidth={1.6} fill="none">
        <path d="M1 9 L19 4" strokeLinecap="round" />
        <path d="M1 11 L1 7 M19 6 L19 2" />
      </g>
    ),
  },
  {
    name: 'Polygones',
    sub: 'bâtiments, zones',
    glyph: (
      <rect
        x={2}
        y={2}
        width={16}
        height={9}
        fill="rgba(0,181,225,0.16)"
        stroke="#00b5e1"
        strokeWidth={1.4}
      />
    ),
  },
  {
    name: 'Points',
    sub: 'POI, capteurs',
    glyph: (
      <g>
        <circle
          cx={10}
          cy={6.5}
          r={5.2}
          fill="none"
          stroke="#00b5e1"
          strokeWidth={1.2}
          opacity={0.5}
        />
        <circle cx={10} cy={6.5} r={2.4} fill="#00b5e1" />
      </g>
    ),
  },
  {
    name: 'Raster',
    sub: 'fonds, heatmaps',
    glyph: (
      <g>
        <defs>
          <linearGradient id="gp-legend-raster" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#00b5e1" stopOpacity={0.15} />
            <stop offset="1" stopColor="#ffeb04" stopOpacity={0.7} />
          </linearGradient>
        </defs>
        <rect x={2} y={2} width={16} height={9} rx={1} fill="url(#gp-legend-raster)" />
      </g>
    ),
  },
  {
    name: '3D',
    sub: 'bâtiments, relief',
    glyph: (
      <g stroke="#00b5e1" strokeWidth={1.2} strokeLinejoin="round">
        <path d="M4 5 L4 11 L11 11 L11 5 Z" fill="rgba(0,181,225,0.16)" />
        <path d="M4 5 L7 2 L14 2 L11 5 Z" fill="rgba(0,181,225,0.3)" />
        <path d="M11 5 L14 2 L14 8 L11 11 Z" fill="rgba(0,181,225,0.1)" />
      </g>
    ),
  },
] as const

export function PrimitivesLegend({ className }: { className?: string }) {
  return (
    <ul className={cn('grid grid-cols-2 gap-x-5 gap-y-2.5', className)}>
      {GIS_PRIMITIVES.map((item) => (
        <li key={item.name} className="flex items-center gap-2.5">
          <svg width={20} height={13} viewBox="0 0 20 13" className="shrink-0">
            {item.glyph}
          </svg>
          <span className="flex items-baseline gap-1.5 overflow-hidden">
            <span className="text-[13px] font-medium text-white/85">{item.name}</span>
            <span className="truncate text-[11px] text-white/35">{item.sub}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
