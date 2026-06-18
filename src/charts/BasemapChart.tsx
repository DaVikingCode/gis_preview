import { cn } from '@/lib/utils'
import { useTourStore } from '@/store/tour-store'
import { BASEMAPS, type BasemapId } from '@/map/basemaps'
import positronPrev from '@/assets/layer-previews/positron.webp'
import libertyPrev from '@/assets/layer-previews/liberty.webp'
import brightPrev from '@/assets/layer-previews/bright.webp'
import satellitePrev from '@/assets/layer-previews/sattelite.webp'

// Les 4 fonds présentés (BasemapId en compte d'autres, hors démo).
const IDS = ['positron', 'liberty', 'bright', 'satellite'] as const satisfies BasemapId[]
const PREVIEWS: Record<(typeof IDS)[number], string> = {
  positron: positronPrev,
  liberty: libertyPrev,
  bright: brightPrev,
  satellite: satellitePrev,
}

export function BasemapChart() {
  const current = useTourStore((s) => s.basemap)
  return (
    <div className="space-y-3">
      {/* Vraies vignettes plutôt que des badges abstraits : on voit le fond avant de basculer. */}
      <div className="grid grid-cols-2 gap-2">
        {IDS.map((id) => {
          const active = id === current
          return (
            <div
              key={id}
              className={cn(
                'relative overflow-hidden rounded-md transition',
                active ? 'ring-2 ring-[#ffeb04]' : 'ring-1 ring-border/60',
              )}
            >
              <img
                src={PREVIEWS[id]}
                alt=""
                loading="lazy"
                className="aspect-[16/10] w-full object-cover"
              />
              <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/80 to-transparent px-1.5 pt-4 pb-1 text-[10px] font-medium text-white">
                {BASEMAPS[id].label}
                {active && <span className="size-1.5 shrink-0 rounded-full bg-[#ffeb04]" />}
              </span>
            </div>
          )
        })}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Quatre fonds disponibles : trois styles vectoriels OpenFreeMap et une couche raster
        satellite Esri. Utilise les boutons en haut à gauche pour basculer.
      </p>
    </div>
  )
}
