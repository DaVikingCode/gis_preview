import { useRef } from 'react'
import type { ComponentType } from 'react'
import { Building2, Check, ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { useTourStore } from '@/store/tour-store'
import { STEPS, type AppliedLayerId } from '@/tour/steps'
import { cn } from '@/lib/utils'
import { useAppliedCardReveal } from '@/hooks/animations/useAppliedCardReveal'
import CadastreImg from '@/assets/layer-previews/cadastre.webp'

type AppliedLayerDef = {
  label: string
  sub: string
  preview?: string
  Icon?: ComponentType<{ className?: string }>
  text: string
  bg: string
  ring: string
  dot: string
}

const REGISTRY: Record<AppliedLayerId, AppliedLayerDef> = {
  cadastre: {
    label: 'Cadastre',
    sub: 'Parcelles cadastrales (IGN)',
    preview: CadastreImg,
    text: 'text-amber-400',
    bg: 'bg-amber-500/15',
    ring: 'ring-amber-500/60',
    dot: 'bg-amber-400',
  },
  buildings3d: {
    label: 'Bâtiments 3D',
    sub: 'Bâtiments en relief 3D',
    Icon: Building2,
    text: 'text-sky-400',
    bg: 'bg-sky-500/15',
    ring: 'ring-sky-500/60',
    dot: 'bg-sky-400',
  },
}

export function LayersAppliedCard() {
  const rootRef = useRef<HTMLDivElement>(null)
  const currentStep = useTourStore((s) => s.currentStep)
  const step = STEPS[currentStep]
  const layerId = step?.appliedLayer

  useAppliedCardReveal(rootRef, layerId)

  if (!step || step.chart !== 'layers-applied' || !layerId) return null
  const def = REGISTRY[layerId]

  return (
    <div
      ref={rootRef}
      className="absolute top-4 right-16 w-72 pointer-events-auto"
      style={{ zIndex: 100100 }}
    >
      <Card
        id="layers-applied-card"
        data-applied-card
        className="bg-card/95 backdrop-blur-md shadow-2xl gap-0 py-0 overflow-hidden"
      >
        <div className="px-4 pt-3.5 pb-3 border-b">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] font-medium text-muted-foreground/70 mb-1">
            <span className="relative flex size-1.5">
              <span
                data-applied-pulse
                className={cn('absolute inline-flex size-full rounded-full', def.dot)}
              />
              <span className={cn('relative inline-flex size-1.5 rounded-full', def.dot)} />
            </span>
            Couche appliquée
          </div>
          <h2 className="text-sm font-semibold tracking-tight leading-tight">{step.title}</h2>
        </div>

        <div className="p-3">
          <div
            className={cn(
              'flex items-center gap-3 rounded-xl border border-transparent p-2.5 ring-2',
              def.ring,
              def.bg,
            )}
          >
            <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-muted">
              {def.preview ? (
                <img src={def.preview} alt={def.label} className="size-full object-cover" />
              ) : def.Icon ? (
                <span className={cn('flex size-full items-center justify-center', def.bg)}>
                  <def.Icon className={cn('size-5', def.text)} />
                </span>
              ) : null}
            </span>

            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold leading-tight truncate">{def.label}</div>
              <p className="text-[11px] text-muted-foreground leading-tight truncate">{def.sub}</p>
            </div>

            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full text-white',
                def.dot,
              )}
            >
              <Check className="size-3.5" />
            </span>
          </div>
        </div>

        <div
          className={cn(
            'px-4 py-2.5 border-t flex items-center gap-1.5 text-[11px] font-medium',
            def.text,
          )}
        >
          <ArrowRight className="size-3.5" />
          Visible sur la carte
        </div>
      </Card>
    </div>
  )
}
