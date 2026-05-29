import type { RefObject } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

// Reduce-in: the card scales/slides in from the screen centre (where the full
// catalogue was) toward its docked top-right position, plus a one-shot pulse on
// the status dot. Replays whenever the applied layer changes.
export function useAppliedCardReveal(
  rootRef: RefObject<HTMLDivElement | null>,
  layerId: string | undefined,
) {
  useGSAP(
    () => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduced) return
      gsap.fromTo(
        '[data-applied-card]',
        { opacity: 0, scale: 1.12, x: -40, y: 20 },
        { opacity: 1, scale: 1, x: 0, y: 0, duration: 0.55, ease: 'power3.out' },
      )
      gsap.fromTo(
        '[data-applied-pulse]',
        { scale: 0.6, opacity: 0.9 },
        { scale: 2.4, opacity: 0, duration: 1.1, ease: 'power2.out', delay: 0.3 },
      )
    },
    { scope: rootRef, dependencies: [layerId], revertOnUpdate: true },
  )
}
