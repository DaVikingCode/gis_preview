import type { FeatureCollection, Polygon } from 'geojson'

const CATEGORIES = ['agricole', 'urbain', 'industriel', 'forêt'] as const
export type VectorCategory = (typeof CATEGORIES)[number]

export type Zone = {
  id: string
  name: string
  code: string
  category: VectorCategory
  // Closed polygon ring (lng,lat) — drives both the map fill and the table preview.
  ring: [number, number][]
}

type RawZone = {
  id: string
  name: string
  code: string
  category: VectorCategory
  center: [number, number]
  r: number
  seed: number
}

// Hand-placed parcels around Dijon (Côte-d'Or). Each gets a straight-edged
// outline whose shape matches its land-use category, generated deterministically
// from its seed (skewed farm parcel, orthogonal city block, chamfered industrial
// plot, angular natural-reserve outline) — no overlap, like real cadastral data.
// Scattered (off-grid) across the Côte-d'Or around Dijon, with varied sizes —
// chaotic placement, but spaced + sized so the parcels never overlap.
const RAW: RawZone[] = [
  // agricole — vignobles & plaine
  {
    id: 'GIS-0142',
    name: 'Climats de la Côte de Nuits',
    code: 'PAR-0142',
    category: 'agricole',
    center: [5.182, 47.116],
    r: 0.015,
    seed: 3,
  },
  {
    id: 'GIS-0218',
    name: 'Coteaux de Gevrey-Chambertin',
    code: 'PAR-0218',
    category: 'agricole',
    center: [4.952, 47.133],
    r: 0.019,
    seed: 7,
  },
  {
    id: 'GIS-0307',
    name: 'Vignes de Marsannay',
    code: 'PAR-0307',
    category: 'agricole',
    center: [4.842, 47.226],
    r: 0.016,
    seed: 11,
  },
  {
    id: 'GIS-0411',
    name: 'Plaine de la Saône',
    code: 'PAR-0411',
    category: 'agricole',
    center: [5.216, 47.236],
    r: 0.021,
    seed: 5,
  },
  // urbain — Dijon & communes
  {
    id: 'GIS-0529',
    name: 'Centre — Dijon',
    code: 'PAR-0529',
    category: 'urbain',
    center: [5.073, 47.319],
    r: 0.02,
    seed: 9,
  },
  {
    id: 'GIS-0634',
    name: 'Chenôve',
    code: 'PAR-0634',
    category: 'urbain',
    center: [4.949, 47.204],
    r: 0.017,
    seed: 13,
  },
  {
    id: 'GIS-0712',
    name: 'Quetigny',
    code: 'PAR-0712',
    category: 'urbain',
    center: [5.206, 47.346],
    r: 0.019,
    seed: 17,
  },
  {
    id: 'GIS-0815',
    name: 'Talant',
    code: 'PAR-0815',
    category: 'urbain',
    center: [4.929, 47.344],
    r: 0.018,
    seed: 23,
  },
  // industriel — zones d'activités
  {
    id: 'GIS-0922',
    name: 'ZA de Longvic',
    code: 'PAR-0922',
    category: 'industriel',
    center: [5.113, 47.231],
    r: 0.022,
    seed: 29,
  },
  {
    id: 'GIS-1031',
    name: 'Cap Nord',
    code: 'PAR-1031',
    category: 'industriel',
    center: [5.012, 47.406],
    r: 0.02,
    seed: 31,
  },
  {
    id: 'GIS-1144',
    name: 'Port du Canal',
    code: 'PAR-1144',
    category: 'industriel',
    center: [5.158, 47.399],
    r: 0.018,
    seed: 37,
  },
  // forêt — massifs & combes
  {
    id: 'GIS-1256',
    name: 'Forêt de Plombières',
    code: 'PAR-1256',
    category: 'forêt',
    center: [4.886, 47.409],
    r: 0.024,
    seed: 41,
  },
  {
    id: 'GIS-1368',
    name: 'Combe à la Serpent',
    code: 'PAR-1368',
    category: 'forêt',
    center: [4.861, 47.301],
    r: 0.022,
    seed: 43,
  },
  {
    id: 'GIS-1475',
    name: 'Bois de Velars',
    code: 'PAR-1475',
    category: 'forêt',
    center: [5.042, 47.155],
    r: 0.02,
    seed: 47,
  },
]

// --- Deterministic, category-specific outline generation -------------------
type Pt = [number, number]

// Small LCG so each zone's outline is stable across renders.
function makeRng(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

const rot = (p: Pt, a: number): Pt => [
  p[0] * Math.cos(a) - p[1] * Math.sin(a),
  p[0] * Math.sin(a) + p[1] * Math.cos(a),
]

// Local planar offsets (in latitude-degree units) → closed lng/lat ring, with
// longitude squashed by latitude so shapes don't look stretched.
function toRing([clng, clat]: Pt, pts: Pt[]): Pt[] {
  const lngScale = 1 / Math.cos((clat * Math.PI) / 180)
  const ring: Pt[] = pts.map(([x, y]) => [
    Number((clng + x * lngScale).toFixed(5)),
    Number((clat + y).toFixed(5)),
  ])
  ring.push(ring[0])
  return ring
}

// Subdivide each edge and nudge the inserted vertex off-line — adds an irregular,
// hand-digitized chaos to an otherwise clean outline (small enough to stay simple).
function roughen(pts: Pt[], rand: () => number, amp: number): Pt[] {
  if (amp <= 0) return pts
  const out: Pt[] = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    out.push(a)
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len = Math.hypot(dx, dy) || 1
    const t = 0.4 + rand() * 0.2
    const off = (rand() - 0.5) * 2 * amp * len
    out.push([a[0] + dx * t - (dy / len) * off, a[1] + dy * t + (dx / len) * off])
  }
  return out
}

// agricole — skewed, tapered field parcel.
function fieldRing(rand: () => number, r: number): Pt[] {
  const w = r * (1.2 + rand() * 0.7)
  const h = r * (0.55 + rand() * 0.4)
  const skew = (rand() - 0.5) * 0.85 * w
  const taper = (rand() - 0.5) * 0.6 * w
  const quad: Pt[] = [
    [-w, -h],
    [w, -h],
    [w + taper, h],
    [-w + skew, h],
  ]
  const a = (rand() - 0.5) * Math.PI
  return quad.map((p) => rot(p, a))
}

// urbain — compact orthogonal city block with a carved corner (right angles).
function blockRing(rand: () => number, r: number): Pt[] {
  const w = r * (0.85 + rand() * 0.3)
  const h = r * (0.8 + rand() * 0.3)
  const nx = w * (0.35 + rand() * 0.3)
  const ny = h * (0.35 + rand() * 0.3)
  const block: Pt[] = [
    [-w, -h],
    [w, -h],
    [w, h - ny],
    [w - nx, h - ny],
    [w - nx, h],
    [-w, h],
  ]
  // street-grid orientation: a quarter turn plus a small rotation.
  const a = (rand() - 0.5) * 0.5 + Math.floor(rand() * 4) * (Math.PI / 2)
  return block.map((p) => rot(p, a))
}

// industriel — elongated plot with one chamfered corner (quay / warehouse footprint).
function plotRing(rand: () => number, r: number): Pt[] {
  const w = r * (1.05 + rand() * 0.45)
  const h = r * (0.65 + rand() * 0.25)
  const c = Math.min(w, h) * (0.35 + rand() * 0.3)
  const plot: Pt[] = [
    [-w, -h],
    [w - c, -h],
    [w, -h + c],
    [w, h],
    [-w, h],
  ]
  const a = (rand() - 0.5) * Math.PI
  return plot.map((p) => rot(p, a))
}

// forêt — irregular angular polygon, jagged radii, coarsely digitized.
function naturalRing(rand: () => number, r: number): Pt[] {
  const n = 8 + Math.floor(rand() * 5) // 8–12 sides
  const step = (Math.PI * 2) / n
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) {
    // jitter angle < half a step so vertices stay ordered → simple polygon
    const ang = i * step + (rand() - 0.5) * step * 0.85
    const rad = r * (0.5 + rand() * 0.95) // strong radius variation → jagged
    pts.push([Math.cos(ang) * rad, Math.sin(ang) * rad])
  }
  return pts
}

function makeRing(z: RawZone): Pt[] {
  const rand = makeRng(z.seed)
  const local =
    z.category === 'agricole'
      ? fieldRing(rand, z.r)
      : z.category === 'urbain'
        ? blockRing(rand, z.r)
        : z.category === 'industriel'
          ? plotRing(rand, z.r)
          : naturalRing(rand, z.r)
  // Roughen the outline a touch (more for natural land, less for built blocks).
  const amp =
    z.category === 'agricole'
      ? 0.13
      : z.category === 'urbain'
        ? 0.06
        : z.category === 'industriel'
          ? 0.08
          : 0.15
  return toRing(z.center, roughen(local, rand, amp))
}

export const ZONES: Zone[] = RAW.map((z) => ({
  id: z.id,
  name: z.name,
  code: z.code,
  category: z.category,
  ring: makeRing(z),
}))

export const SAMPLE_VECTORS: FeatureCollection<
  Polygon,
  { id: string; name: string; category: VectorCategory }
> = {
  type: 'FeatureCollection',
  features: ZONES.map((z) => ({
    type: 'Feature',
    properties: { id: z.id, name: z.name, category: z.category },
    geometry: { type: 'Polygon', coordinates: [z.ring] },
  })),
}
