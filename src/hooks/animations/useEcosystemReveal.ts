import type { RefObject } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

// Entrance choreography for the ecosystem constellation — deliberately calm, in the
// same register as the tech-stack diagram (no slamming). The neutral ambient bloom
// breathes in, the compass-graticule rings fade up and begin their slow, ambient
// rotation, the central platform hub eases in, then the surrounding platform nodes
// settle outward from the centre. Once the nodes are at rest, onReady() lets the
// spoke layer measure them and draw the (static, hairline) connections.
// On prefers-reduced-motion: skip straight to onReady(), rings at rest.
export function useEcosystemReveal(
  rootRef: RefObject<HTMLDivElement | null>,
  reduce: boolean,
  onReady: () => void,
) {
  useGSAP(
    () => {
      if (reduce) {
        onReady()
        return
      }

      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })

      tl.from(
        '[data-eco-ambient]',
        { autoAlpha: 0, scale: 0.85, duration: 1.1, ease: 'sine.out' },
        0,
      )
        .from(
          '[data-eco-ring]',
          { autoAlpha: 0, scale: 0.9, duration: 0.9, ease: 'sine.out' },
          0.05,
        )
        .from(
          '[data-eco-hub]',
          { scale: 0.62, autoAlpha: 0, duration: 0.7, ease: 'back.out(1.5)' },
          0.15,
        )
        // Nodes settle outward from the centre, staggered around the ring.
        .from(
          '[data-eco-node]',
          { scale: 0.6, autoAlpha: 0, duration: 0.55, stagger: 0.07, ease: 'back.out(1.3)' },
          '-=0.35',
        )
        .from('[data-eco-chip]', { y: 10, autoAlpha: 0, duration: 0.35, stagger: 0.03 }, '-=0.25')
        .add(() => onReady(), '-=0.15')

      // The graticule rings rotate forever, very slowly — ambient instrument motion,
      // never a spinner. Lives on its own group so the hub/nodes stay anchored.
      gsap.to('[data-eco-ring]', {
        rotation: 360,
        duration: 90,
        repeat: -1,
        ease: 'none',
        transformOrigin: '50% 50%',
      })
    },
    { scope: rootRef, dependencies: [reduce], revertOnUpdate: true },
  )
}
