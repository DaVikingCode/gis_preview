import { useRef } from 'react'
import { CATEGORY_META, type POIProps } from '@/data/sample-pois'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CalendarDays, MapPin, X, Zap } from 'lucide-react'
import { useMapDataStore } from '@/store/map-data-store'
import { usePoiPopupReveal } from '@/hooks/animations/usePoiPopupReveal'
import { POIStatusStepper } from './POIStatusStepper'

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return DATE_FMT.format(d)
}

export function POIPopup({ poi, onClose }: { poi: POIProps; onClose: () => void }) {
  const meta = CATEGORY_META[poi.category]
  const poiKey = String(poi.id)
  const status = useMapDataStore((s) => s.poiStatus[poiKey] ?? 'todo')
  const rootRef = useRef<HTMLDivElement>(null)
  const haloRef = useRef<HTMLDivElement>(null)
  const anomalyTone =
    poi.anomalies === 0
      ? 'text-emerald-600'
      : poi.anomalies <= 1
        ? 'text-amber-600'
        : 'text-red-600'

  usePoiPopupReveal(rootRef, haloRef)

  return (
    <div
      ref={rootRef}
      className="relative w-[min(20rem,calc(100vw-2rem))]"
      style={{ transformOrigin: 'center bottom' }}
    >
      <div
        ref={haloRef}
        aria-hidden
        className="pointer-events-none absolute -inset-1 rounded-2xl"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(200,41,9,0.35), rgba(200,41,9,0) 70%)',
          filter: 'blur(6px)',
        }}
      />
      <div
        className="relative overflow-hidden rounded-xl border-2 bg-card text-card-foreground"
        style={{
          borderColor: 'color-mix(in oklab, #C82909 45%, transparent)',
          boxShadow:
            '0 0 0 1px rgba(200,41,9,0.18), 0 20px 50px -15px rgba(200,41,9,0.45), 0 8px 24px -10px rgba(0,0,0,0.35)',
        }}
      >
        {poi.photo && (
          <div className="relative h-28 w-full">
            <img
              src={poi.photo}
              alt={poi.name}
              draggable={false}
              className="h-full w-full object-cover object-center"
            />
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onClose}
              aria-label="Fermer"
              className="absolute right-2 top-2 rounded-full bg-black/40 text-white backdrop-blur-md hover:bg-black/60 hover:text-white"
            >
              <X />
            </Button>
          </div>
        )}

        <div className="flex items-start justify-between gap-2 px-4 pt-3">
          <div className="min-w-0">
            <Badge variant="outline" className="gap-1.5 font-normal">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: meta.color }}
              />
              {meta.label}
            </Badge>
            <h3 className="text-base font-semibold mt-2 leading-tight tabular-nums">{poi.name}</h3>
            <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPin className="size-3" /> {poi.commune}
            </div>
          </div>
          {!poi.photo && (
            <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label="Fermer">
              <X />
            </Button>
          )}
        </div>

        <p className="px-4 mt-2 text-xs text-muted-foreground leading-relaxed">{poi.notes}</p>

        <div className="grid grid-cols-3 gap-1.5 px-4 mt-3 pb-3">
          <div className="rounded-md border bg-background/40 px-2 py-1.5">
            <div className="flex items-center gap-1 text-[9px] text-muted-foreground uppercase tracking-wide">
              <Zap className="size-2.5" /> Tension
            </div>
            <div className="text-[12px] font-semibold tabular-nums mt-0.5">{poi.voltage}</div>
          </div>
          <div className="rounded-md border bg-background/40 px-2 py-1.5">
            <div className="flex items-center gap-1 text-[9px] text-muted-foreground uppercase tracking-wide">
              <AlertTriangle className="size-2.5" /> Anom.
            </div>
            <div className={'text-[12px] font-semibold tabular-nums mt-0.5 ' + anomalyTone}>
              {poi.anomalies}
            </div>
          </div>
          <div className="rounded-md border bg-background/40 px-2 py-1.5">
            <div className="flex items-center gap-1 text-[9px] text-muted-foreground uppercase tracking-wide">
              <CalendarDays className="size-2.5" /> Visite
            </div>
            <div className="text-[11px] font-semibold tabular-nums mt-0.5">
              {formatDate(poi.lastInspection)}
            </div>
          </div>
        </div>

        <POIStatusStepper status={status} />
      </div>
    </div>
  )
}
