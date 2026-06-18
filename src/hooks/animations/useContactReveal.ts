import type { RefObject } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

// Entrée du panneau de contact : ouverture subtile et fluide. Le fond se floute
// en douceur ; la carte se révèle par un léger fondu + montée discrète + un soupçon
// de scale (0.96 → 1) ancré vers le coin du FAB, puis les champs montent en cascade
// fine. Pas d'effet « pop » ni de rebond. Respecte prefers-reduced-motion.
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
            gsap.set('[data-contact-card]', { opacity: 1, scale: 1, y: 0 })
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
              { opacity: 0, scale: 0.96, y: 14, transformOrigin: '100% 100%' },
              { opacity: 1, scale: 1, y: 0, duration: 0.42, ease: 'power3.out' },
              0.02,
            )
            .fromTo(
              '[data-contact-field]',
              { opacity: 0, y: 8 },
              { opacity: 1, y: 0, duration: 0.34, ease: 'power2.out', stagger: 0.045 },
              0.16,
            )
        },
      )
      return () => mm.revert()
    },
    { scope: rootRef },
  )
}
