import { useRef } from 'react'
import type { RefObject } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import type { POIStatus } from '@/store/map-data-store'

type StatusRefs = {
  rootRef: RefObject<HTMLDivElement | null>
  indicatorRefs: RefObject<(HTMLDivElement | null)[]>
  ringRef: RefObject<HTMLSpanElement | null>
  pillRef: RefObject<HTMLDivElement | null>
}

// Animates the POI status stepper as the status advances: the newly-active
// indicator pops in, the status pill slides up, and the "in progress" ring
// pulses forever. The first render is detected (prevIndexRef) so the stepper
// doesn't animate on mount. Respects prefers-reduced-motion via matchMedia.
export function usePoiStatusTransition(
  { rootRef, indicatorRefs, ringRef, pillRef }: StatusRefs,
  index: number,
  status: POIStatus,
) {
  const pulseRef = useRef<gsap.core.Tween | null>(null)
  const prevIndexRef = useRef<number>(-1)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add(
        {
          motion: '(prefers-reduced-motion: no-preference)',
          reduced: '(prefers-reduced-motion: reduce)',
        },
        (context) => {
          const reduced = !!context.conditions?.reduced
          const isFirstRun = prevIndexRef.current === -1
          pulseRef.current?.kill()
          pulseRef.current = null

          const activeNode = indicatorRefs.current[index]

          if (!isFirstRun && !reduced && activeNode) {
            gsap.fromTo(
              activeNode,
              { scale: 0.55 },
              { scale: 1, duration: 0.5, ease: 'back.out(1.8)' },
            )
            gsap.fromTo(
              pillRef.current,
              { y: 4, autoAlpha: 0 },
              { y: 0, autoAlpha: 1, duration: 0.3, ease: 'power2.out' },
            )
          }

          if (status === 'in_progress' && !reduced && ringRef.current) {
            gsap.set(ringRef.current, { scale: 1, opacity: 0.55 })
            pulseRef.current = gsap.to(ringRef.current, {
              scale: 2.1,
              opacity: 0,
              duration: 1.4,
              ease: 'sine.out',
              repeat: -1,
            })
          } else if (ringRef.current) {
            gsap.set(ringRef.current, { opacity: 0 })
          }

          prevIndexRef.current = index
          return () => {
            pulseRef.current?.kill()
            pulseRef.current = null
          }
        },
      )
      return () => mm.revert()
    },
    { scope: rootRef, dependencies: [index, status], revertOnUpdate: true },
  )
}
