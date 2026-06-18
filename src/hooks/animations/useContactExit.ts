import type { RefObject } from 'react'
import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

// Sortie du panneau de contact : fermeture subtile, miroir de l'entrée. Les champs
// s'effacent vite, la carte se replie en douceur (léger fondu + scale 0.97 + descente)
// vers le coin du FAB, puis le fond se dévoile. `onExited` démonte une fois terminé.
// Respecte prefers-reduced-motion (saute directement à onExited).
export function useContactExit(
  rootRef: RefObject<HTMLDivElement | null>,
  exiting: boolean,
  onExited: () => void,
) {
  const onExitedRef = useRef(onExited)
  onExitedRef.current = onExited

  useGSAP(
    () => {
      if (!exiting) return
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduced) {
        onExitedRef.current()
        return
      }
      const tl = gsap.timeline({
        defaults: { ease: 'power2.in' },
        onComplete: () => onExitedRef.current(),
      })
      tl.to('[data-contact-field]', { opacity: 0, y: 6, duration: 0.16, stagger: 0.03 }, 0)
        .to(
          '[data-contact-card]',
          { opacity: 0, scale: 0.97, y: 10, transformOrigin: '100% 100%', duration: 0.3 },
          0.08,
        )
        .to('[data-contact-backdrop]', { opacity: 0, duration: 0.3 }, 0.12)
    },
    { scope: rootRef, dependencies: [exiting] },
  )
}
