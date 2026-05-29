import type { RefObject } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

// Entrance choreography for the tech-stack diagram. Deliberately calm and
// refined (no slamming): the radial bloom + isometric floor fade in while the
// whole stage eases up to scale, then the wireframe layers assemble from the
// foundation upward — each one fades and settles down a few px with silky
// easing, a soft halo breathing out as it arrives. The matching legend row
// drifts in alongside. Once assembled, the stack floats gently and a data-flow
// light rises along the legend rail. On prefers-reduced-motion: do nothing
// (everything stays in its assembled rest state).
//
// NB: slabs are wireframe during the entrance (only their flat top face shows),
// so fading the [data-slab] wrapper with autoAlpha is safe — there is no 3D body
// to flatten yet, and once opacity returns to 1 the preserve-3d context is
// restored for the hover-to-solid morph.
export function useTechStackReveal(rootRef: RefObject<HTMLDivElement | null>, reduce: boolean) {
  useGSAP(
    () => {
      if (reduce) return

      const slabs = gsap.utils.toArray<HTMLElement>('[data-slab]')
      const impacts = gsap.utils.toArray<HTMLElement>('[data-slab-impact]')
      const legend = gsap.utils.toArray<HTMLElement>('[data-legend-row]')

      const RISE = 26 // px each layer gently settles down from
      const EACH = 0.16 // stagger between successive layers

      // Start state: layers faded + lifted, legend nudged aside, halos hidden.
      gsap.set(slabs, { autoAlpha: 0, y: -RISE, scale: 0.95 })
      gsap.set(legend, { autoAlpha: 0, x: 18 })
      gsap.set(impacts, { autoAlpha: 0, scale: 0.85 })

      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })

      // 1 — atmosphere blooms in; the whole stage eases up to full scale.
      tl.fromTo(
        '[data-stack-float]',
        { scale: 0.97 },
        { scale: 1, duration: 1.3, ease: 'expo.out' },
        0,
      )
        .fromTo(
          '[data-stack-glow]',
          { autoAlpha: 0, scale: 0.7 },
          { autoAlpha: 1, scale: 1, duration: 1.2, ease: 'sine.out' },
          0,
        )
        .fromTo(
          '[data-stack-floor]',
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 1.3, ease: 'sine.out' },
          0.1,
        )

      // 2 — layers assemble from the foundation upward.
      slabs.forEach((slab, i) => {
        const at = 0.4 + i * EACH

        // Fade + settle into place, silky decelerating ease.
        tl.to(slab, { autoAlpha: 1, y: 0, scale: 1, duration: 1.05, ease: 'expo.out' }, at)

        // A soft halo breathes out as the layer arrives — no hard impact.
        tl.fromTo(
          impacts[i],
          { autoAlpha: 0, scale: 0.85 },
          { autoAlpha: 0.16, scale: 1.1, duration: 0.6, ease: 'sine.out' },
          at + 0.12,
        ).to(
          impacts[i],
          { autoAlpha: 0, scale: 1.3, duration: 0.95, ease: 'power2.out' },
          at + 0.55,
        )

        // Legend row drifts in alongside its layer.
        tl.to(legend[i], { autoAlpha: 1, x: 0, duration: 0.8, ease: 'power3.out' }, at + 0.1)
      })

      const total = 0.4 + slabs.length * EACH + 1.05

      // 3 — gentle perpetual float (scene + SVG hit-overlay move together).
      gsap.to('[data-stack-float]', {
        y: '-=10',
        duration: 3.6,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        delay: total,
      })

      // 4 — data-flow light rising along the legend rail, looping.
      gsap.fromTo(
        '[data-flow-rail]',
        { backgroundPosition: '50% 120%' },
        {
          backgroundPosition: '50% -120%',
          duration: 2.4,
          ease: 'none',
          repeat: -1,
          repeatDelay: 0.5,
          delay: total,
        },
      )
    },
    { scope: rootRef, dependencies: [reduce], revertOnUpdate: true },
  )
}
