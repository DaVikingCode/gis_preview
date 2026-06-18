import { create } from 'zustand'
import type { IsochroneStats } from '@/map/layers/isochrones'
import type { RealtimeFeed } from '@/map/layers/realtime'
import type { PointCloudHandle } from '@/map/layers/pointCloud.shared'

export type MeasurePoint = { lng: number; lat: number }
export type POIStatus = 'todo' | 'in_progress' | 'done'
export type FlightStats = { altitudeM: number; speedKmh: number; headingDeg: number }
export type PointCloudStats = {
  count: number
  footprintM: [number, number]
  zRangeM: [number, number]
}
// Mode de colorisation du nuage : altitude (rampe), RGB (vraie couleur du scan),
// classification (palette par classe ASPRS).
export type PointCloudColorMode = 'altitude' | 'rgb' | 'classification'
// Histogramme de classification (code ASPRS + nombre de points), depuis le manifest.
export type PointCloudClass = { code: number; count: number }
// POI de danger : segment végétation↔conducteur, coords LOCALES (m, repère du nuage).
export type PointCloudDangerPoi = {
  veg: [number, number, number]
  cond: [number, number, number]
  clearanceM: number
}

type State = {
  buildingHeights: number[]
  measurePoints: MeasurePoint[]
  measureLengthKm: number
  heatmapTopZones: { name: string; value: number }[]
  poiStatus: Record<string, POIStatus>
  gateNudgeAt: number
  isochroneStats: IsochroneStats[]
  realtime: RealtimeFeed | null
  hikeProgress: number
  activeHikePoi: number | null
  flightStats: FlightStats | null
  pointCloudStats: PointCloudStats | null
  pointCloudClasses: PointCloudClass[]
  // Polyligne centrale de la ligne électrique (classe 24), en [lng,lat] — la caméra
  // la suit en plan rapproché. Émise par le prebake (meta.linePath).
  pointCloudLinePath: [number, number][]
  // POI de danger (segments végétation↔conducteur), coords locales. Émis par le prebake.
  pointCloudDangerPois: PointCloudDangerPoi[]
  // Relance la chorégraphie (bouton « Rejouer »). Posé par le step, lu par le panneau.
  pointCloudReplay: (() => void) | null
  // Mode de colorisation courant.
  pointCloudColorMode: PointCloudColorMode
  // Change de colorisation (balayage de scan). Posé par le director, appelé par le panneau.
  pointCloudSetColor: ((mode: PointCloudColorMode) => void) | null
  // Handle de la couche (posé par le step en onEnter) — lu par le hook de chorégraphie.
  pointCloudHandle: PointCloudHandle | null
  // Jeton de (re)lecture : incrémenté pour (re)lancer la chorégraphie ; 0 = inactive.
  pointCloudRun: number
  // Fige tout mouvement caméra du step (timeline + orbite). Posé par le hook, appelé
  // par le debug panel.
  pointCloudStopCamera: (() => void) | null
}
type Actions = {
  setBuildingHeights: (v: number[]) => void
  setMeasure: (pts: MeasurePoint[], lengthKm: number) => void
  setHeatmapTopZones: (v: { name: string; value: number }[]) => void
  advancePOIStatus: (id: string) => void
  setPOIStatus: (id: string, status: POIStatus) => void
  resetPOIStatus: () => void
  nudgeGate: () => void
  setIsochroneStats: (v: IsochroneStats[]) => void
  setRealtime: (v: RealtimeFeed | null) => void
  setHikeProgress: (v: number) => void
  setActiveHikePoi: (v: number | null) => void
  setFlightStats: (v: FlightStats | null) => void
  setPointCloudStats: (v: PointCloudStats | null) => void
  setPointCloudClasses: (v: PointCloudClass[]) => void
  setPointCloudLinePath: (v: [number, number][]) => void
  setPointCloudDangerPois: (v: PointCloudDangerPoi[]) => void
  setPointCloudReplay: (fn: (() => void) | null) => void
  setPointCloudColorMode: (mode: PointCloudColorMode) => void
  setPointCloudSetColor: (fn: ((mode: PointCloudColorMode) => void) | null) => void
  setPointCloudHandle: (h: PointCloudHandle | null) => void
  bumpPointCloudRun: () => void
  resetPointCloudRun: () => void
  setPointCloudStopCamera: (fn: (() => void) | null) => void
}

const NEXT_STATUS: Record<POIStatus, POIStatus> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'done',
}

export const useMapDataStore = create<State & Actions>((set) => ({
  buildingHeights: [],
  measurePoints: [],
  measureLengthKm: 0,
  heatmapTopZones: [],
  poiStatus: {},
  gateNudgeAt: 0,
  isochroneStats: [],
  realtime: null,
  hikeProgress: 0,
  activeHikePoi: null,
  flightStats: null,
  pointCloudStats: null,
  pointCloudClasses: [],
  pointCloudLinePath: [],
  pointCloudDangerPois: [],
  pointCloudReplay: null,
  pointCloudColorMode: 'altitude',
  pointCloudSetColor: null,
  pointCloudHandle: null,
  pointCloudRun: 0,
  pointCloudStopCamera: null,
  setBuildingHeights: (v) => set({ buildingHeights: v }),
  setMeasure: (pts, lengthKm) => set({ measurePoints: pts, measureLengthKm: lengthKm }),
  setHeatmapTopZones: (v) => set({ heatmapTopZones: v }),
  advancePOIStatus: (id) =>
    set((state) => ({
      poiStatus: {
        ...state.poiStatus,
        [id]: NEXT_STATUS[state.poiStatus[id] ?? 'todo'],
      },
    })),
  setPOIStatus: (id, status) =>
    set((state) => ({ poiStatus: { ...state.poiStatus, [id]: status } })),
  resetPOIStatus: () => set({ poiStatus: {} }),
  nudgeGate: () => set({ gateNudgeAt: Date.now() }),
  setIsochroneStats: (v) => set({ isochroneStats: v }),
  setRealtime: (v) => set({ realtime: v }),
  setHikeProgress: (v) => set({ hikeProgress: v }),
  setActiveHikePoi: (v) => set({ activeHikePoi: v }),
  setFlightStats: (v) => set({ flightStats: v }),
  setPointCloudStats: (v) => set({ pointCloudStats: v }),
  setPointCloudClasses: (v) => set({ pointCloudClasses: v }),
  setPointCloudLinePath: (v) => set({ pointCloudLinePath: v }),
  setPointCloudDangerPois: (v) => set({ pointCloudDangerPois: v }),
  setPointCloudReplay: (fn) => set({ pointCloudReplay: fn }),
  setPointCloudColorMode: (mode) => set({ pointCloudColorMode: mode }),
  setPointCloudSetColor: (fn) => set({ pointCloudSetColor: fn }),
  setPointCloudHandle: (h) => set({ pointCloudHandle: h }),
  bumpPointCloudRun: () => set((state) => ({ pointCloudRun: state.pointCloudRun + 1 })),
  resetPointCloudRun: () => set({ pointCloudRun: 0 }),
  setPointCloudStopCamera: (fn) => set({ pointCloudStopCamera: fn }),
}))
