import { useEffect, useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { useTourStore } from '@/store/tour-store'
import { useIsMobile } from '@/hooks/use-mobile'
import { STEPS } from './steps'
import { previewForStep } from './stepPreviews'

gsap.registerPlugin(useGSAP)

const TOTAL = STEPS.length

type DotState = 'completed' | 'active' | 'inactive'

function dotState(index: number, current: number): DotState {
  if (index < current) return 'completed'
  if (index === current) return 'active'
  return 'inactive'
}

// Carte d'aperçu (vignette + titre + n° d'étape) affichée au survol d'un point.
function StepPreview({ index }: { index: number }) {
  const preview = previewForStep(index)
  const title = STEPS[index]?.title ?? ''
  // L'image épouse les bords haut/gauche/droite (le conteneur de la carte porte
  // `overflow-hidden rounded-lg`) ; seul le bloc texte est paddé.
  return (
    <div>
      {preview ? (
        <img
          src={preview}
          alt={title}
          loading="lazy"
          decoding="async"
          className="block aspect-[1871/964] w-full object-cover"
        />
      ) : (
        <div className="aspect-[1871/964] w-full bg-muted" />
      )}
      <div className="px-2.5 py-2">
        <p className="font-medium leading-tight">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Étape {index + 1} / {TOTAL}
        </p>
      </div>
    </div>
  )
}

// Un point interactif : bouton (zone tactile ≥ 22px) + barre visuelle, enveloppé
// d'un HoverCard pour l'aperçu. GSAP gère la micro-interaction de la barre et
// l'entrée/sortie de la carte ; un montage différé (`present`) garde une seule
// carte dans le DOM à la fois (vignette chargée seulement au survol).
//
// `open` est piloté par le parent (un seul `openIndex` partagé) : une carte au
// plus existe, un nouveau survol remplace la précédente, et le parent peut tout
// refermer à la navigation. Cela rend une carte fantôme structurellement
// impossible — on ne dépend plus de Radix pour émettre chaque fermeture.
function StepDot({
  index,
  state,
  disabled,
  open,
  onOpenChange,
  onJump,
}: {
  index: number
  state: DotState
  disabled: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onJump: (i: number) => void
}) {
  const [present, setPresent] = useState(false)
  // Noeud de la carte via callback-ref STATE (pas useRef) : Radix monte le contenu
  // du portail APRÈS l'effet du parent, donc un useRef serait encore null. Le state
  // déclenche un re-render dès que le noeud est attaché → l'effet d'anim s'exécute
  // alors avec un noeud valide.
  const [cardEl, setCardEl] = useState<HTMLDivElement | null>(null)
  const dotRef = useRef<HTMLButtonElement>(null)
  const barRef = useRef<HTMLSpanElement>(null)
  const liftRef = useRef<gsap.QuickToFunc | null>(null)
  const scaleRef = useRef<gsap.QuickToFunc | null>(null)

  useEffect(() => {
    if (open) setPresent(true)
  }, [open])

  // Micro-interaction de la barre (lift + scale) pilotée par quickTo.
  useGSAP(
    () => {
      if (!barRef.current) return
      liftRef.current = gsap.quickTo(barRef.current, 'y', { duration: 0.25, ease: 'power3.out' })
      scaleRef.current = gsap.quickTo(barRef.current, 'scaleY', {
        duration: 0.25,
        ease: 'power3.out',
      })
    },
    { scope: dotRef },
  )

  // Entrée / sortie de la carte. Clé sur [cardEl, open] : l'effet ne tourne qu'une
  // fois le noeud attaché (cardEl non null). Reduced-motion : bascule instantanée.
  // Le tween est tué au cleanup (pas de `revert`, pour préserver la sortie animée).
  // La sortie démonte la carte via setPresent(false) à la fin du tween.
  useEffect(() => {
    const card = cardEl
    if (!card) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (open) {
      if (reduce) {
        gsap.set(card, { autoAlpha: 1, y: 0, scale: 1 })
        return
      }
      const tw = gsap.fromTo(
        card,
        { autoAlpha: 0, y: 8, scale: 0.96 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.22, ease: 'power3.out', overwrite: 'auto' },
      )
      return () => {
        tw.kill()
      }
    }
    if (reduce) {
      gsap.set(card, { autoAlpha: 0 })
      setPresent(false)
      return
    }
    const tw = gsap.to(card, {
      autoAlpha: 0,
      y: 8,
      scale: 0.96,
      duration: 0.15,
      ease: 'power2.in',
      overwrite: 'auto',
      onComplete: () => setPresent(false),
    })
    return () => {
      tw.kill()
    }
  }, [cardEl, open])

  const onEnter = () => {
    liftRef.current?.(-2)
    scaleRef.current?.(state === 'active' ? 1.6 : 2.4)
  }
  const onLeave = () => {
    liftRef.current?.(0)
    scaleRef.current?.(1)
  }

  return (
    <HoverCard open={open} onOpenChange={onOpenChange} openDelay={120} closeDelay={150}>
      <HoverCardTrigger asChild>
        <button
          ref={dotRef}
          type="button"
          className="gp-stepper-dot"
          data-state={state}
          data-disabled={disabled || undefined}
          aria-disabled={disabled}
          aria-label={`Aller à l'étape ${index + 1} : ${STEPS[index]?.title ?? ''}`}
          aria-current={state === 'active' ? 'step' : undefined}
          onClick={() => !disabled && onJump(index)}
          onPointerEnter={onEnter}
          onPointerLeave={onLeave}
          onFocus={onEnter}
          onBlur={onLeave}
        >
          <span ref={barRef} className="gp-stepper-bar" />
        </button>
      </HoverCardTrigger>
      {present && (
        <HoverCardContent
          forceMount
          side="top"
          align="center"
          sideOffset={6}
          collisionPadding={12}
          // z au-dessus de la popover driver.js (z-index 1e9) : sinon, quand Radix
          // rabat la carte vers le bas faute de place, elle passe DERRIÈRE la popover.
          className="z-[1000001000] w-72 border-0 bg-transparent p-0 shadow-none ring-0"
        >
          {/* Élément animé par GSAP : il porte tout le chrome de la carte ; le
              HoverCardContent ne sert qu'au positionnement. Callback-ref (setCardEl)
              pour déclencher l'anim dès l'attache réelle du noeud du portail. */}
          <div
            ref={setCardEl}
            className="invisible overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10"
          >
            <StepPreview index={index} />
          </div>
        </HoverCardContent>
      )}
    </HoverCard>
  )
}

// Stepper du tour, monté en îlot React dans le popover driver.js (cf. TourController).
// Lit tout l'état réactivement depuis le store : pas de props à threader.
export function TourStepper() {
  const current = useTourStore((s) => s.currentStep)
  const flying = useTourStore((s) => s.flying)
  const jumpToStep = useTourStore((s) => s.jumpToStep)
  const isMobile = useIsMobile()

  // Source de vérité unique du survol : au plus une carte ouverte à la fois.
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  // Referme toute carte à la navigation (changement d'étape ou vol en cours) :
  // le popover se repositionne et le point peut glisser sous un curseur immobile
  // sans émettre de pointerleave → Radix raterait la fermeture. Ce reset garantit
  // qu'aucune carte ne survit à une transition (cause des cartes « fantômes »).
  useEffect(() => {
    setOpenIndex(null)
  }, [current, flying])

  // Mobile : indicateur seul, non interactif (pas de hover ni de saut).
  if (isMobile) {
    return (
      <div
        className="gp-stepper"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={TOTAL}
        aria-valuenow={current + 1}
      >
        {Array.from({ length: TOTAL }, (_, i) => (
          <span key={i} className="gp-stepper-dot" data-state={dotState(i, current)}>
            <span className="gp-stepper-bar" />
          </span>
        ))}
      </div>
    )
  }

  const disabled = flying || !jumpToStep
  return (
    <div className="gp-stepper">
      {Array.from({ length: TOTAL }, (_, i) => (
        <StepDot
          key={i}
          index={i}
          state={dotState(i, current)}
          disabled={disabled}
          open={openIndex === i}
          onOpenChange={(next) =>
            setOpenIndex((prev) => (next ? (disabled ? prev : i) : prev === i ? null : prev))
          }
          onJump={(idx) => jumpToStep?.(idx)}
        />
      ))}
    </div>
  )
}
