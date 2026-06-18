import type { RefObject } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

// Connection layer for the ecosystem constellation. Each spoke is a hairline path
// carrying pathLength={100}, so the draw-in maths are normalised (0–100) and survive
// any resize. Unlike the old hub-and-beam treatment, there is no perpetual accent
// pulse: the spokes simply draw themselves in once, then rest. The bidirectional
// truth is carried by the static ⇄ marker on each line, which fades in afterwards.
//
// `ready` should only flip true once the spoke <path>s are mounted with their final
// `d`. On prefers-reduced-motion: spokes and markers appear at rest.
export function useEcosystemBeams(
  beamsRef: RefObject<HTMLDivElement | null>,
  ready: boolean,
  reduce: boolean,
) {
  useGSAP(
    () => {
      if (!ready) return

      const rails = gsap.utils.toArray<SVGPathElement>('[data-eco-spoke]')
      const markers = gsap.utils.toArray<HTMLElement>('[data-eco-marker]')
      if (!rails.length) return

      if (reduce) {
        gsap.set(rails, { strokeDashoffset: 0 })
        gsap.set(markers, { autoAlpha: 1 })
        return
      }

      gsap.set(markers, { autoAlpha: 0 })
      gsap.fromTo(
        rails,
        { strokeDashoffset: 100 },
        { strokeDashoffset: 0, duration: 0.8, ease: 'power2.out', stagger: 0.07 },
      )

      const drawIn = 0.8 + (rails.length - 1) * 0.07
      gsap.to(markers, {
        autoAlpha: 1,
        duration: 0.4,
        ease: 'power1.out',
        stagger: 0.05,
        delay: drawIn * 0.7,
      })
    },
    { scope: beamsRef, dependencies: [ready, reduce], revertOnUpdate: true },
  )
}
