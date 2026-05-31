import { useEffect, useRef } from 'react'
import maplibregl, { type Map as MLMap, type StyleSpecification } from 'maplibre-gl'
import { SWIPE_VIEW } from './swipe-view'
import { SmoothCursor } from '@/components/ui/smooth-cursor'
import { useSwipeAutoDrag } from '@/hooks/animations/useSwipeAutoDrag'

// IGN Géoportail open WMTS (no API key). The 1950-1965 historic orthophoto vs the
// current one make a dramatic before/after.
const orthoStyle = (layer: string, format: 'image/jpeg' | 'image/png'): StyleSpecification => ({
  version: 8,
  sources: {
    ortho: {
      type: 'raster',
      tiles: [
        'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0' +
          `&LAYER=${layer}&STYLE=normal&TILEMATRIXSET=PM` +
          `&FORMAT=${format}&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}`,
      ],
      tileSize: 256,
      attribution: 'IGN-F/Géoportail',
    },
  },
  layers: [{ id: 'ortho', type: 'raster', source: 'ortho' }],
})

// Full-screen overlay mounted only for the swipe step. Two self-contained maps
// (historic underneath / current on top, clipped to the right of a draggable handle),
// kept in sync. Removed on unmount. Hand-rolled to fully control the drag interaction
// (setPointerCapture stops the map from stealing the drag). The right→left auto-drag
// + Next gate live in useSwipeAutoDrag.
export function SwipeCompare() {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const beforeRef = useRef<HTMLDivElement | null>(null)
  const afterRef = useRef<HTMLDivElement | null>(null)
  const knobRef = useRef<HTMLDivElement | null>(null)
  const knobVisualRef = useRef<HTMLDivElement | null>(null)
  const handleRef = useRef<HTMLDivElement | null>(null)
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Clip the top (current) map to the right of the handle, revealing the historic one.
  // Shared by the manual drag and the scripted auto-drag (reads live refs each call).
  const setDividerX = (x: number) => {
    const wrapper = wrapperRef.current
    const afterEl = afterRef.current
    const handle = handleRef.current
    if (!wrapper || !afterEl || !handle) return
    const w = wrapper.clientWidth
    const cx = Math.max(0, Math.min(w, x))
    afterEl.style.clipPath = `inset(0 0 0 ${cx}px)`
    handle.style.left = `${cx}px`
  }

  const cursorHidden = useSwipeAutoDrag({
    wrapperRef,
    knobRef,
    knobVisualRef,
    setDividerX,
    reduced,
  })

  useEffect(() => {
    const wrapper = wrapperRef.current
    const beforeEl = beforeRef.current
    const afterEl = afterRef.current
    const knob = knobRef.current
    if (!wrapper || !beforeEl || !afterEl || !knob) return

    const common = {
      center: SWIPE_VIEW.center,
      zoom: SWIPE_VIEW.zoom,
      attributionControl: false as const,
    }
    const beforeMap = new maplibregl.Map({
      ...common,
      container: beforeEl,
      style: orthoStyle('ORTHOIMAGERY.ORTHOPHOTOS.1950-1965', 'image/png'),
    })
    const afterMap = new maplibregl.Map({
      ...common,
      container: afterEl,
      style: orthoStyle('ORTHOIMAGERY.ORTHOPHOTOS', 'image/jpeg'),
    })

    // Two-way camera sync with a re-entrancy guard.
    let syncing = false
    const mirror = (src: MLMap, dst: MLMap) => () => {
      if (syncing) return
      syncing = true
      dst.jumpTo({
        center: src.getCenter(),
        zoom: src.getZoom(),
        bearing: src.getBearing(),
        pitch: src.getPitch(),
      })
      syncing = false
    }
    const onBeforeMove = mirror(beforeMap, afterMap)
    const onAfterMove = mirror(afterMap, beforeMap)
    beforeMap.on('move', onBeforeMove)
    afterMap.on('move', onAfterMove)

    // The containers may not have their final height when the maps are created
    // (MapLibre then falls back to a 400×300 canvas). Resize once laid out, and
    // keep them in sync with the viewport — same approach as MapCanvas.
    const resizeBoth = () => {
      beforeMap.resize()
      afterMap.resize()
    }
    requestAnimationFrame(resizeBoth)
    const ro = new ResizeObserver(resizeBoth)
    ro.observe(wrapper)

    // The initial divider position is set by useSwipeAutoDrag (right edge, or center
    // in reduced-motion). Here we only keep it pinned on viewport resize.
    const onResize = () => {
      const handle = handleRef.current
      if (handle) setDividerX(handle.offsetLeft)
    }
    window.addEventListener('resize', onResize)

    const onMove = (ev: PointerEvent) => {
      const rect = wrapper.getBoundingClientRect()
      setDividerX(ev.clientX - rect.left)
    }
    const onUp = (ev: PointerEvent) => {
      try {
        knob.releasePointerCapture(ev.pointerId)
      } catch {
        /* already released */
      }
      knob.removeEventListener('pointermove', onMove)
      knob.removeEventListener('pointerup', onUp)
    }
    const onDown = (ev: PointerEvent) => {
      ev.preventDefault()
      ev.stopPropagation()
      knob.setPointerCapture(ev.pointerId)
      knob.addEventListener('pointermove', onMove)
      knob.addEventListener('pointerup', onUp)
    }
    knob.addEventListener('pointerdown', onDown)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', onResize)
      knob.removeEventListener('pointerdown', onDown)
      knob.removeEventListener('pointermove', onMove)
      knob.removeEventListener('pointerup', onUp)
      beforeMap.remove()
      afterMap.remove()
    }
  }, [])

  return (
    <>
      <div ref={wrapperRef} className="absolute inset-0 overflow-hidden" style={{ zIndex: 90 }}>
        {/* Inline position beats MapLibre's `.maplibregl-map { position: relative }`,
            which would otherwise override `.absolute` and collapse the height to 0. */}
        <div
          ref={beforeRef}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <div
          ref={afterRef}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />

        {/* Draggable divider */}
        <div ref={handleRef} className="absolute top-0 bottom-0" style={{ left: '50%', zIndex: 6 }}>
          <div className="absolute top-0 bottom-0 -translate-x-1/2 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]" />
          {/* Outer knob keeps the translate centering + pointer handling; the inner
              visual is what GSAP scales on press (no transform conflict). */}
          <div
            ref={knobRef}
            className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 h-11 w-11 flex items-center justify-center cursor-ew-resize select-none touch-none"
            style={{ pointerEvents: 'auto' }}
          >
            <div
              ref={knobVisualRef}
              className="h-full w-full rounded-full bg-white shadow-lg flex items-center justify-center"
            >
              <span className="text-black text-sm leading-none">⇆</span>
            </div>
          </div>
        </div>

        <div className="absolute top-4 left-4 rounded-md bg-black/70 px-2.5 py-1 text-xs font-medium text-white pointer-events-none">
          Ortho 1950–1965
        </div>
        <div className="absolute top-4 right-4 rounded-md bg-black/70 px-2.5 py-1 text-xs font-medium text-white pointer-events-none">
          Ortho actuelle
        </div>
      </div>

      {/* Faux curseur scripté — sibling du wrapper (zIndex:90 crée un stacking context
          qui le piégerait sous l'overlay driver.js). Non intrusif : le vrai curseur
          reste visible. Rendu uniquement hors mode réduit. */}
      {!reduced && (
        <SmoothCursor
          scripted
          hideSystemCursor={false}
          rotate={false}
          restAngle={-35}
          hidden={cursorHidden}
          zIndex={100120}
        />
      )}
    </>
  )
}
