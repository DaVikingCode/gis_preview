import type { RefObject } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

// Custom conduit animation for the ecosystem bridge — replaces the off-the-shelf
// AnimatedBeam. Every path carries pathLength={100}, so all dash maths are in a
// normalised 0–100 scale and survive any resize (no getTotalLength, no plugin).
//
//  • Rails draw themselves in: strokeDashoffset 100 → 0, staggered.
//  • A single accent pulse then streams along each conduit forever: the dash
//    pattern "40 60" tiles the path exactly once (period = 100), so animating the
//    offset by one full period (0 → -100) loops seamlessly with no visible jump.
//    Direction follows the path's own M…Q…end orientation: source → hub on the
//    import side, hub → target on the export side.
//
// `ready` should only flip true once the conduit <path>s are mounted with their
// final `d`. On prefers-reduced-motion: rails stay drawn, no pulses.
export function useEcosystemBeams(
  beamsRef: RefObject<HTMLDivElement | null>,
  ready: boolean,
  reduce: boolean,
) {
  useGSAP(
    () => {
      if (!ready) return

      const rails = gsap.utils.toArray<SVGPathElement>('[data-eco-rail]')
      const pulses = gsap.utils.toArray<SVGPathElement>('[data-eco-pulse]')
      if (!rails.length) return

      if (reduce) {
        gsap.set(rails, { strokeDashoffset: 0 })
        gsap.set(pulses, { opacity: 0 })
        return
      }

      // Draw the rails in from each node toward the hub.
      gsap.fromTo(
        rails,
        { strokeDashoffset: 100 },
        { strokeDashoffset: 0, duration: 0.9, ease: 'power2.out', stagger: 0.08 },
      )

      const drawIn = 0.9 + (rails.length - 1) * 0.08

      // Pulses fade in once the rails are mostly drawn, then stream forever.
      gsap.set(pulses, { opacity: 0 })
      pulses.forEach((pulse, i) => {
        const row = Number(pulse.dataset.row ?? 0)
        const start = drawIn * 0.6 + row * 0.18 + i * 0.04
        gsap.to(pulse, { opacity: 1, duration: 0.5, ease: 'power1.out', delay: start })
        gsap.fromTo(
          pulse,
          { strokeDashoffset: 0 },
          {
            strokeDashoffset: -100,
            duration: 2.6 + row * 0.4,
            ease: 'none',
            repeat: -1,
            delay: start,
          },
        )
      })
    },
    { scope: beamsRef, dependencies: [ready, reduce], revertOnUpdate: true },
  )
}
