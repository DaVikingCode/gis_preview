import type { RefObject } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

// Staggers the catalogue layer cards in when the pane (overview vs import)
// changes. revertOnUpdate kills the previous tween and clears inline styles
// before re-querying the freshly-rendered cards.
export function useLayerCardsStagger(rootRef: RefObject<HTMLDivElement | null>, isImport: boolean) {
  useGSAP(
    () => {
      const root = rootRef.current
      if (!root) return
      const cards = root.querySelectorAll('[data-layer-card]')
      if (!cards.length) return
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduced) {
        gsap.set(cards, { opacity: 1, y: 0 })
        return
      }
      gsap.fromTo(
        cards,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.02, ease: 'power3.out', delay: 0.2 },
      )
    },
    { scope: rootRef, dependencies: [isImport], revertOnUpdate: true },
  )
}
