import type { RefObject } from 'react'
import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

// Sortie du panneau de contact : la carte se rétracte vers le coin du FAB et le
// fond se dévoile. `onExited` démonte une fois l'animation terminée. Respecte
// prefers-reduced-motion (saute directement à onExited).
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
      tl.to('[data-contact-field]', { opacity: 0, y: 8, duration: 0.18 }, 0)
        .to(
          '[data-contact-card]',
          { opacity: 0, scale: 0.32, transformOrigin: '100% 100%', duration: 0.4 },
          0.05,
        )
        .to('[data-contact-backdrop]', { opacity: 0, duration: 0.35 }, 0.1)
    },
    { scope: rootRef, dependencies: [exiting] },
  )
}
