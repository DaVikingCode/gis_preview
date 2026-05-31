import { useState } from 'react'
import { useTourStore } from '@/store/tour-store'
import { useMapMaybe } from '@/map/MapContext'
import { STEPS } from './steps'
import { flowParams } from '@/map/layers/trafficFlow'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Gauge, ChevronDown, ChevronUp, Copy, RotateCcw } from 'lucide-react'

// Le flux trafic n'existe que sur cette étape (cf. steps.ts → addTrafficFlow).
const TRAFFIC_STEP_ID = 'layers-apply-buildings'

// Valeurs par défaut figées à l'import (avant toute édition) → bouton Réinitialiser.
const DEFAULTS = { ...flowParams }

type ParamKey = keyof typeof flowParams
type Knob = {
  key: ParamKey
  label: string
  min: number
  max: number
  step: number
  constName: string // constante GLSL correspondante, pour le dump « Copier »
}

// Ordre d'affichage : les plus utiles au « lissé » en premier.
const KNOBS: Knob[] = [
  {
    key: 'flowDepth',
    label: 'Éclaircissement crête',
    min: 0,
    max: 0.8,
    step: 0.01,
    constName: 'FLOW_DEPTH',
  },
  {
    key: 'cometRise',
    label: 'Forme tête → traînée',
    min: 0.02,
    max: 0.5,
    step: 0.01,
    constName: 'COMET_RISE',
  },
  {
    key: 'spacingM',
    label: 'Espacement comètes (m)',
    min: 40,
    max: 400,
    step: 5,
    constName: 'PULSE_SPACING_M',
  },
  {
    key: 'speedMps',
    label: 'Vitesse (m/s)',
    min: 0,
    max: 80,
    step: 1,
    constName: 'FLOW_SPEED_MPS',
  },
  { key: 'coreBaseA', label: 'Opacité cœur', min: 0, max: 1, step: 0.01, constName: 'CORE_BASE_A' },
  {
    key: 'cometBoostA',
    label: 'Boost opacité crête',
    min: 0,
    max: 0.6,
    step: 0.01,
    constName: 'COMET_BOOST_A',
  },
  { key: 'haloA', label: 'Opacité halo', min: 0, max: 1, step: 0.01, constName: 'HALO_A' },
  { key: 'glowK', label: 'Serrage halo', min: 1, max: 10, step: 0.1, constName: 'GLOW_K' },
  { key: 'coreFrac', label: 'Finesse cœur', min: 0.1, max: 1, step: 0.01, constName: 'CORE_FRAC' },
  {
    key: 'jamAmp',
    label: 'Respiration bouchon',
    min: 0,
    max: 0.5,
    step: 0.01,
    constName: 'JAM_PULSE_AMP',
  },
]

const fmt = (v: number, step: number) => v.toFixed(step < 1 ? 2 : 0)

export function TrafficFlowDebugPanel() {
  const [open, setOpen] = useState(true)
  // État miroir : source de vérité de l'UI ; écrit en parallèle dans flowParams
  // (lu par le render WebGL chaque frame).
  const [vals, setVals] = useState(() => ({ ...flowParams }))
  const currentStep = useTourStore((s) => s.currentStep)
  const map = useMapMaybe()

  if (STEPS[currentStep]?.id !== TRAFFIC_STEP_ID) return null

  const set = (key: ParamKey, v: number) => {
    flowParams[key] = v
    setVals((prev) => ({ ...prev, [key]: v }))
    map?.triggerRepaint() // utile en reduced-motion (pas de boucle d'anim)
  }

  const reset = () => {
    Object.assign(flowParams, DEFAULTS)
    setVals({ ...DEFAULTS })
    map?.triggerRepaint()
  }

  const copy = () => {
    const text = KNOBS.map((k) => `const ${k.constName} = ${vals[k.key]}`).join('\n')
    void navigator.clipboard.writeText(text)
  }

  // `debug-panel` : driver.js coupe pointer-events sur tout pendant la visite ;
  // cette classe les ré-active (cf. index.css) → sinon les clics tombent sur la carte.
  return (
    <div className="debug-panel absolute bottom-16 left-4 w-72" style={{ zIndex: 100101 }}>
      <div className="bg-background/95 backdrop-blur rounded-md border shadow-md">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium"
        >
          <span className="flex items-center gap-2">
            <Gauge className="size-3.5" />
            Flux trafic — réglages live
          </span>
          {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
        {open && (
          <div className="flex flex-col gap-3 p-3 border-t max-h-[60vh] overflow-y-auto">
            {KNOBS.map((k) => (
              <div key={k.key} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="opacity-70">{k.label}</span>
                  <span className="font-mono tabular-nums">{fmt(vals[k.key], k.step)}</span>
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
