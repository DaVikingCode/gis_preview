import type { RefObject } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

// Entrance choreography for the ecosystem bridge — deliberately calm and refined,
// matching the tech-stack diagram's tone (no slamming). The neutral ambient bloom
// breathes in while the central hub eases up to scale, then the import and export
// columns drift in from either side, and the directional labels + format chips
// rise. Once settled, onReady() is signalled so the conduit layer can measure the
// nodes at their final positions; the hub's accent halo then breathes forever.
// On prefers-reduced-motion: skip straight to onReady() (everything at rest).
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

      // 1 — neutral atmosphere blooms in; the hub eases up with a touch of life.
      tl.from(
        '[data-eco-ambient]',
        { autoAlpha: 0, scale: 0.8, duration: 1.1, ease: 'sine.out' },
        0,
      )
        .from(
          '[data-eco-hub]',
          { scale: 0.62, autoAlpha: 0, duration: 0.7, ease: 'back.out(1.5)' },
          0.1,
        )

        // 2 — the two columns drift in from their respective sides, staggered.
        .from(
          '[data-eco-col="left"] [data-eco-node]',
          { x: -40, autoAlpha: 0, duration: 0.55, stagger: 0.09 },
          '-=0.3',
        )
        .from(
          '[data-eco-col="right"] [data-eco-node]',
          { x: 40, autoAlpha: 0, duration: 0.55, stagger: 0.09 },
          '<',
        )

        // 3 — directional labels then format chips settle in.
        .from('[data-eco-label]', { y: 12, autoAlpha: 0, duration: 0.45, stagger: 0.1 }, '-=0.35')
        .from('[data-eco-chip]', { y: 10, autoAlpha: 0, duration: 0.35, stagger: 0.03 }, '-=0.2')

        // 4 — nodes are at rest: let the conduit layer mount and measure them.
        .add(() => onReady(), '-=0.1')

      // Accent halo of the hub breathes forever. It lives on a separate element so
      // the pulse never shifts the hub box — the conduits stay anchored to it.
      gsap.to('[data-eco-glow]', {
        scale: 1.16,
        opacity: 0.6,
        duration: 2.0,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      })
    },
    { scope: rootRef, dependencies: [reduce], revertOnUpdate: true },
  )
}
