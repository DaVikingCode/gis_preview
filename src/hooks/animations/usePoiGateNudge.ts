import type { RefObject } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import type { POIStatus } from '@/store/map-data-store'

// Flashes the "finish a POI to continue" hint above the stepper whenever the
// tour pings the gate (gateNudgeAt changes) — slides in, holds, slides out.
// Skipped once the POI is done.
export function usePoiGateNudge(
  hintRef: RefObject<HTMLDivElement | null>,
  gateNudgeAt: number,
  status: POIStatus,
) {
  useGSAP(
    () => {
      if (!gateNudgeAt || status === 'done') return
      const hint = hintRef.current
      if (!hint) return
      gsap.killTweensOf(hint)
      gsap
        .timeline()
        .fromTo(
          hint,
          { autoAlpha: 0, y: -4 },
          { autoAlpha: 1, y: 0, duration: 0.25, ease: 'power2.out' },
        )
        .to(hint, { autoAlpha: 0, y: -4, duration: 0.25, ease: 'power2.in' }, '+=1.6')
    },
    { dependencies: [gateNudgeAt, status], revertOnUpdate: true },
  )
}
