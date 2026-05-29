import type { RefObject } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

// Modal entrance (backdrop fade + card pop). Layer cards animate separately so
// they can replay on each tab switch. Respects prefers-reduced-motion.
export function useModalReveal(rootRef: RefObject<HTMLDivElement | null>) {
  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add(
        {
          motion: '(prefers-reduced-motion: no-preference)',
          reduced: '(prefers-reduced-motion: reduce)',
        },
        (context) => {
          const reduced = !!context.conditions?.reduced
          if (reduced) {
            gsap.set('[data-modal-backdrop]', { opacity: 1 })
            gsap.set('[data-modal-card]', { opacity: 1, scale: 1, y: 0 })
            return
          }
          const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
          tl.fromTo(
            '[data-modal-backdrop]',
            { opacity: 0 },
            { opacity: 1, duration: 0.3 },
            0,
          ).fromTo(
            '[data-modal-card]',
            { opacity: 0, scale: 0.92, y: 20 },
            { opacity: 1, scale: 1, y: 0, duration: 0.5 },
            0.05,
          )
        },
      )
      return () => mm.revert()
    },
    { scope: rootRef },
  )
}
