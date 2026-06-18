import * as turf from '@turf/turf'
import type { Feature, LineString } from 'geojson'

// Sentier d'altitude au-dessus de Chamonix (fourni en GeoJSON), du fond de vallée
// (~1060 m) jusqu'à un point haut du massif (~3020 m). Les deux LineStrings d'origine
// (le 2e tronçon repart du dernier point du 1er) sont concaténées en un tracé continu.
// L'altitude par sommet est RÉELLE (récupérée une fois via l'API d'élévation
// Open-Meteo puis figée ici) ; les distances cumulées du profil sont dérivées des
// coordonnées (Turf) au chargement, si bien que le marqueur (turf.along sur cette même
// ligne) et le graphe d'élévation restent parfaitement synchronisés.

// [lng, lat, altitude(m)]
const RAW: [number, number, number][] = [
  [6.8876426, 45.9387278, 1063],
  [6.8885334, 45.9375925, 1064],
  [6.8890595, 45.9351759, 1067],
  [6.8942191, 45.9366903, 1075],
  [6.89795, 45.9395496, 1086],
  [6.9023692, 45.9416556, 1096],
  [6.9032031, 45.9428542, 1117],
  [6.903853, 45.9433618, 1119],
  [6.9036366, 45.9440081, 1119],
  [6.903776, 45.9444222, 1133],
  [6.9038674, 45.9450514, 1139],
  [6.9054657, 45.9463398, 1138],
  [6.9062538, 45.9466184, 1139],
  [6.9070858, 45.9471485, 1160],
  [6.9088869, 45.9473368, 1169],
  [6.9113836, 45.947742, 1245],
  [6.9131407, 45.9474699, 1291],
  [6.9144017, 45.9465816, 1371],
  [6.9149459, 45.945981, 1371],
  [6.9157522, 45.9456541, 1436],
  [6.9161597, 45.9453329, 1454],
  [6.9168969, 45.9451079, 1461],
  [6.9173293, 45.9444081, 1473],
  [6.9191726, 45.9435869, 1494],
  [6.919922, 45.9419884, 1466],
  [6.9208337, 45.9409411, 1480],
  [6.9207147, 45.9399969, 1490],
  [6.9210891, 45.9387067, 1496],
  [6.9214015, 45.9367173, 1539],
  [6.9212115, 45.9333035, 1685],
  [6.9217198, 45.9305048, 1699],
  [6.9221651, 45.9270662, 1756],
  [6.9198926, 45.9238161, 1873],
  [6.9214489, 45.9208045, 1880],
  [6.9284886, 45.9171823, 1871],
  [6.9332913, 45.9152967, 1899],
  [6.936274, 45.9104822, 2031],
  [6.9370163, 45.9041079, 2088],
  [6.9323422, 45.8963568, 2164],
  [6.9315991, 45.8914834, 2210],
  [6.9327425, 45.8860366, 2253],
  [6.9306624, 45.8863785, 2391],
  [6.9293378, 45.8845269, 2518],
  [6.9265107, 45.8836065, 2607],
  [6.9228619, 45.8839193, 2785],
  [6.9205976, 45.8843419, 2887],
  [6.9232358, 45.8851871, 2801],
  [6.9239766, 45.8862417, 2738],
  [6.9233377, 45.8873422, 2741],
  [6.9216913, 45.8872102, 2839],
  [6.9192692, 45.8861021, 2990],
  [6.9192724, 45.8861101, 2990],
  [6.9189214, 45.886173, 2996],
  [6.9189507, 45.8863253, 2996],
  [6.9192632, 45.886318, 2990],
  [6.9195015, 45.8864561, 2990],
  [6.9196253, 45.8866162, 2990],
  [6.9194473, 45.8866818, 2969],
  [6.9192387, 45.8866673, 2969],
  [6.9189456, 45.8867329, 2978],
  [6.9185687, 45.8867986, 2978],
  [6.9185355, 45.8869229, 2978],
  [6.918305, 45.8869522, 3019],
  [6.9181493, 45.8868864, 3019],
  [6.9180243, 45.8868644, 3019],
  [6.9178993, 45.8868425, 3019],
  [6.9176038, 45.8869742, 3019],
  [6.9176752, 45.8870621, 3019],
  [6.9177362, 45.8871501, 3019],
  [6.91763, 45.8872162, 3019],
  [6.9175243, 45.8872603, 3019],
  [6.9175536, 45.887356, 3019],
  [6.9175834, 45.887437, 3019],
  [6.917528, 45.8875697, 2991],
]

const COORDS: [number, number][] = RAW.map(([lng, lat]) => [lng, lat])

export const CHAMONIX_TRAIL: Feature<LineString> = {
  type: 'Feature',
  properties: { name: "Sentier d'altitude · Chamonix" },
  geometry: { type: 'LineString', coordinates: COORDS },
}

export type TrailPoint = { dist: number; alt: number }

// Distance cumulée (km) ↔ altitude (m), calculée une fois depuis les coordonnées.
export const TRAIL_PROFILE: TrailPoint[] = RAW.map(([, , alt], i) => ({
  dist: i === 0 ? 0 : turf.length(turf.lineString(COORDS.slice(0, i + 1)), { units: 'kilometers' }),
  alt,
}))

export const TRAIL_DISTANCE_KM = TRAIL_PROFILE[TRAIL_PROFILE.length - 1].dist
export const TRAIL_SUMMIT_M = Math.max(...RAW.map(([, , a]) => a))
export const TRAIL_MIN_M = Math.min(...RAW.map(([, , a]) => a))
export const TRAIL_DPLUS_M = RAW.reduce(
  (sum, [, , a], i) => (i === 0 ? 0 : sum + Math.max(0, a - RAW[i - 1][2])),
  0,
)

// Altitude (m) interpolée linéairement à une fraction [0..1] du trajet.
export function altAtFraction(frac: number): number {
  const d = Math.max(0, Math.min(1, frac)) * TRAIL_DISTANCE_KM
  for (let i = 1; i < TRAIL_PROFILE.length; i++) {
    const a = TRAIL_PROFILE[i - 1]
    const b = TRAIL_PROFILE[i]
    if (d <= b.dist) {
      const span = b.dist - a.dist || 1
      return a.alt + (b.alt - a.alt) * ((d - a.dist) / span)
    }
  }
  return TRAIL_SUMMIT_M
}
