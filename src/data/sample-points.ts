import type { FeatureCollection, Point } from 'geojson'

// Clustered random points around major French cities — for the heatmap demo.
const CLUSTERS: { name: string; center: [number, number]; count: number }[] = [
  { name: 'Paris', center: [2.349, 48.853], count: 320 },
  { name: 'Lyon', center: [4.835, 45.764], count: 180 },
  { name: 'Marseille', center: [5.367, 43.296], count: 160 },
  { name: 'Bordeaux', center: [-0.578, 44.838], count: 110 },
  { name: 'Toulouse', center: [1.444, 43.604], count: 95 },
  { name: 'Nantes', center: [-1.553, 47.218], count: 80 },
  { name: 'Lille', center: [3.057, 50.629], count: 70 },
  { name: 'Strasbourg', center: [7.752, 48.573], count: 60 },
  { name: 'Dijon', center: [5.0415, 47.322], count: 45 },
  { name: 'Rennes', center: [-1.679, 48.117], count: 40 },
]

function gauss() {
  // Box-Muller
  const u1 = Math.random() || 1e-9,
    u2 = Math.random()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

export const SAMPLE_POINTS: FeatureCollection<Point, { weight: number; city: string }> = {
  type: 'FeatureCollection',
  features: CLUSTERS.flatMap((c) =>
    Array.from({ length: c.count }, () => {
      const lng = c.center[0] + gauss() * 0.18
      const lat = c.center[1] + gauss() * 0.12
      return {
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [lng, lat] },
        properties: { weight: Math.random() * 0.5 + 0.5, city: c.name },
      }
    }),
  ),
}

export const HEATMAP_CITY_COUNTS = CLUSTERS.map((c) => ({ name: c.name, value: c.count }))
  .sort((a, b) => b.value - a.value)
  .slice(0, 5)
