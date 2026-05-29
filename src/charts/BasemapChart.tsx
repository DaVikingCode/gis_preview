import { Badge } from '@/components/ui/badge'
import { useTourStore } from '@/store/tour-store'
import { BASEMAPS, type BasemapId } from '@/map/basemaps'

const IDS: BasemapId[] = ['positron', 'liberty', 'bright', 'satellite']

export function BasemapChart() {
  const current = useTourStore((s) => s.basemap)
  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Fond actif</div>
        <div className="text-2xl font-semibold">{BASEMAPS[current].label}</div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {IDS.map((id) => (
          <Badge key={id} variant={id === current ? 'default' : 'outline'}>
            {BASEMAPS[id].label}
          </Badge>
        ))}
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Quatre fonds disponibles : trois styles vectoriels OpenFreeMap et une couche raster
        satellite Esri. Utilise les boutons en haut à gauche pour basculer.
      </p>
    </div>
  )
}
