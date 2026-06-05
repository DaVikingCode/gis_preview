import { create } from 'zustand'

// Suivi de la progression du préchargement lancé au splash (StartScreen). Quatre
// familles d'assets téléchargent en parallèle ; chacune déclare son poids total (en
// octets) puis incrémente sa part au fil des fetch. Le gate du splash (boutons
// « Démarrer » / « Lecture auto ») reste verrouillé tant que `done` est faux.
const FAMILIES = 3 // lidar · glb avion · images UI

type State = {
  totalBytes: number // dénominateur — s'affine à mesure que les addTotal arrivent
  loadedBytes: number // numérateur — incrémenté à chaque unité terminée (succès OU échec)
  ready: number // nb de familles ayant déclaré leur total (markReady)
  done: boolean // toutes familles prêtes ET loaded >= total → débloque le gate
}
type Actions = {
  addTotal: (n: number) => void
  addLoaded: (n: number) => void
  markReady: () => void
  reset: () => void
}

// `done` ne passe à true que quand les 4 familles ont appelé markReady ET que tout est
// chargé : sans ce garde-fou, l'état initial 0/0 ouvrirait le gate instantanément.
function recompute(s: State): boolean {
  return s.ready >= FAMILIES && s.loadedBytes >= s.totalBytes
}

export const usePreloadStore = create<State & Actions>((set) => ({
  totalBytes: 0,
  loadedBytes: 0,
  ready: 0,
  done: false,
  addTotal: (n) =>
    set((s) => {
      const totalBytes = s.totalBytes + n
      return { totalBytes, done: recompute({ ...s, totalBytes }) }
    }),
  addLoaded: (n) =>
    set((s) => {
      const loadedBytes = Math.min(s.totalBytes, s.loadedBytes + n)
      return { loadedBytes, done: recompute({ ...s, loadedBytes }) }
    }),
  markReady: () =>
    set((s) => {
      const ready = s.ready + 1
      return { ready, done: recompute({ ...s, ready }) }
    }),
  reset: () => set({ totalBytes: 0, loadedBytes: 0, ready: 0, done: false }),
}))

// Fraction affichée : plafonnée < 1 tant que les 4 familles n'ont pas posé leur total,
// pour qu'un dénominateur partiel (ou 0/0) ne fasse jamais paraître la barre pleine.
export function selectFraction(s: State): number {
  if (s.totalBytes === 0) return 0
  const f = s.loadedBytes / s.totalBytes
  return s.ready < FAMILIES ? Math.min(0.99, f) : Math.min(1, f)
}
