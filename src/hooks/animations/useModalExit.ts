import type { RefObject } from 'react'
import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

// Joue pendant que la caméra vole déjà : la carte est révélée en mouvement plutôt que
// par une coupure sèche. Respecte prefers-reduced-motion (saute directement à onExited).
export function useModalExit(
  rootRef: RefObject<HTMLDivElement | null>,
  exiting: boolean,
  onExited: () => void,
) {
  // Garde le dernier callback sans rejouer la timeline à chaque render.
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
      tl.to('[data-modal-backdrop]', { opacity: 0, duration: 0.4 }, 0).to(
        '[data-modal-card]',
        { opacity: 0, scale: 0.9, duration: 0.45 },
        0,
      )
    },
    { scope: rootRef, dependencies: [exiting] },
  )
}
