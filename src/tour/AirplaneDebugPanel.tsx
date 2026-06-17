import { useState } from 'react'
import { useTourStore } from '@/store/tour-store'
import { useMapMaybe } from '@/map/MapContext'
import { STEPS } from './steps'
import { airplaneTuning } from '@/map/layers/airplane3d.shared'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Plane, ChevronDown, ChevronUp, Copy, RotateCcw } from 'lucide-react'

// L'avion 3D n'existe que sur cette étape (cf. steps.ts → addAirplane3D).
const AIRPLANE_STEP_ID = 'flyover-3d'

// Valeurs par défaut figées à l'import (avant toute édition) → bouton Réinitialiser.
const DEFAULTS = { ...airplaneTuning }

type ParamKey = keyof typeof airplaneTuning
type Knob = { key: ParamKey; label: string; min: number; max: number; step: number }

const KNOBS: Knob[] = [
  { key: 'headingOffsetDeg', label: 'Cap — offset aller (°)', min: -180, max: 180, step: 5 },
  { key: 'headingOffsetReturnDeg', label: 'Cap — offset retour (°)', min: -180, max: 180, step: 5 },
  { key: 'pitchDeg', label: 'Tangage aller (°)', min: -180, max: 180, step: 5 },
  { key: 'pitchReturnDeg', label: 'Tangage retour (°)', min: -180, max: 180, step: 5 },
  { key: 'rollTakeoffDeg', label: 'Roulis — décollage (°)', min: -180, max: 180, step: 5 },
  { key: 'rollCruiseDeg', label: 'Roulis — croisière (°)', min: -180, max: 180, step: 5 },
  { key: 'rollLandingDeg', label: 'Roulis — atterrissage (°)', min: -180, max: 180, step: 5 },
  { key: 'returnRollFlipDeg', label: 'Flip retour (°)', min: -180, max: 180, step: 5 },
  { key: 'lengthKm', label: 'Longueur (km)', min: 20, max: 600, step: 10 },
  { key: 'scaleNearMul', label: 'Taille — aéroports (×)', min: 0.5, max: 2, step: 0.02 },
  { key: 'scaleFarMul', label: 'Taille — apogée (×)', min: 0.5, max: 2, step: 0.02 },
  { key: 'cruiseAltKm', label: 'Altitude croisière (km)', min: 0, max: 400, step: 10 },
  { key: 'takeoffAltKm', label: 'Altitude départ (km)', min: 0, max: 150, step: 2 },
  { key: 'planeRiseKm', label: 'Hauteur sur tracé (km)', min: 0, max: 150, step: 5 },
  { key: 'lineWidthPx', label: 'Épaisseur tracé (px)', min: 1, max: 12, step: 1 },
]

export function AirplaneDebugPanel() {
  const [open, setOpen] = useState(true)
  // État miroir : source de vérité de l'UI ; écrit en parallèle dans airplaneTuning
  // (lu par render() chaque frame).
  const [vals, setVals] = useState(() => ({ ...airplaneTuning }))
  const currentStep = useTourStore((s) => s.currentStep)
  const map = useMapMaybe()

  if (STEPS[currentStep]?.id !== AIRPLANE_STEP_ID) return null

  const set = (key: ParamKey, v: number) => {
    airplaneTuning[key] = v
    setVals((prev) => ({ ...prev, [key]: v }))
    map?.triggerRepaint()
  }

  const reset = () => {
    Object.assign(airplaneTuning, DEFAULTS)
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
            <Plane className="size-3.5" />
            Avion 3D — orientation live
          </span>
          {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
        {open && (
          <div className="flex flex-col gap-3 p-3 border-t max-h-[60vh] overflow-y-auto">
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
