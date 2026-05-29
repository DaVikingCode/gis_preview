import type { RefObject } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

// Looping spotlight on a catalogue card/button — like useDemoCursorClick but
// WITHOUT cursor or auto-advance: the user reads the popover and clicks
// "Suivant". Under reduced-motion a static ring is set (and cleared on cleanup).
export function useLayerSpotlight(
  rootRef: RefObject<HTMLDivElement | null>,
  viewportRef: RefObject<HTMLDivElement | null>,
  highlightLayer: string | undefined,
  isImport: boolean,
) {
  useGSAP(
    () => {
      const root = rootRef.current
      if (!highlightLayer || isImport || !root) return
      const target = root.querySelector<HTMLElement>(`[data-layer-id="${highlightLayer}"]`)
      const vp = viewportRef.current
      if (!target || !vp) return
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

      // Bring the target into view.
      const top =
        vp.scrollTop + (target.getBoundingClientRect().top - vp.getBoundingClientRect().top) - 48
      vp.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' })

      if (reduced) {
        gsap.set(target, { boxShadow: '0 0 0 3px rgba(217,70,239,0.55)' })
        return () => gsap.set(target, { clearProps: 'boxShadow' })
      }

      gsap.fromTo(
        target,
        { boxShadow: '0 0 0 0 rgba(217,70,239,0.5)' },
        {
          boxShadow: '0 0 0 9px rgba(217,70,239,0)',
          duration: 1.5,
          ease: 'power2.out',
          repeat: -1,
        },
      )
    },
    { scope: rootRef, dependencies: [highlightLayer, isImport], revertOnUpdate: true },
  )
}
