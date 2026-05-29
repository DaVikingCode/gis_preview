import { useEffect } from 'react'
import { useMap } from './MapContext'
import { useTourStore } from '@/store/tour-store'

const IDLE_ROTATION_DEG_PER_SEC = 3

export function CinematicCamera() {
  const map = useMap()
  const active = useTourStore((s) => s.cinematicActive)

  useEffect(() => {
    if (!active) return
    let raf = 0
    let last = performance.now()
    let userInteracting = false

    const flagOn = () => {
      userInteracting = true
    }
    const flagOff = () => {
      userInteracting = false
    }

    // Pause rotation while user is dragging/zooming so we don't fight input.
    map.on('mousedown', flagOn)
    map.on('touchstart', flagOn)
    map.on('mouseup', flagOff)
    map.on('touchend', flagOff)

    const tick = (now: number) => {
      const dt = Math.min(now - last, 100) / 1000
      last = now
      if (!userInteracting) {
        const next = (map.getBearing() + IDLE_ROTATION_DEG_PER_SEC * dt) % 360
        map.setBearing(next)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      map.off('mousedown', flagOn)
      map.off('touchstart', flagOn)
      map.off('mouseup', flagOff)
      map.off('touchend', flagOff)
    }
  }, [active, map])

  return null
}
