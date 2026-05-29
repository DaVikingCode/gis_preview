import type { FeatureCollection, LineString, Point } from 'geojson'
import posteSourceImg from '@/assets/photos/poste_source.webp'

export type POICategory = 'aerial' | 'underground' | 'source' | 'cabin'

export type POIProps = {
  id: number
  name: string
  category: POICategory
  commune: string
  voltage: string
  lastInspection: string
  anomalies: number
  notes: string
  /** Optional header photo (imported asset URL) shown at the top of the popup. */
  photo?: string
}

export const CATEGORY_META: Record<POICategory, { label: string; color: string; icon: string }> = {
  aerial: { label: 'Aérien H61', color: '#C82909', icon: '⚡' },
  underground: { label: 'Souterrain', color: '#7f1d1d', icon: '⚡' },
  source: { label: 'Poste source', color: '#ea580c', icon: '⚡' },
  cabin: { label: 'Cabine HTA/BT', color: '#b45309', icon: '⚡' },
}

export const SAMPLE_POIS: FeatureCollection<Point, POIProps> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [2.04, 47.428] },
      properties: {
        id: 1,
        name: 'P-4521 Poste source Salbris',
        category: 'source',
        commune: 'Salbris (41)',
        voltage: '90 / 20 kV',
        lastInspection: '2025-10-02',
        anomalies: 0,
        notes:
          "Poste source supervisé depuis l'agence Conduite Centre. Accès portail nord, code badge OPS.",
        photo: posteSourceImg,
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [1.87, 47.48] },
      properties: {
        id: 2,
        name: 'P-2034 La Borderie',
        category: 'aerial',
        commune: 'Mur-de-Sologne (41)',
        voltage: '20 kV',
        lastInspection: '2025-08-12',
        anomalies: 2,
        notes:
          'Transformateur 100 kVA sur poteau H61. Bardage à inspecter — corrosion signalée par drone.',
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [1.76, 47.42] },
      properties: {
        id: 3,
        name: 'P-1876 Les Granges',
        category: 'aerial',
        commune: 'Pruniers-en-Sologne (41)',
        voltage: '20 kV',
        lastInspection: '2025-09-03',
        anomalies: 0,
        notes: 'Transformateur 160 kVA. RAS dernière visite.',
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [1.745, 47.365] },
      properties: {
        id: 4,
        name: 'P-3201 Carrefour des Quatre-Chemins',
        category: 'underground',
        commune: 'Romorantin-Lanthenay (41)',
        voltage: '20 kV',
        lastInspection: '2025-07-21',
        anomalies: 1,
        notes:
          'Câble souterrain HN33-S-23. Défaut de gaine signalé en sortie de fourreau côté est.',
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [1.64, 47.395] },
      properties: {
        id: 5,
        name: 'P-1102 Bois Renault',
        category: 'aerial',
        commune: 'Lassay-sur-Croisne (41)',
        voltage: '20 kV',
        lastInspection: '2025-06-18',
        anomalies: 3,
        notes:
          'Élagage prioritaire — branchage à <2 m du conducteur. 3 anomalies détectées par survol.',
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [1.94, 47.395] },
      properties: {
        id: 6,
        name: 'P-2890 Chemin Vert',
        category: 'aerial',
        commune: 'Selles-Saint-Denis (41)',
        voltage: '20 kV',
        lastInspection: '2025-05-30',
        anomalies: 1,
        notes: 'Isolateur supérieur grain claqué — remplacement à programmer.',
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [1.835, 47.52] },
      properties: {
        id: 7,
        name: 'P-1543 Cabine Moulin Neuf',
        category: 'cabin',
        commune: 'Loreux (41)',
        voltage: '20 / 0,4 kV',
        lastInspection: '2025-08-25',
        anomalies: 0,
        notes: 'Cabine préfabriquée 250 kVA. Clé technicien sur boîtier porte nord.',
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [1.985, 47.5] },
      properties: {
        id: 8,
        name: 'P-3756 Étang du Coq',
        category: 'aerial',
        commune: 'Salbris (41)',
        voltage: '20 kV',
        lastInspection: '2025-09-14',
        anomalies: 2,
        notes:
          'Accès par chemin forestier — passage 4x4 recommandé après pluie. Nid détecté en tête de poteau.',
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [1.6, 47.44] },
      properties: {
        id: 9,
        name: 'P-2207 Plaine des Bouvreuils',
        category: 'aerial',
        commune: 'Marcilly-en-Gault (41)',
        voltage: '20 kV',
        lastInspection: '2025-07-08',
        anomalies: 0,
        notes: "Transformateur 50 kVA. Champ ouvert — pas d'élagage requis.",
      },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [1.795, 47.43] },
      properties: {
        id: 10,
        name: 'P-1990 Cabine La Charmoie',
        category: 'cabin',
        commune: 'Pruniers-en-Sologne (41)',
        voltage: '20 / 0,4 kV',
        lastInspection: '2025-08-30',
        anomalies: 1,
        notes: 'Cellule de protection 5 — défaut intermittent signalé en supervision.',
      },
    },
  ],
}

type LineProps = { kind: 'aerial' | 'underground' }

export const SAMPLE_HTA_LINES: FeatureCollection<LineString, LineProps> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { kind: 'aerial' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [2.04, 47.428],
          [2.01, 47.47],
          [1.985, 47.5],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { kind: 'aerial' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [1.985, 47.5],
          [1.91, 47.512],
          [1.835, 47.52],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { kind: 'aerial' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [1.835, 47.52],
          [1.86, 47.5],
          [1.87, 47.48],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { kind: 'aerial' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [2.04, 47.428],
          [1.99, 47.41],
          [1.94, 47.395],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { kind: 'aerial' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [1.94, 47.395],
          [1.85, 47.405],
          [1.76, 47.42],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { kind: 'underground' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [1.76, 47.42],
          [1.755, 47.395],
          [1.745, 47.365],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { kind: 'underground' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [1.745, 47.365],
          [1.77, 47.395],
          [1.795, 47.43],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { kind: 'aerial' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [1.745, 47.365],
          [1.67, 47.405],
          [1.6, 47.44],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { kind: 'aerial' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [1.6, 47.44],
          [1.62, 47.42],
          [1.64, 47.395],
        ],
      },
    },
  ],
}
