import { useRef } from 'react'

import { Stepper, StepperIndicator, StepperItem, StepperSeparator } from '@/components/ui/stepper'
import { useMapDataStore, type POIStatus } from '@/store/map-data-store'
import { usePoiStatusTransition } from '@/hooks/animations/usePoiStatusTransition'
import { usePoiGateNudge } from '@/hooks/animations/usePoiGateNudge'

const STEPS: { status: POIStatus; label: string; color: string }[] = [
  { status: 'todo', label: 'À faire', color: '#2563eb' },
  { status: 'in_progress', label: 'En cours', color: '#ea580c' },
  { status: 'done', label: 'Terminé', color: '#16a34a' },
]

const STATUS_INDEX: Record<POIStatus, number> = {
  todo: 0,
  in_progress: 1,
  done: 2,
}

export function POIStatusStepper({ status }: { status: POIStatus }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLDivElement>(null)
  const indicatorRefs = useRef<(HTMLDivElement | null)[]>([])
  const ringRef = useRef<HTMLSpanElement>(null)
  const hintRef = useRef<HTMLDivElement>(null)

  const index = STATUS_INDEX[status]
  const current = STEPS[index]
  const gateNudgeAt = useMapDataStore((s) => s.gateNudgeAt)

  usePoiStatusTransition({ rootRef, indicatorRefs, ringRef, pillRef }, index, status)
  usePoiGateNudge(hintRef, gateNudgeAt, status)

  return (
    <div ref={rootRef} className="relative border-t px-4 pb-3 pt-3.5">
      <div
        ref={hintRef}
        className="pointer-events-none absolute -top-1 left-4 right-4 -translate-y-full rounded-md bg-foreground px-2 py-1 text-[10px] font-medium text-background opacity-0 shadow-md"
        style={{ visibility: 'hidden' }}
      >
        Termine au moins un POI pour continuer →
      </div>

      <div className="mb-3 flex items-center justify-between">
        <span className="text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
          Avancement
        </span>
        <div
          ref={pillRef}
          key={current.status}
          className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold tabular-nums"
          style={{
            color: current.color,
            borderColor: `color-mix(in oklab, ${current.color} 35%, transparent)`,
            backgroundColor: `color-mix(in oklab, ${current.color} 12%, transparent)`,
          }}
        >
          <span className="size-1.5 rounded-full" style={{ background: current.color }} />
          {current.label}
        </div>
      </div>

      <Stepper value={index} aria-label="Statut du POI">
        {STEPS.map((step, i) => (
          <StepperItem
            key={step.status}
            step={i}
            className={i === 0 ? 'shrink-0' : 'flex-1'}
            style={
              {
                '--step-color': step.color,
                '--step-on-color': '#ffffff',
              } as React.CSSProperties
            }
          >
            {i > 0 && <StepperSeparator />}
            <StepperIndicator
              ref={(el) => {
                indicatorRefs.current[i] = el
              }}
            >
              {i < index ? undefined : i === index && status === 'in_progress' ? (
                <>
                  <span
                    ref={ringRef}
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-full"
                    style={{
                      boxShadow: `0 0 0 2px ${step.color}`,
                      opacity: 0,
                    }}
                  />
                  <span className="size-1.5 rounded-full bg-[var(--step-on-color)]" />
                </>
              ) : (
                <span>{i + 1}</span>
              )}
            </StepperIndicator>
          </StepperItem>
        ))}
      </Stepper>

      <div className="mt-2 grid grid-cols-3 text-[9.5px] leading-none">
        {STEPS.map((step, i) => (
          <StepperLabel key={step.status} i={i} step={step} index={index} />
        ))}
      </div>
    </div>
  )
}

function StepperLabel({
  i,
  step,
  index,
}: {
  i: number
  step: { color: string; label: string }
  index: number
}) {
  const state = i < index ? 'completed' : i === index ? 'active' : 'inactive'
  return (
    <span
      data-state={state}
      className="tracking-wide tabular-nums transition-colors duration-300"
      style={{
        justifySelf: i === 0 ? 'start' : i === 2 ? 'end' : 'center',
        color:
          state === 'active'
            ? step.color
            : state === 'completed'
              ? 'color-mix(in oklab, var(--foreground) 70%, transparent)'
              : 'color-mix(in oklab, var(--muted-foreground) 75%, transparent)',
        opacity: state === 'active' ? 1 : state === 'completed' ? 0.85 : 0.55,
        fontWeight: state === 'active' ? 600 : 400,
      }}
    >
      {step.label}
    </span>
  )
}
