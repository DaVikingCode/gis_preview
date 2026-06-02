import type { RefObject } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

// Reveal en stagger des sections [data-reveal] au montage de la sidebar.
export function useSidebarReveal(rootRef: RefObject<HTMLElement | null>) {
  useGSAP(
    () => {
      const root = rootRef.current
      if (!root) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      const sections = root.querySelectorAll<HTMLElement>('[data-reveal]')
      if (!sections.length) return

      gsap.fromTo(
        sections,
        { autoAlpha: 0, y: 10 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.5,
          ease: 'power2.out',
          stagger: 0.07,
          delay: 0.1,
        },
      )
    },
    { scope: rootRef },
  )
}
