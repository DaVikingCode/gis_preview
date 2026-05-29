import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useMapDataStore } from '@/store/map-data-store'
import { useTourStore } from '@/store/tour-store'

export function MeasureChart() {
  const pts = useMapDataStore((s) => s.measurePoints)
  const km = useMapDataStore((s) => s.measureLengthKm)
  const done = useTourStore((s) => s.measureDone)
  return (
    <div>
      <div className="text-3xl font-semibold text-foreground tabular-nums">
        {km < 1 ? `${(km * 1000).toFixed(0)} m` : `${km.toFixed(2)} km`}
      </div>
      <div className="text-xs text-muted-foreground">périmètre</div>
      <Separator className="my-3" />
      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Points</div>
      <ScrollArea className="h-36 pr-2">
        <ol className="text-xs space-y-0.5">
          {pts.length === 0 && <li className="text-muted-foreground italic">Tracé automatique…</li>}
          {pts.map((p, i) => (
            <li key={i} className="tabular-nums">
              {i + 1}. {p.lng.toFixed(4)}, {p.lat.toFixed(4)}
            </li>
          ))}
        </ol>
      </ScrollArea>
      <p className="text-[11px] text-muted-foreground mt-2">
        {done ? 'Périmètre du pâté de maison.' : 'Tracé automatique du périmètre…'}
      </p>
    </div>
  )
}
