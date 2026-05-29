import * as React from 'react'
import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

type StepState = 'completed' | 'active' | 'inactive'

const StepperContext = React.createContext<{ value: number } | null>(null)
const StepItemContext = React.createContext<{
  step: number
  state: StepState
} | null>(null)

function useStepItem() {
  const ctx = React.useContext(StepItemContext)
  if (!ctx) throw new Error('Stepper item parts must be used within <StepperItem>')
  return ctx
}

function Stepper({ value, className, ...props }: React.ComponentProps<'div'> & { value: number }) {
  return (
    <StepperContext.Provider value={{ value }}>
      <div
        data-slot="stepper"
        role="list"
        className={cn('flex w-full items-center', className)}
        {...props}
      />
    </StepperContext.Provider>
  )
}

function StepperItem({
  step,
  className,
  ...props
}: React.ComponentProps<'div'> & { step: number }) {
  const stepper = React.useContext(StepperContext)
  if (!stepper) throw new Error('StepperItem must be used within <Stepper>')
  const state: StepState =
    stepper.value > step ? 'completed' : stepper.value === step ? 'active' : 'inactive'
  return (
    <StepItemContext.Provider value={{ step, state }}>
      <div
        data-slot="stepper-item"
        data-state={state}
        role="listitem"
        className={cn('flex shrink-0 items-center', className)}
        {...props}
      />
    </StepItemContext.Provider>
  )
}

function StepperIndicator({ className, children, ...props }: React.ComponentProps<'div'>) {
  const { state, step } = useStepItem()
  return (
    <div
      data-slot="stepper-indicator"
      data-state={state}
      className={cn(
        'relative inline-flex size-5 shrink-0 items-center justify-center rounded-full',
        'border text-[10px] font-semibold tabular-nums leading-none',
        'border-border bg-background text-muted-foreground',
        'transition-[background-color,border-color,color,box-shadow] duration-300 ease-out',
        'data-[state=active]:border-[var(--step-color,var(--primary))]',
        'data-[state=active]:bg-[var(--step-color,var(--primary))]',
        'data-[state=active]:text-[var(--step-on-color,var(--primary-foreground))]',
        'data-[state=active]:shadow-[0_0_0_4px_color-mix(in_oklab,var(--step-color,var(--primary))_22%,transparent)]',
        'data-[state=completed]:border-[var(--step-color,var(--primary))]',
        'data-[state=completed]:bg-[var(--step-color,var(--primary))]',
        'data-[state=completed]:text-[var(--step-on-color,var(--primary-foreground))]',
        className,
      )}
      aria-current={state === 'active' ? 'step' : undefined}
      {...props}
    >
      {children ??
        (state === 'completed' ? (
          <Check className="size-3" strokeWidth={3} />
        ) : (
          <span>{step + 1}</span>
        ))}
    </div>
  )
}

function StepperSeparator({ className, ...props }: React.ComponentProps<'div'>) {
  const { state } = useStepItem()
  return (
    <div
      data-slot="stepper-separator"
      data-state={state}
      aria-hidden
      className={cn(
        'relative mx-1.5 h-[2px] flex-1 overflow-hidden rounded-full bg-border/70',
        'transition-colors duration-300 ease-out',
        'data-[state=completed]:bg-[var(--step-color,var(--primary))]',
        'data-[state=active]:bg-[var(--step-color,var(--primary))]',
        className,
      )}
      {...props}
    />
  )
}

function StepperTitle({ className, ...props }: React.ComponentProps<'div'>) {
  const { state } = useStepItem()
  return (
    <div
      data-slot="stepper-title"
      data-state={state}
      className={cn(
        'text-[10px] font-medium tracking-wide leading-none text-muted-foreground/70',
        'transition-colors duration-300 ease-out',
        'data-[state=completed]:text-foreground/70',
        'data-[state=active]:text-[var(--step-color,var(--foreground))]',
        'data-[state=active]:font-semibold',
        className,
      )}
      {...props}
    />
  )
}

export { Stepper, StepperItem, StepperIndicator, StepperSeparator, StepperTitle }
