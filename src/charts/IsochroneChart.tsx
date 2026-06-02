import { Separator } from '@/components/ui/separator'
import { useMapDataStore } from '@/store/map-data-store'

const BAND_COLOR: Record<number, string> = {
  5: '#fb923c',
  10: '#fcd34d',
  15: '#86efac',
}

export function IsochroneChart() {
  const stats = useMapDataStore((s) => s.isochroneStats)
  const total = stats.length ? stats[stats.length - 1].poiCount : 0

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums text-foreground">{total}</span>
        <span className="text-xs text-muted-foreground">postes joignables en 15 min</span>
      </div>

      <Separator className="my-3" />

      <div className="space-y-2">
        {stats.map((b) => (
          <div key={b.minutes} className="flex items-center gap-2 text-xs">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: BAND_COLOR[b.minutes] }}
            />
            <span className="w-12 text-muted-foreground">{b.minutes} min</span>
            <span className="flex-1 tabular-nums text-muted-foreground">
              {b.areaKm2.toFixed(0)} km²
            </span>
            <span className="tabular-nums font-medium">{b.poiCount} postes</span>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground mt-3">
        Zones atteignables par temps de trajet — un appui pour planifier vos tournées.
      </p>
    </div>
  )
}
