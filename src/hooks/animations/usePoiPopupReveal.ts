import type { RefObject } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

// POI popup entrance: the card pops in (back-ease scale + fade), and the red
// halo behind it breathes forever (yoyo). Fires once on mount.
export function usePoiPopupReveal(
  rootRef: RefObject<HTMLDivElement | null>,
  haloRef: RefObject<HTMLDivElement | null>,
) {
  useGSAP(
    () => {
      gsap.fromTo(
        rootRef.current,
        { scale: 0.9, autoAlpha: 0, y: 6 },
        { scale: 1, autoAlpha: 1, y: 0, duration: 0.45, ease: 'back.out(1.4)' },
      )
      if (haloRef.current) {
        gsap.fromTo(
          haloRef.current,
          { autoAlpha: 0.15, scale: 0.96 },
          {
            autoAlpha: 0.55,
            scale: 1.02,
            duration: 1.4,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
          },
        )
      }
    },
    { scope: rootRef },
  )
}
