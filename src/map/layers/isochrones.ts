import type { Map as MLMap } from 'maplibre-gl'
import * as turf from '@turf/turf'
import type { Feature, Polygon } from 'geojson'
import { ISOCHRONES, ISOCHRONE_CENTER, type IsochroneMinutes } from '@/data/sample-isochrones'
import { SAMPLE_POIS } from '@/data/sample-pois'

const SRC = 'gp-isochrones'
const SRC_CENTER = 'gp-isochrone-center'
const LYR_CENTER = 'gp-isochrone-center-circle'

// Outer → inner so smaller bands paint on top. Color reads "proche = chaud".
const BANDS: { minutes: IsochroneMinutes; color: string }[] = [
  { minutes: 15, color: '#86efac' },
  { minutes: 10, color: '#fcd34d' },
  { minutes: 5, color: '#fb923c' },
]

export type IsochroneStats = {
  minutes: IsochroneMinutes
  areaKm2: number
  poiCount: number
}

const fillId = (m: number) => `gp-iso-fill-${m}`
const lineId = (m: number) => `gp-iso-line-${m}`

export function addIsochrones(map: MLMap) {
  if (!map.getSource(SRC)) map.addSource(SRC, { type: 'geojson', data: ISOCHRONES })

  for (const { minutes, color } of BANDS) {
    if (!map.getLayer(fillId(minutes))) {
      map.addLayer({
        id: fillId(minutes),
        type: 'fill',
        source: SRC,
        filter: ['==', ['get', 'minutes'], minutes],
        paint: { 'fill-color': color, 'fill-opacity': 0 }, // revealed below
      })
    }
    if (!map.getLayer(lineId(minutes))) {
      map.addLayer({
        id: lineId(minutes),
        type: 'line',
        source: SRC,
        filter: ['==', ['get', 'minutes'], minutes],
        paint: { 'line-color': color, 'line-width': 1.5, 'line-opacity': 0 },
      })
    }
  }

  // Maintenance center marker.
  if (!map.getSource(SRC_CENTER)) {
    map.addSource(SRC_CENTER, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: ISOCHRONE_CENTER },
            properties: {},
          },
        ],
      },
    })
  }
  if (!map.getLayer(LYR_CENTER)) {
    map.addLayer({
      id: LYR_CENTER,
      type: 'circle',
      source: SRC_CENTER,
      paint: {
        'circle-radius': 6,
        'circle-color': '#0ea5e9',
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 2,
      },
    })
  }

  // Staggered reveal: outer band first, then inner.
  const timers: ReturnType<typeof setTimeout>[] = []
  BANDS.forEach((b, i) => {
    timers.push(
      setTimeout(
        () => {
          if (map.getLayer(fillId(b.minutes)))
            map.setPaintProperty(fillId(b.minutes), 'fill-opacity', 0.45)
          if (map.getLayer(lineId(b.minutes)))
            map.setPaintProperty(lineId(b.minutes), 'line-opacity', 0.9)
        },
        250 + i * 350,
      ),
    )
  })
  ;(map as MLMap & { __gpIsoTimers?: ReturnType<typeof setTimeout>[] }).__gpIsoTimers = timers
}

export function removeIsochrones(map: MLMap) {
  const m = map as MLMap & { __gpIsoTimers?: ReturnType<typeof setTimeout>[] }
  m.__gpIsoTimers?.forEach(clearTimeout)
  m.__gpIsoTimers = undefined
  for (const { minutes } of BANDS) {
    if (map.getLayer(lineId(minutes))) map.removeLayer(lineId(minutes))
    if (map.getLayer(fillId(minutes))) map.removeLayer(fillId(minutes))
  }
  if (map.getLayer(LYR_CENTER)) map.removeLayer(LYR_CENTER)
  if (map.getSource(SRC)) map.removeSource(SRC)
  if (map.getSource(SRC_CENTER)) map.removeSource(SRC_CENTER)
}

// Area per band + HTA posts reachable within each band (point-in-polygon).
export function computeIsochroneStats(): IsochroneStats[] {
  return BANDS.map(({ minutes }) => {
    const feature = ISOCHRONES.features.find((f) => f.properties.minutes === minutes) as
      | Feature<Polygon, { minutes: IsochroneMinutes }>
      | undefined
    if (!feature) return { minutes, areaKm2: 0, poiCount: 0 }
    const poiCount = SAMPLE_POIS.features.filter((p) =>
      turf.booleanPointInPolygon(p.geometry.coordinates, feature),
    ).length
    return { minutes, areaKm2: turf.area(feature) / 1_000_000, poiCount }
  }).sort((a, b) => a.minutes - b.minutes)
}
