import * as turf from '@turf/turf'
import type { FeatureCollection, Polygon } from 'geojson'

export type IsochroneMinutes = 5 | 10 | 15
export type IsochroneProps = { minutes: IsochroneMinutes }

// Centre de maintenance fictif au cœur du réseau HTA Sologne.
export const ISOCHRONE_CENTER: [number, number] = [1.85, 47.44]

// NOTE: polygones lobés générés de façon déterministe (look "routier") en attendant
// le remplacement par la vraie sortie OpenRouteService (driving-car, range 300/600/900 s).
// Aucun appel réseau au runtime — la FeatureCollection ci-dessous est figée au chargement.
const BANDS: { minutes: IsochroneMinutes; baseKm: number; phase: number }[] = [
  { minutes: 5, baseKm: 5, phase: 0.6 },
  { minutes: 10, baseKm: 10, phase: 1.4 },
  { minutes: 15, baseKm: 15, phase: 2.1 },
]

const STEPS = 60

function lobedRing(baseKm: number, phase: number): [number, number][] {
  const ring: [number, number][] = []
  for (let i = 0; i <= STEPS; i++) {
    const bearing = (360 / STEPS) * i
    const t = (bearing * Math.PI) / 180
    // Deterministic radius variation → irregular, road-like contour.
    const variation = 1 + 0.2 * Math.sin(3 * t + phase) + 0.1 * Math.cos(5 * t - phase)
    const dest = turf.destination(ISOCHRONE_CENTER, baseKm * variation, bearing, {
      units: 'kilometers',
    })
    ring.push(dest.geometry.coordinates as [number, number])
  }
  return ring
}

export const ISOCHRONES: FeatureCollection<Polygon, IsochroneProps> = {
  type: 'FeatureCollection',
  features: BANDS.map(({ minutes, baseKm, phase }) => ({
    type: 'Feature',
    properties: { minutes },
    geometry: { type: 'Polygon', coordinates: [lobedRing(baseKm, phase)] },
  })),
}
