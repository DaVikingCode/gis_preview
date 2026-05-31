import type { RefObject } from 'react'
import { useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { dispatchCursor } from '@/animations/tourCursor'
import { useTourStore } from '@/store/tour-store'

// Faux curseur scripté du step « Comparaison avant / après » : il attrape le knob
// du slider et le glisse subtilement en ALLER-RETOUR — DROITE → GAUCHE (révèle
// l'ortho actuelle) puis GAUCHE → DROITE (revient) — avant de relâcher. Tant que ce
// va-et-vient n'est pas fini, « Suivant » reste verrouillé (gate swipeDone). C'est le
// SmoothCursor (magicui) piloté par des pointermove
// synthétiques (dispatchCursor). En reduced-motion : pas de geste, le slider reste
// au centre et la gate se lève.
//
// Le SmoothCursor est rendu en ressort (motion) → sa position À L'ÉCRAN traîne
// derrière la cible dispatchée. Si on pilotait le séparateur depuis la cible, le
// knob filerait DEVANT le curseur. On COLLE donc le knob, pendant le glissement, sur
// la position RÉELLE du curseur (lue chaque frame via gsap.ticker) — comme le ghost
// de useDemoCursorDrop. Le curseur « mène », le knob lui colle : un vrai drag.

const HOLD_SEC = 0.8 // observation de l'image de départ avant l'entrée du curseur
const GLIDE_SEC = 0.6 // approche du curseur jusqu'au knob
const DRAG_SEC = 1.4 // durée d'une passe (droite → gauche, puis gauche → droite)
const DWELL_SEC = 0.25 // courte pause à l'extrême gauche avant le retour
const FADE_AFTER_SEC = 0.5 // délai avant le fondu du curseur après le relâcher
// Filet de sécurité : lève la gate même si le geste est coupé (> durée totale,
// aller-retour compris : hold + glide + press + 2×drag + dwell + release ≈ 4,6 s).
const SAFETY_SEC = 7
// Balayage subtil, légèrement à droite du centre puis vers la gauche (et retour).
const START_FRAC = 0.6 // position de départ du séparateur
const END_FRAC = 0.42 // position d'arrivée (passe juste à gauche du centre)
// Décalage de la graine du curseur par rapport au knob (entrée bas-droite visible).
const SEED_DX = 40
const SEED_DY = 34
const PRESS_DIP_PX = 4 // léger enfoncement vertical du curseur au « clic »

type Opts = {
  wrapperRef: RefObject<HTMLDivElement | null>
  knobRef: RefObject<HTMLDivElement | null>
  knobVisualRef: RefObject<HTMLDivElement | null>
  setDividerX: (x: number) => void
  reduced: boolean
}

export function useSwipeAutoDrag({
  wrapperRef,
  knobRef,
  knobVisualRef,
  setDividerX,
  reduced,
}: Opts): boolean {
  const [cursorHidden, setCursorHidden] = useState(false)

  useGSAP(
    () => {
      const wrapper = wrapperRef.current
      const knob = knobRef.current
      const knobVisual = knobVisualRef.current
      if (!wrapper || !knob || !knobVisual) return

      const w = wrapper.clientWidth

      // Reduced-motion : vue neutre (centre), pas de geste, gate levée.
      if (reduced) {
        setDividerX(w * 0.5)
        useTourStore.getState().setSwipeDone(true)
        return
      }

      // Départ à droite + knob verrouillé : aucun conflit avec un drag manuel
      // pendant le geste (réactivé une fois le ressort posé / au nettoyage).
      setDividerX(w * START_FRAC)
      knob.style.pointerEvents = 'none'

      const rect = wrapper.getBoundingClientRect()
      const h = wrapper.clientHeight
      const startX = w * START_FRAC
      const endX = w * END_FRAC
      const knobY = h / 2

      // Cible du curseur en coords viewport (seul le SmoothCursor `scripted` suit).
      const cur = { x: rect.left + startX + SEED_DX, y: rect.top + knobY + SEED_DY }
      const move = () => dispatchCursor(cur.x, cur.y)

      // Colle le séparateur sous le centre RENDU du curseur (≈ valeur courante du
      // ressort). Actif uniquement pendant le glissement → pendant la phase
      // d'approche, le knob reste immobile et le curseur vient à lui.
      let glued = false
      let cursorEl: HTMLElement | null = null
      const glueKnob = () => {
        if (!glued) return
        cursorEl ??= document.querySelector<HTMLElement>('[data-fake-cursor]')
        if (!cursorEl) return
        const c = cursorEl.getBoundingClientRect()
        setDividerX(c.left + c.width / 2 - rect.left)
      }
      gsap.ticker.add(glueKnob)
      const stopGlue = () => {
        glued = false
        gsap.ticker.remove(glueKnob)
      }

      // Filet de sécurité : la gate se lève même si le geste est interrompu.
      const safety = gsap.delayedCall(SAFETY_SEC, () => {
        useTourStore.getState().setSwipeDone(true)
        stopGlue()
        knob.style.pointerEvents = 'auto'
        setCursorHidden(true)
      })

      // Lead-in via delay du timeline (pas de delayedCall imbriqué : le timeline est
      // créé dans le corps de useGSAP → capté par le contexte, révoqué au unmount).
      const tl = gsap.timeline({ delay: HOLD_SEC, defaults: { ease: 'power2.inOut' } })

      // 1) approche du knob (immobile) : le curseur entre depuis sa graine bas-droite.
      tl.to(cur, {
        x: rect.left + startX,
        y: rect.top + knobY,
        duration: GLIDE_SEC,
        onUpdate: move,
      })

      // 2) « clic » : le visuel du knob s'enfonce, le curseur plonge un peu.
      tl.addLabel('press', '>')
      tl.to(
        knobVisual,
        { scale: 0.92, duration: 0.12, ease: 'power2.in', transformOrigin: '50% 50%' },
        'press',
      )
      tl.to(
        cur,
        { y: rect.top + knobY + PRESS_DIP_PX, duration: 0.12, ease: 'power2.in', onUpdate: move },
        'press',
      )

      // 3) va-et-vient : le curseur mène, le knob lui colle (glueKnob). On dispatche la
      //    cible ; le séparateur suit la position rendue réelle. Droite → gauche, brève
      //    pause, puis gauche → droite (retour à la position de départ).
      tl.addLabel('drag', '>')
      tl.call(
        () => {
          cursorEl = document.querySelector<HTMLElement>('[data-fake-cursor]')
          glued = true
        },
        [],
        'drag',
      )
      tl.to(cur, { x: rect.left + endX, duration: DRAG_SEC, onUpdate: move }, 'drag')
      tl.to(cur, { x: rect.left + startX, duration: DRAG_SEC, onUpdate: move }, `>+=${DWELL_SEC}`)

      // 4) relâcher : le curseur se redresse, le knob remonte (rebond). Le glue reste
      //    actif le temps que le ressort se pose pile sur l'arrivée.
      tl.addLabel('release', '>')
      tl.to(
        cur,
        { y: rect.top + knobY, duration: 0.26, ease: 'back.out(2.4)', onUpdate: move },
        'release',
      )
      tl.to(
        knobVisual,
        { scale: 1, duration: 0.26, ease: 'back.out(2.4)', transformOrigin: '50% 50%' },
        'release',
      )

      // Gate levée dès le relâcher.
      tl.call(
        () => {
          useTourStore.getState().setSwipeDone(true)
          safety.kill()
        },
        [],
        'release',
      )
      // Ressort posé : on fige le knob, rend la main à l'utilisateur, efface le curseur.
      tl.call(
        () => {
          stopGlue()
          knob.style.pointerEvents = 'auto'
          setCursorHidden(true)
        },
        [],
        `release+=${FADE_AFTER_SEC}`,
      )

      // Démontage en plein geste : retire le ticker + restaure l'interaction du knob
      // (useGSAP révoque le timeline/safety ; ni le ticker ni ce style ne sont des tweens).
      return () => {
        stopGlue()
        knob.style.pointerEvents = 'auto'
      }
    },
    { dependencies: [reduced], scope: wrapperRef },
  )

  return cursorHidden
}
