import { useEffect, useState } from 'react'
import { useTourStore } from '@/store/tour-store'
import { useMapMaybe } from '@/map/MapContext'
import { STEPS } from './steps'
import { Button } from '@/components/ui/button'
import { Bug, ChevronDown, ChevronUp } from 'lucide-react'

type CameraState = {
  lng: number
  lat: number
  pitch: number
  bearing: number
  zoom: number
}

function CameraReadout() {
  const map = useMapMaybe()
  const [cam, setCam] = useState<CameraState | null>(null)

  useEffect(() => {
    if (!map) return
    const update = () => {
      const c = map.getCenter()
      setCam({
        lng: c.lng,
        lat: c.lat,
        pitch: map.getPitch(),
        bearing: map.getBearing(),
        zoom: map.getZoom(),
      })
    }
    update()
    map.on('move', update)
    return () => {
      map.off('move', update)
    }
  }, [map])

  if (!cam) return null

  const rows: [string, string][] = [
    ['Tilt', `${cam.pitch.toFixed(1)}°`],
    ['Lat', cam.lat.toFixed(6)],
    ['Long', cam.lng.toFixed(6)],
    ['Bearing', `${cam.bearing.toFixed(1)}°`],
    ['Zoom', cam.zoom.toFixed(2)],
  ]

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 px-3 py-2 border-t text-xs font-mono tabular-nums">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-2">
          <span className="opacity-60">{label}</span>
          <span>{value}</span>
        </div>
      ))}
    </div>
  )
}

export function DebugPanel() {
  const [open, setOpen] = useState(false)
  const currentStep = useTourStore((s) => s.currentStep)
  const jumpToStep = useTourStore((s) => s.jumpToStep)

  return (
    <div className="debug-panel absolute bottom-4 right-4 max-w-xs" style={{ zIndex: 100101 }}>
      <div className="bg-background/95 backdrop-blur rounded-md border shadow-md">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium"
        >
          <span className="flex items-center gap-2">
            <Bug className="size-3.5" />
            Debug — étape {currentStep + 1}/{STEPS.length}
          </span>
          {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
        <CameraReadout />
        {open && (
          <div className="flex flex-col gap-1 p-2 border-t max-h-[60vh] overflow-y-auto">
            {STEPS.map((s, i) => (
              <Button
                key={s.id}
                size="sm"
                variant={i === currentStep ? 'default' : 'outline'}
                className="justify-start text-xs h-auto py-1.5 px-2 whitespace-normal text-left"
                onClick={() => jumpToStep?.(i)}
                disabled={!jumpToStep}
              >
                <span className="opacity-60 mr-1">{i + 1}.</span> {s.title}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
