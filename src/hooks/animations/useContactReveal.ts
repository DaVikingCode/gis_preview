import type { RefObject } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

// Entrée du panneau de contact : la carte « éclot » depuis le coin du FAB
// (transform-origin bas-droite) pendant que le fond se floute, puis les champs
// montent en cascade. Respecte prefers-reduced-motion.
export function useContactReveal(rootRef: RefObject<HTMLDivElement | null>) {
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
            gsap.set('[data-contact-backdrop]', { opacity: 1 })
            gsap.set('[data-contact-card]', { opacity: 1, scale: 1 })
            gsap.set('[data-contact-field]', { opacity: 1, y: 0 })
            return
          }
          const tl = gsap.timeline()
          tl.fromTo(
            '[data-contact-backdrop]',
            { opacity: 0 },
            { opacity: 1, duration: 0.35, ease: 'power2.out' },
            0,
          )
            .fromTo(
              '[data-contact-card]',
              { opacity: 0, scale: 0.32, transformOrigin: '100% 100%' },
              { opacity: 1, scale: 1, duration: 0.55, ease: 'back.out(1.5)' },
              0.04,
            )
            .fromTo(
              '[data-contact-field]',
              { opacity: 0, y: 14 },
              { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out', stagger: 0.06 },
              0.22,
            )
        },
      )
      return () => mm.revert()
    },
    { scope: rootRef },
  )
}
