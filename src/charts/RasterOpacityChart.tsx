import { Slider } from '@/components/ui/slider'
import { useMapDataStore } from '@/store/map-data-store'

export function RasterOpacityChart() {
  const opacity = useMapDataStore((s) => s.rasterOpacity)
  const setOpacity = useMapDataStore((s) => s.setRasterOpacity)
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Opacité IGN</div>
      <div className="text-3xl font-semibold tabular-nums mb-3">{Math.round(opacity * 100)}%</div>
      <Slider
        min={0}
        max={1}
        step={0.01}
        value={[opacity]}
        onValueChange={([v]) => setOpacity(v)}
      />
      <p className="text-[11px] text-muted-foreground mt-3">
        Couche WMTS orthophoto IGN Géoportail superposée à OpenFreeMap.
      </p>
    </div>
  )
}
