import { create } from 'zustand'
import type { BasemapId } from '@/map/basemaps'

type State = {
  started: boolean
  currentStep: number
  basemap: BasemapId
  cinematicActive: boolean
  importDone: boolean
  // Verrouille « Suivant » jusqu'au dépôt du fichier d'import (faux curseur).
  dropDone: boolean
  measureDone: boolean
  // Masque le faux curseur du tracé auto (Mesure) dès le dernier clic, sans
  // attendre la fin du remplissage (qui, lui, déclenche measureDone).
  traceCursorHidden: boolean
  // La modale du catalogue ne se monte qu'une fois ce flag à true (faux curseur).
  layersPanelOpen: boolean
  // Verrouille « Suivant » jusqu'au clic du poste en surcharge (ouvre sa fiche).
  incidentClicked: boolean
  // Verrouille « Suivant » jusqu'à la fin du glissé du slider avant/après.
  swipeDone: boolean
  // Vrai pendant un vol caméra (pan/flyIn) : verrouille « Suivant » jusqu'à l'atterrissage.
  flying: boolean
  // Verrouille « Suivant » jusqu'au basculement du thème (faux curseur).
  themeFlipDone: boolean
  // Verrouille « Suivant » jusqu'à la fin du survol des lignes (liaison table ↔ carte).
  tableLinkDone: boolean
  // Verrouille « Suivant » jusqu'à la fin du survol de la ligne électrique (nuage LiDAR).
  pointcloudFollowDone: boolean
  // Verrouille « Suivant » jusqu'à la fin de la démo Kanban (glissé de carte + bascule planning).
  kanbanDone: boolean
  // Lecture automatique : la visite enchaîne les étapes seule, sans clic « Suivant ».
  autoPlay: boolean
  jumpToStep: ((i: number) => void) | null
}
type Actions = {
  start: () => void
  startAuto: () => void
  setStep: (i: number) => void
  setBasemap: (b: BasemapId) => void
  reset: () => void
  setCinematic: (v: boolean) => void
  setImportDone: (v: boolean) => void
  setDropDone: (v: boolean) => void
  setMeasureDone: (v: boolean) => void
  setTraceCursorHidden: (v: boolean) => void
  setLayersPanelOpen: (v: boolean) => void
  setIncidentClicked: (v: boolean) => void
  setSwipeDone: (v: boolean) => void
  setFlying: (v: boolean) => void
  setThemeFlipDone: (v: boolean) => void
  setTableLinkDone: (v: boolean) => void
  setPointcloudFollowDone: (v: boolean) => void
  setKanbanDone: (v: boolean) => void
  setJumpToStep: (fn: ((i: number) => void) | null) => void
}

export const useTourStore = create<State & Actions>((set) => ({
  started: false,
  currentStep: 0,
  basemap: 'positron',
  cinematicActive: true,
  importDone: false,
  dropDone: false,
  measureDone: false,
  traceCursorHidden: false,
  layersPanelOpen: false,
  incidentClicked: false,
  swipeDone: false,
  flying: false,
  themeFlipDone: false,
  tableLinkDone: false,
  pointcloudFollowDone: false,
  kanbanDone: false,
  autoPlay: false,
  jumpToStep: null,
  start: () => set({ started: true, currentStep: 0 }),
  startAuto: () => set({ started: true, currentStep: 0, autoPlay: true }),
  setStep: (i) => set({ currentStep: i }),
  setBasemap: (b) => set({ basemap: b }),
  reset: () =>
    set({
      started: false,
      currentStep: 0,
      cinematicActive: true,
      importDone: false,
      dropDone: false,
      measureDone: false,
      traceCursorHidden: false,
      layersPanelOpen: false,
      incidentClicked: false,
      swipeDone: false,
      flying: false,
      themeFlipDone: false,
      tableLinkDone: false,
      pointcloudFollowDone: false,
      kanbanDone: false,
      autoPlay: false,
    }),
  setCinematic: (v) => set({ cinematicActive: v }),
  setImportDone: (v) => set({ importDone: v }),
  setDropDone: (v) => set({ dropDone: v }),
  setMeasureDone: (v) => set({ measureDone: v }),
  setTraceCursorHidden: (v) => set({ traceCursorHidden: v }),
  setLayersPanelOpen: (v) => set({ layersPanelOpen: v }),
  setIncidentClicked: (v) => set({ incidentClicked: v }),
  setSwipeDone: (v) => set({ swipeDone: v }),
  setFlying: (v) => set({ flying: v }),
  setThemeFlipDone: (v) => set({ themeFlipDone: v }),
  setTableLinkDone: (v) => set({ tableLinkDone: v }),
  setPointcloudFollowDone: (v) => set({ pointcloudFollowDone: v }),
  setKanbanDone: (v) => set({ kanbanDone: v }),
  setJumpToStep: (fn) => set({ jumpToStep: fn }),
}))
