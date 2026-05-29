import { create } from 'zustand'
import type { BasemapId } from '@/map/basemaps'

type State = {
  started: boolean
  currentStep: number
  basemap: BasemapId
  cinematicActive: boolean
  importDone: boolean
  // Étape « Vos propres données » : passe à true quand le faux curseur a déposé le
  // fichier sur la zone d'import — verrouille « Suivant » tant que c'est false.
  dropDone: boolean
  drawDone: boolean
  measureDone: boolean
  // Masque le faux curseur des tracés auto (Mesure, Dessin) dès le dernier clic,
  // sans attendre la fin du remplissage (qui, lui, déclenche drawDone/measureDone).
  traceCursorHidden: boolean
  // Catalogue de couches : la modale ne se monte qu'une fois ce flag passé à true
  // (déclenché par le faux curseur qui « clique » le bouton Couches sur la carte).
  layersPanelOpen: boolean
  // Séquence HTA (rt-todo) : passe à true quand le faux curseur a « cliqué » le
  // poste en surcharge et ouvert sa fiche — verrouille « Suivant » tant que false.
  incidentClicked: boolean
  // Vrai pendant un vol caméra (pan/flyIn) : verrouille « Suivant » pour empêcher
  // de zapper l'étape tant que la caméra n'a pas atterri.
  flying: boolean
  jumpToStep: ((i: number) => void) | null
}
type Actions = {
  start: () => void
  setStep: (i: number) => void
  setBasemap: (b: BasemapId) => void
  reset: () => void
  setCinematic: (v: boolean) => void
  setImportDone: (v: boolean) => void
  setDropDone: (v: boolean) => void
  setDrawDone: (v: boolean) => void
  setMeasureDone: (v: boolean) => void
  setTraceCursorHidden: (v: boolean) => void
  setLayersPanelOpen: (v: boolean) => void
  setIncidentClicked: (v: boolean) => void
  setFlying: (v: boolean) => void
  setJumpToStep: (fn: ((i: number) => void) | null) => void
}

export const useTourStore = create<State & Actions>((set) => ({
  started: false,
  currentStep: 0,
  basemap: 'positron',
  cinematicActive: true,
  importDone: false,
  dropDone: false,
  drawDone: false,
  measureDone: false,
  traceCursorHidden: false,
  layersPanelOpen: false,
  incidentClicked: false,
  flying: false,
  jumpToStep: null,
  start: () => set({ started: true, currentStep: 0 }),
  setStep: (i) => set({ currentStep: i }),
  setBasemap: (b) => set({ basemap: b }),
  reset: () =>
    set({
      started: false,
      currentStep: 0,
      cinematicActive: true,
      importDone: false,
      dropDone: false,
      drawDone: false,
      measureDone: false,
      traceCursorHidden: false,
      layersPanelOpen: false,
      incidentClicked: false,
      flying: false,
    }),
  setCinematic: (v) => set({ cinematicActive: v }),
  setImportDone: (v) => set({ importDone: v }),
  setDropDone: (v) => set({ dropDone: v }),
  setDrawDone: (v) => set({ drawDone: v }),
  setMeasureDone: (v) => set({ measureDone: v }),
  setTraceCursorHidden: (v) => set({ traceCursorHidden: v }),
  setLayersPanelOpen: (v) => set({ layersPanelOpen: v }),
  setIncidentClicked: (v) => set({ incidentClicked: v }),
  setFlying: (v) => set({ flying: v }),
  setJumpToStep: (fn) => set({ jumpToStep: fn }),
}))
