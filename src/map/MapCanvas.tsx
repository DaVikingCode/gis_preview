import { useEffect, useRef, useState, type ReactNode } from 'react'
import maplibregl, { Map as MLMap } from 'maplibre-gl'
import { MapContext } from './MapContext'
import { BASEMAPS } from './basemaps'

export function MapCanvas({ children }: { children?: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MLMap | null>(null)
  const [map, setMap] = useState<MLMap | null>(null)

  useEffect(() => {
    if (!ref.current || mapRef.current) return
    const m = new maplibregl.Map({
      container: ref.current,
      style: BASEMAPS.positron.style as never,
      center: [2.349, 48.853],
      zoom: 15.5,
      pitch: 60,
      bearing: -17,
      maxPitch: 80,
      // Keep more tiles in memory so already-loaded / revisited views aren't
      // evicted mid-tour (complements the HTTP-cache prewarming in prewarm.ts).
      maxTileCacheSize: 1500,
      attributionControl: { compact: true },
    })
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
    m.on('load', () => {
      mapRef.current = m
      setMap(m)
      requestAnimationFrame(() => m.resize())
    })
    const ro = new ResizeObserver(() => m.resize())
    ro.observe(ref.current)
    return () => {
      ro.disconnect()
      m.remove()
      mapRef.current = null
      setMap(null)
    }
  }, [])

  return (
    <>
      <div
        ref={ref}
        id="map-canvas"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
        }}
      />
      {map && <MapContext.Provider value={map}>{children}</MapContext.Provider>}
    </>
  )
}
