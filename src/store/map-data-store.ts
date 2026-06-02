import { create } from 'zustand'
import type { IsochroneStats } from '@/map/layers/isochrones'
import type { RealtimeFeed } from '@/map/layers/realtime'

export type MeasurePoint = { lng: number; lat: number }
export type POIStatus = 'todo' | 'in_progress' | 'done'

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
}))

export const hasCompletedAnyPOI = (s: State) => Object.values(s.poiStatus).some((v) => v === 'done')
