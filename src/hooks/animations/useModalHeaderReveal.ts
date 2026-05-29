import type { RefObject } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

// Re-reveals the modal header text each time the tour step changes (the header
// remounts via its key), sliding it up with a fade. No-op under reduced-motion.
export function useModalHeaderReveal(
  rootRef: RefObject<HTMLDivElement | null>,
  stepId: string | undefined,
) {
  useGSAP(
    () => {
      const headerEl = rootRef.current?.querySelector('[data-modal-header]')
      if (!headerEl) return
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduced) return
      gsap.fromTo(
        headerEl,
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' },
      )
    },
    { scope: rootRef, dependencies: [stepId], revertOnUpdate: true },
  )
}
