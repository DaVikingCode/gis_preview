import type { ComponentType } from 'react'
import {
  Map,
  Building2,
  Spline,
  MapPin,
  Flame,
  FileJson,
  Database,
  Globe,
  Table2,
} from 'lucide-react'

// Fake "business" data backing the workspace sidebar. Generic GIS workspace —
// not tied to the tour's HTA narrative, just plausible cartography metadata.

export const WORKSPACE = {
  name: 'DaVikingCode',
  plan: 'GIS',
} as const

export type WorkspaceLayer = {
  id: string
  label: string
  Icon: ComponentType<{ className?: string }>
  count: number
  visible: boolean
}

export const LAYERS: WorkspaceLayer[] = [
  { id: 'cadastre', label: 'Cadastre', Icon: Map, count: 1240, visible: true },
  { id: 'buildings', label: 'Bâtiments 3D', Icon: Building2, count: 8932, visible: true },
  { id: 'network', label: 'Réseau', Icon: Spline, count: 412, visible: true },
  { id: 'poi', label: 'Points d’intérêt', Icon: MapPin, count: 57, visible: false },
  { id: 'heatmap', label: 'Densité', Icon: Flame, count: 1160, visible: false },
]

export type WorkspaceDataset = {
  id: string
  name: string
  format: 'GeoJSON' | 'Shapefile' | 'WMTS' | 'CSV'
  Icon: ComponentType<{ className?: string }>
  records: number
  updated: string
}

export const DATASETS: WorkspaceDataset[] = [
  {
    id: 'parcelles',
    name: 'parcelles_2024',
    format: 'Shapefile',
    Icon: Database,
    records: 48392,
    updated: 'il y a 2 h',
  },
  {
    id: 'communes',
    name: 'communes.geojson',
    format: 'GeoJSON',
    Icon: FileJson,
    records: 34968,
    updated: 'hier',
  },
  {
    id: 'ortho',
    name: 'ortho_ign_2023',
    format: 'WMTS',
    Icon: Globe,
    records: 0,
    updated: 'il y a 6 j',
  },
  {
    id: 'capteurs',
    name: 'capteurs_terrain.csv',
    format: 'CSV',
    Icon: Table2,
    records: 1160,
    updated: 'il y a 12 j',
  },
]

export type WorkspaceActivity = {
  id: string
  user: string
  initials: string
  action: string
  target: string
  ago: string
}

export const ACTIVITY: WorkspaceActivity[] = [
  {
    id: 'a1',
    user: 'Camille',
    initials: 'CR',
    action: 'a importé',
    target: 'parcelles_2024',
    ago: '2 h',
  },
  {
    id: 'a2',
    user: 'Naïm',
    initials: 'NB',
    action: 'a stylé',
    target: 'la couche Réseau',
    ago: '5 h',
  },
  {
    id: 'a3',
    user: 'Léa',
    initials: 'LM',
    action: 'a publié',
    target: 'Atlas Urbain',
    ago: 'hier',
  },
  {
    id: 'a4',
    user: 'Camille',
    initials: 'CR',
    action: 'a annoté',
    target: '3 parcelles',
    ago: 'hier',
  },
]

export const CURRENT_USER = {
  name: 'Camille Rousseau',
  role: 'Analyste SIG',
  email: 'camille.rousseau@davikingcode.com',
  initials: 'CR',
} as const
