import { RotateCcw } from 'lucide-react'
import { useMapDataStore, type PointCloudColorMode } from '@/store/map-data-store'
import { classInfo } from '@/map/layers/pointCloud'

// Panneau « Nuage de points · LiDAR » (Auxonne) : stats du scan + sélecteur de
// colorisation (Altitude / RGB / Classification) qui déclenche le balayage de scan, et
// légende construite depuis l'histogramme de classes du manifest (schéma Enedis élagage :
// sol/végétation, ligne électrique en rouge, niveaux d'urgence U0→U4). La palette vient
// de `classInfo` (partagée avec le shader). « Rejouer » relance la séquence.
const MODES: { id: PointCloudColorMode; label: string }[] = [
  { id: 'altitude', label: 'Altitude' },
  { id: 'rgb', label: 'RGB' },
  { id: 'classification', label: 'Classification' },
]

const rgb01 = (c: [number, number, number]) =>
  `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`

export function PointCloudCard() {
  const stats = useMapDataStore((s) => s.pointCloudStats)
  const classes = useMapDataStore((s) => s.pointCloudClasses)
  const mode = useMapDataStore((s) => s.pointCloudColorMode)
  const setColor = useMapDataStore((s) => s.pointCloudSetColor)
  const replay = useMapDataStore((s) => s.pointCloudReplay)

  const pts = stats ? formatPoints(stats.count) : '—'
  const footprint = stats ? `${stats.footprintM[0]} × ${stats.footprintM[1]} m` : '—'
  const height = stats ? `${stats.zRangeM[1]} m` : '—'

  // Légende : on regroupe les codes par libellé (classes inconnues → « Autre »), trié
  // selon l'ordre défini dans CLASS_INFO.
  const total = classes.reduce((s, c) => s + c.count, 0) || 1
  const legendMap = new Map<
    string,
    { color: [number, number, number]; order: number; count: number }
  >()
  for (const c of classes) {
    const info = classInfo(c.code)
    const prev = legendMap.get(info.label)
    if (prev) prev.count += c.count
    else legendMap.set(info.label, { color: info.color, order: info.order, count: c.count })
  }
  const legend = [...legendMap.entries()]
    .map(([label, v]) => ({ label, color: v.color, order: v.order, pct: (100 * v.count) / total }))
    .sort((a, b) => a.order - b.order)

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">
              {pts}
            </span>
            <span className="text-sm font-medium text-muted-foreground">points</span>
          </div>
          <div className="hidden text-[11px] uppercase tracking-wide text-muted-foreground sm:block">
            Points affichés
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
            LiDAR
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4">
        <Stat label="Emprise" value={footprint} />
        <Stat label="Élévation" value={height} />
      </div>

      <div className="mt-3 sm:mt-4">
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Colorisation
        </div>
        <div className="flex gap-1 rounded-lg border border-border/60 bg-muted/30 p-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setColor?.(m.id)}
              disabled={!setColor}
              className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
                mode === m.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode === 'altitude' && (
          <>
            <div
              className="mt-2 h-2 w-full rounded-full"
              style={{
                background:
                  'linear-gradient(90deg, rgb(48,18,130), rgb(29,158,195), rgb(93,201,99), rgb(240,170,47), rgb(232,90,70))',
              }}
            />
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>bas</span>
              <span>haut</span>
            </div>
          </>
        )}

        {mode === 'rgb' && (
          <div className="mt-1.5 text-[10px] text-muted-foreground">
            Vraie couleur (RGB capté par le scan LiDAR)
          </div>
        )}

        {mode === 'classification' && (
          // Légende masquée sur mobile (gain de place) ; visible dès sm.
          <ul className="mt-2 hidden flex-col gap-1 text-xs sm:flex">
            {legend.map((c) => (
              <li key={c.label} className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                  style={{ background: rgb01(c.color) }}
                />
                <span className="flex-1 text-muted-foreground">{c.label}</span>
                <span className="font-medium tabular-nums text-foreground">
                  {c.pct.toFixed(c.pct < 1 ? 1 : 0)} %
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 flex items-center justify-end border-t border-border/60 pt-2 sm:mt-4 sm:justify-between sm:pt-3">
        <span className="hidden text-[11px] text-muted-foreground sm:inline">
          Scan LiDAR · Auxonne (UTM 31N)
        </span>
        <button
          type="button"
          onClick={() => replay?.()}
          disabled={!replay}
          className="flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        >
          <RotateCcw className="size-3" /> Rejouer
        </button>
      </div>
    </div>
  )
}

// 9475959 → « 9,48 M » ; < 1 M → « 946 k ».
function formatPoints(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace('.', ',')} M`
  if (n >= 1_000) return `${Math.round(n / 1_000)} k`
  return String(n)
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 px-2 py-2 text-center">
      <div className="text-sm font-semibold tabular-nums text-foreground">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  )
}
