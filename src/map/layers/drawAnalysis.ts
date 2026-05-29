import type { Map as MLMap, MapMouseEvent } from 'maplibre-gl'
import gsap from 'gsap'
import * as turf from '@turf/turf'
import type { Feature, FeatureCollection, Geometry, LineString, Point, Polygon } from 'geojson'
import { SAMPLE_POIS, type POICategory } from '@/data/sample-pois'
import {
  createTourCursor,
  createTourPulse,
  addFloodReveal,
  type TourPulse,
} from '@/animations/tourCursor'

// Predefined demo zone (ring WITHOUT the closing point — refresh() re-appends ring[0]).
// Chosen to enclose 4 HTA posts around the draw step's center [1.85, 47.44]:
// #2 La Borderie (aérien), #3 Les Granges (aérien), #6 Chemin Vert (aérien),
// #10 Cabine La Charmoie (cabine).
export const DRAW_DEMO_POLYGON: [number, number][] = [
  [1.745, 47.4],
  [1.72, 47.46],
  [1.84, 47.5],
  [1.975, 47.47],
  [1.985, 47.385],
  [1.86, 47.37],
]

const SRC_PTS = 'gp-draw-pts'
const SRC_LINE = 'gp-draw-line'
const SRC_FILL = 'gp-draw-fill'
const SRC_HIT = 'gp-draw-hit'
const SRC_ALL = 'gp-draw-all'
const LYR_FILL = 'gp-draw-fill'
const LYR_LINE = 'gp-draw-line'
const LYR_PTS = 'gp-draw-pts-circle'
const LYR_HIT = 'gp-draw-hit-circle'
const LYR_ALL = 'gp-draw-all-circle'

export type DrawStats = {
  areaKm2: number
  vertices: number
  closed: boolean
  poiCount: number
  byCategory: Record<POICategory, number>
}

export type DrawHandle = {
  detach: () => void
}

export type DrawOptions = {
  // Auto-trace a predefined polygon instead of letting the user click. Clicks are
  // left unbound so they can't interfere with the scripted draw.
  auto?: boolean
  polygon?: [number, number][]
  stepMs?: number
  // Tracé terminé : remplissage propagé, on déverrouille la suite (Next + chart).
  onComplete?: () => void
  // Dernier clic posé : on masque le faux curseur tout de suite, sans attendre le
  // remplissage qui suit.
  onLastClick?: () => void
}

export const emptyDrawStats = (): DrawStats => ({
  areaKm2: 0,
  vertices: 0,
  closed: false,
  poiCount: 0,
  byCategory: { aerial: 0, underground: 0, source: 0, cabin: 0 },
})

// Interactive polygon draw + live spatial query: click to add vertices, double-click
// to close. As soon as 3 vertices exist we auto-close the ring for live area (Turf)
// and count the HTA posts (SAMPLE_POIS) falling inside (point-in-polygon).
export function addDrawAnalysis(
  map: MLMap,
  onChange: (stats: DrawStats) => void,
  opts?: DrawOptions,
): DrawHandle {
  const points: { lng: number; lat: number }[] = []
  let closed = false
  const interactive = !opts?.auto
  let tl: gsap.core.Timeline | null = null
  let pulse: TourPulse | null = null

  const empty = <T extends Geometry>(): FeatureCollection<T> => ({
    type: 'FeatureCollection',
    features: [],
  })

  if (!map.getSource(SRC_FILL)) map.addSource(SRC_FILL, { type: 'geojson', data: empty<Polygon>() })
  if (!map.getSource(SRC_LINE))
    map.addSource(SRC_LINE, { type: 'geojson', data: empty<LineString>() })
  if (!map.getSource(SRC_PTS)) map.addSource(SRC_PTS, { type: 'geojson', data: empty<Point>() })
  if (!map.getSource(SRC_HIT)) map.addSource(SRC_HIT, { type: 'geojson', data: empty<Point>() })
  // All HTA posts as a reference layer so the user knows where to draw.
  if (!map.getSource(SRC_ALL)) {
    map.addSource(SRC_ALL, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: SAMPLE_POIS.features.map((f) => ({
          type: 'Feature',
          geometry: f.geometry,
          properties: {},
        })),
      },
    })
  }

  if (!map.getLayer(LYR_FILL)) {
    map.addLayer({
      id: LYR_FILL,
      type: 'fill',
      source: SRC_FILL,
      paint: { 'fill-color': '#22d3ee', 'fill-opacity': 0.18 },
    })
  }
  if (!map.getLayer(LYR_ALL)) {
    map.addLayer({
      id: LYR_ALL,
      type: 'circle',
      source: SRC_ALL,
      paint: {
        'circle-radius': 4,
        'circle-color': '#94a3b8',
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 1,
      },
    })
  }
  if (!map.getLayer(LYR_LINE)) {
    map.addLayer({
      id: LYR_LINE,
      type: 'line',
      source: SRC_LINE,
      paint: { 'line-color': '#06b6d4', 'line-width': 2.5, 'line-dasharray': [2, 1] },
    })
  }
  // HTA posts inside the polygon, highlighted.
  if (!map.getLayer(LYR_HIT)) {
    map.addLayer({
      id: LYR_HIT,
      type: 'circle',
      source: SRC_HIT,
      paint: {
        'circle-radius': 7,
        'circle-color': '#f59e0b',
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 2,
      },
    })
  }
  if (!map.getLayer(LYR_PTS)) {
    map.addLayer({
      id: LYR_PTS,
      type: 'circle',
      source: SRC_PTS,
      paint: {
        'circle-radius': 4,
        'circle-color': '#fff',
        'circle-stroke-color': '#06b6d4',
        'circle-stroke-width': 2,
      },
    })
  }

  const setData = (id: string, data: FeatureCollection) =>
    (map.getSource(id) as maplibregl.GeoJSONSource | undefined)?.setData(data)

  const refresh = () => {
    setData(SRC_PTS, {
      type: 'FeatureCollection',
      features: points.map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: {},
      })),
    })

    const stats = emptyDrawStats()
    stats.vertices = points.length
    stats.closed = closed

    if (points.length >= 3) {
      const ring = points.map((p) => [p.lng, p.lat] as [number, number])
      ring.push(ring[0]) // auto-close for live preview
      const polygon = turf.polygon([ring])

      setData(SRC_FILL, { type: 'FeatureCollection', features: [polygon as Feature<Polygon>] })
      setData(SRC_LINE, {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: ring },
            properties: {},
          },
        ],
      })

      stats.areaKm2 = turf.area(polygon) / 1_000_000

      const inside: Feature<Point>[] = []
      for (const f of SAMPLE_POIS.features) {
        if (turf.booleanPointInPolygon(f.geometry.coordinates, polygon)) {
          stats.poiCount += 1
          stats.byCategory[f.properties.category] += 1
          inside.push({ type: 'Feature', geometry: f.geometry, properties: {} })
        }
      }
      setData(SRC_HIT, { type: 'FeatureCollection', features: inside })
    } else {
      setData(SRC_FILL, { type: 'FeatureCollection', features: [] })
      setData(SRC_HIT, { type: 'FeatureCollection', features: [] })
      setData(SRC_LINE, {
        type: 'FeatureCollection',
        features:
          points.length >= 2
            ? [
                {
                  type: 'Feature',
                  geometry: {
                    type: 'LineString',
                    coordinates: points.map((p) => [p.lng, p.lat]),
                  },
                  properties: {},
                },
              ]
            : [],
      })
    }

    onChange(stats)
  }

  const onClick = (e: MapMouseEvent) => {
    if (closed) {
      // Start a fresh polygon.
      points.length = 0
      closed = false
    }
    points.push({ lng: e.lngLat.lng, lat: e.lngLat.lat })
    refresh()
  }
  const onDblClick = (e: MapMouseEvent) => {
    e.preventDefault()
    if (points.length >= 3) closed = true
    refresh()
  }

  if (interactive) {
    map.getCanvas().style.cursor = 'crosshair'
    map.doubleClickZoom.disable()
    map.on('click', onClick)
    map.on('dblclick', onDblClick)
  } else {
    // Auto mode: scripted trace, no user input. Reveal the predefined ring vertex
    // by vertex so the live area/count climb as it draws, then close it.
    const ring = opts?.polygon ?? DRAW_DEMO_POLYGON
    const stepSec = (opts?.stepMs ?? 700) / 1000
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      for (const [lng, lat] of ring) points.push({ lng, lat })
      closed = true
      refresh()
      opts?.onLastClick?.()
      opts?.onComplete?.()
    } else {
      tl = gsap.timeline()
      const cursor = createTourCursor(map)
      const click = createTourPulse(map, '#22d3ee')
      pulse = click
      const GLIDE = Math.min(0.4, stepSec * 0.5)
      // En mode auto, on masque le remplissage live pendant le tracé : il sera
      // révélé par propagation depuis le coin de fin.
      if (map.getLayer(LYR_FILL)) map.setPaintProperty(LYR_FILL, 'fill-opacity', 0)
      ring.forEach(([lng, lat], i) => {
        const at = i * stepSec
        // Le faux curseur glisse vers le sommet…
        cursor.glideTo(tl!, [lng, lat], { at, duration: GLIDE })
        // …puis « clique » : sommet posé + pulse, juste après son arrivée.
        tl!.call(
          () => {
            points.push({ lng, lat })
            refresh()
            click.pulse([lng, lat])
          },
          [],
          at + GLIDE,
        )
      })
      // Le curseur revient au 1er point → la zone se referme (fill encore invisible).
      cursor.glideTo(tl, ring[0], { at: '>', duration: GLIDE })
      tl.call(() => {
        closed = true
        refresh()
      })
      // Final : presse du curseur (onde), puis le remplissage se propage DEPUIS le
      // coin de fermeture, et la zone s'assombrit un cran.
      const REVEAL = 'reveal'
      tl.addLabel(REVEAL)
      cursor.finishAt(tl, ring[0], { pulse: click, at: REVEAL })
      // Le dernier clic est posé : on cache le curseur dès maintenant (il s'efface
      // pendant que le remplissage se propage, au lieu d'attendre la fin).
      tl.call(() => opts?.onLastClick?.(), [], REVEAL)
      addFloodReveal(tl, map, {
        ring,
        source: SRC_FILL,
        layer: LYR_FILL,
        base: 0.18,
        dark: 0.3,
        at: REVEAL,
      })
      tl.call(() => opts?.onComplete?.())
    }
  }

  return {
    detach() {
      tl?.kill()
      tl = null
      pulse?.remove()
      pulse = null
      if (interactive) {
        map.off('click', onClick)
        map.off('dblclick', onDblClick)
        map.doubleClickZoom.enable()
        map.getCanvas().style.cursor = ''
      }
      for (const id of [LYR_PTS, LYR_HIT, LYR_LINE, LYR_ALL, LYR_FILL])
        if (map.getLayer(id)) map.removeLayer(id)
      for (const id of [SRC_PTS, SRC_HIT, SRC_LINE, SRC_ALL, SRC_FILL])
        if (map.getSource(id)) map.removeSource(id)
      points.length = 0
      onChange(emptyDrawStats())
    },
  }
}
