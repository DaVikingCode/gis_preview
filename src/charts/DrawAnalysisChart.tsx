import { Separator } from '@/components/ui/separator'
import { useMapDataStore } from '@/store/map-data-store'
import { CATEGORY_META, type POICategory } from '@/data/sample-pois'

const ORDER: POICategory[] = ['source', 'aerial', 'underground', 'cabin']

export function DrawAnalysisChart() {
  const stats = useMapDataStore((s) => s.drawStats)
  const km2 = stats.areaKm2
  const ha = km2 * 100

  return (
    <div>
      <div className="text-3xl font-semibold text-foreground tabular-nums">
        {km2 < 1 ? `${ha.toFixed(1)} ha` : `${km2.toFixed(2)} km²`}
      </div>
      <div className="text-xs text-muted-foreground">surface du polygone (Turf)</div>

      <Separator className="my-3" />

      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums text-amber-500">{stats.poiCount}</span>
        <span className="text-xs text-muted-foreground">poste(s) HTA dans la zone</span>
      </div>

      <div className="mt-3 space-y-1.5">
        {ORDER.map((cat) => {
          const n = stats.byCategory[cat]
          if (!n) return null
          const meta = CATEGORY_META[cat]
          return (
            <div key={cat} className="flex items-center gap-2 text-xs">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: meta.color }}
              />
              <span className="flex-1 text-muted-foreground">{meta.label}</span>
              <span className="tabular-nums font-medium">{n}</span>
            </div>
          )
        })}
      </div>

      <p className="text-[11px] text-muted-foreground mt-3">
        {stats.closed
          ? 'Zone fermée. Requête spatiale calculée en direct avec Turf.js.'
          : 'Tracé automatique de la zone en cours…'}
      </p>
    </div>
  )
}
