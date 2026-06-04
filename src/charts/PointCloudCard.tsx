import { useMapDataStore } from '@/store/map-data-store'

// Panneau « Nuage de points · LiDAR » : statistiques du scan affiché (nombre de
// points, emprise au sol, amplitude d'élévation) lues depuis le store, alimentées
// par pointCloud.ts une fois le binaire pré-cuit chargé. La barre de couleur
// rappelle la rampe d'altitude utilisée pour colorier le nuage.
export function PointCloudCard() {
  const stats = useMapDataStore((s) => s.pointCloudStats)
  const pts = stats ? formatPoints(stats.count) : '—'
  const footprint = stats ? `${stats.footprintM[0]} × ${stats.footprintM[1]} m` : '—'
  const height = stats ? `${stats.zRangeM[1]} m` : '—'

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-semibold tabular-nums text-foreground">{pts}</span>
            <span className="text-sm font-medium text-muted-foreground">points</span>
          </div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
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

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Stat label="Emprise" value={footprint} />
        <Stat label="Élévation" value={height} />
      </div>

      <div className="mt-3">
        <div
          className="h-2 w-full rounded-full"
          style={{
            background:
              'linear-gradient(90deg, rgb(48,18,130), rgb(29,158,195), rgb(93,201,99), rgb(240,170,47), rgb(232,90,70))',
          }}
        />
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>bas</span>
          <span>haut</span>
        </div>
      </div>

      <p className="mt-3 hidden text-[11px] text-muted-foreground sm:block">
        Scan LiDAR (.laz) colorisé par altitude, rendu via three.js dans le contexte WebGL de la
        carte.
      </p>
    </div>
  )
}

// 946265 → « 0,95 M » ; < 1 M → « 946 k ».
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
