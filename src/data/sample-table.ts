import { ZONES, type Zone } from '@/data/sample-vectors'

export type RowStatus = 'actif' | 'en_attente' | 'anomalie' | 'archive'

export type TableUser = {
  name: string
  role: string
  initials: string
  // Hue (deg) seeding the avatar gradient — keeps each agent visually distinct.
  hue: number
}

// Business attributes layered on top of each map zone.
export type RowAttrs = {
  user: TableUser
  status: RowStatus
  coverage: number // 0–100, indexation %
  objects: number
  updatedAt: string // relative label, FR
  trend: number[] // 7-day series for the sparkline
}

export type DataRow = Zone & RowAttrs

// Keyed by zone id (see ZONES in sample-vectors). The map polygons and these
// rows are literally the same objects — two views of one dataset.
const ATTRS: Record<string, RowAttrs> = {
  'GIS-0142': {
    user: { name: 'Camille Roux', role: 'Géomaticienne', initials: 'CR', hue: 270 },
    status: 'actif',
    coverage: 94,
    objects: 1284,
    updatedAt: 'il y a 12 min',
    trend: [42, 48, 45, 51, 60, 58, 67],
  },
  'GIS-0218': {
    user: { name: 'Hugo Mercier', role: 'Viticulture', initials: 'HM', hue: 300 },
    status: 'actif',
    coverage: 86,
    objects: 942,
    updatedAt: 'il y a 38 min',
    trend: [50, 52, 55, 54, 59, 61, 64],
  },
  'GIS-0307': {
    user: { name: 'Inès Lefèvre', role: 'Analyste SIG', initials: 'IL', hue: 205 },
    status: 'actif',
    coverage: 88,
    objects: 902,
    updatedAt: 'il y a 3 h',
    trend: [30, 34, 38, 37, 44, 49, 53],
  },
  'GIS-0411': {
    user: { name: 'Léa Fontaine', role: 'Géomaticienne', initials: 'LF', hue: 140 },
    status: 'actif',
    coverage: 79,
    objects: 1675,
    updatedAt: 'il y a 5 h',
    trend: [55, 53, 58, 60, 59, 63, 68],
  },
  'GIS-0529': {
    user: { name: 'Hugo Mercier', role: 'Urbaniste', initials: 'HM', hue: 12 },
    status: 'anomalie',
    coverage: 61,
    objects: 3490,
    updatedAt: 'il y a 1 h',
    trend: [70, 64, 66, 52, 55, 48, 41],
  },
  'GIS-0634': {
    user: { name: 'Yanis Caron', role: 'Topographe', initials: 'YC', hue: 188 },
    status: 'en_attente',
    coverage: 42,
    objects: 2310,
    updatedAt: 'il y a 2 j',
    trend: [18, 22, 20, 26, 24, 29, 34],
  },
  'GIS-0712': {
    user: { name: 'Sofia Marchand', role: 'Urbaniste', initials: 'SM', hue: 8 },
    status: 'actif',
    coverage: 90,
    objects: 1788,
    updatedAt: 'il y a 24 min',
    trend: [60, 62, 61, 64, 66, 65, 70],
  },
  'GIS-0815': {
    user: { name: 'Théo Garnier', role: 'Technicien terrain', initials: 'TG', hue: 95 },
    status: 'en_attente',
    coverage: 53,
    objects: 1126,
    updatedAt: 'hier',
    trend: [40, 42, 41, 45, 47, 46, 50],
  },
  'GIS-0922': {
    user: { name: 'Nadia Bouchard', role: 'Chef de projet', initials: 'NB', hue: 45 },
    status: 'actif',
    coverage: 83,
    objects: 1402,
    updatedAt: 'il y a 4 h',
    trend: [44, 46, 48, 47, 52, 55, 58],
  },
  'GIS-1031': {
    user: { name: 'Adrien Faure', role: 'Aménagement', initials: 'AF', hue: 230 },
    status: 'actif',
    coverage: 71,
    objects: 765,
    updatedAt: 'il y a 40 min',
    trend: [28, 35, 33, 41, 46, 44, 52],
  },
  'GIS-1144': {
    user: { name: 'Inès Lefèvre', role: 'Analyste SIG', initials: 'IL', hue: 205 },
    status: 'archive',
    coverage: 100,
    objects: 318,
    updatedAt: 'il y a 9 j',
    trend: [40, 41, 40, 40, 39, 40, 40],
  },
  'GIS-1256': {
    user: { name: 'Théo Garnier', role: 'Technicien terrain', initials: 'TG', hue: 140 },
    status: 'en_attente',
    coverage: 47,
    objects: 2156,
    updatedAt: 'hier',
    trend: [22, 25, 24, 28, 30, 33, 31],
  },
  'GIS-1368': {
    user: { name: 'Camille Roux', role: 'Géomaticienne', initials: 'CR', hue: 160 },
    status: 'actif',
    coverage: 76,
    objects: 1893,
    updatedAt: 'il y a 6 h',
    trend: [48, 50, 49, 53, 56, 58, 61],
  },
  'GIS-1475': {
    user: { name: 'Léa Fontaine', role: 'Écologue', initials: 'LF', hue: 125 },
    status: 'anomalie',
    coverage: 58,
    objects: 2674,
    updatedAt: 'il y a 1 j',
    trend: [62, 58, 60, 54, 51, 49, 45],
  },
}

// Réordonne le tableau : les 3 zones les plus proches du centre de la bbox de toutes
// les zones passent en tête. Ce sont celles que le faux curseur survole au step « Vue
// tabulaire » — ainsi elles correspondent aux premières lignes ET restent à l'écran
// (jamais une zone hors cadre). Le reste garde son ordre d'origine.
const allX = ZONES.flatMap((z) => z.ring.map((p) => p[0]))
const allY = ZONES.flatMap((z) => z.ring.map((p) => p[1]))
const bboxCx = (Math.min(...allX) + Math.max(...allX)) / 2
const bboxCy = (Math.min(...allY) + Math.max(...allY)) / 2
const distToCenter = (z: Zone) => {
  const cx = z.ring.reduce((s, p) => s + p[0], 0) / z.ring.length
  const cy = z.ring.reduce((s, p) => s + p[1], 0) / z.ring.length
  return Math.hypot(cx - bboxCx, cy - bboxCy)
}
const centermost = new Set(
  [...ZONES]
    .sort((a, b) => distToCenter(a) - distToCenter(b))
    .slice(0, 3)
    .map((z) => z.id),
)
const ORDERED_ZONES: Zone[] = [
  ...ZONES.filter((z) => centermost.has(z.id)),
  ...ZONES.filter((z) => !centermost.has(z.id)),
]

export const SAMPLE_TABLE: DataRow[] = ORDERED_ZONES.map((z) => ({ ...z, ...ATTRS[z.id] }))
