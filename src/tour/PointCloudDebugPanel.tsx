import { useState } from 'react'
import { useTourStore } from '@/store/tour-store'
import { useMapDataStore } from '@/store/map-data-store'
import { useMapMaybe } from '@/map/MapContext'
import { STEPS } from './steps'
import { pointCloudTuning } from '@/map/layers/pointCloud.shared'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Boxes, ChevronDown, ChevronUp, Copy, Pause, RotateCcw } from 'lucide-react'

// Le nuage de points n'existe que sur cette étape (cf. steps.ts → addPointCloud).
const POINTCLOUD_STEP_ID = 'pointcloud-lidar'

// Valeurs par défaut figées à l'import (avant toute édition) → bouton Réinitialiser.
const DEFAULTS = { ...pointCloudTuning }

type ParamKey = keyof typeof pointCloudTuning
type Knob = { key: ParamKey; label: string; min: number; max: number; step: number }

const KNOBS: Knob[] = [
  { key: 'bearingDeg', label: 'Cap / rotation (°)', min: -180, max: 180, step: 0.5 },
  { key: 'pitchDeg', label: 'Tangage (°)', min: -180, max: 180, step: 0.5 },
  { key: 'rollDeg', label: 'Roulis (°)', min: -180, max: 180, step: 0.5 },
  { key: 'offsetEast', label: 'Décalage est (m)', min: -300, max: 300, step: 1 },
  { key: 'offsetNorth', label: 'Décalage nord (m)', min: -300, max: 300, step: 1 },
  { key: 'altitudeM', label: 'Altitude (m)', min: -50, max: 200, step: 1 },
  { key: 'scale', label: 'Échelle (×)', min: 0.2, max: 3, step: 0.05 },
  { key: 'pointSizePx', label: 'Taille points (px)', min: 0.5, max: 12, step: 0.1 },
]

export function PointCloudDebugPanel() {
  const [open, setOpen] = useState(true)
  // État miroir : source de vérité de l'UI ; écrit en parallèle dans pointCloudTuning
  // (lu par render() chaque frame).
  const [vals, setVals] = useState(() => ({ ...pointCloudTuning }))
  const currentStep = useTourStore((s) => s.currentStep)
  const stopCamera = useMapDataStore((s) => s.pointCloudStopCamera)
  const map = useMapMaybe()

  if (STEPS[currentStep]?.id !== POINTCLOUD_STEP_ID) return null

  const set = (key: ParamKey, v: number) => {
    pointCloudTuning[key] = v
    setVals((prev) => ({ ...prev, [key]: v }))
    map?.triggerRepaint()
  }

  const reset = () => {
    Object.assign(pointCloudTuning, DEFAULTS)
    setVals({ ...DEFAULTS })
    map?.triggerRepaint()
  }

  const copy = () => {
    const text = KNOBS.map((k) => `${k.key}: ${vals[k.key]},`).join('\n')
    void navigator.clipboard.writeText(text)
  }

  // `debug-panel` : driver.js coupe pointer-events pendant la visite ; cette classe
  // les ré-active (cf. index.css) → sinon les clics tombent sur la carte.
  return (
    <div className="debug-panel absolute bottom-16 left-4 w-72" style={{ zIndex: 100101 }}>
      <div className="bg-background/95 backdrop-blur rounded-md border shadow-md">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium"
        >
          <span className="flex items-center gap-2">
            <Boxes className="size-3.5" />
            Nuage de points — orientation live
          </span>
          {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
        {open && (
          <div className="flex flex-col gap-3 p-3 border-t max-h-[60vh] overflow-y-auto">
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs h-auto py-1.5"
              onClick={() => stopCamera?.()}
              disabled={!stopCamera}
            >
              <Pause className="size-3.5 mr-1" /> Figer la caméra
            </Button>
            {KNOBS.map((k) => (
              <div key={k.key} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="opacity-70">{k.label}</span>
                  <span className="font-mono tabular-nums">{vals[k.key]}</span>
                </div>
                <Slider
                  min={k.min}
                  max={k.max}
                  step={k.step}
                  value={[vals[k.key]]}
                  onValueChange={([v]) => set(k.key, v)}
                />
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs h-auto py-1.5"
                onClick={copy}
              >
                <Copy className="size-3.5 mr-1" /> Copier
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs h-auto py-1.5"
                onClick={reset}
              >
                <RotateCcw className="size-3.5 mr-1" /> Réinit.
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
