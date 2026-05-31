import * as turf from '@turf/turf'
import { altAtFraction, CHAMONIX_TRAIL, TRAIL_DISTANCE_KM } from '@/data/sample-trail'
import merDeGlaceImg from '@/assets/photos/hike/mer_de_glace.webp'
import grotteGlaceImg from '@/assets/photos/hike/grotte_glace.webp'
import refugeImg from '@/assets/photos/hike/refuge.webp'
import dentDuRequinImg from '@/assets/photos/hike/dent_du_requin.webp'

// Points d'intérêt jalonnant le sentier d'altitude de Chamonix (step « Terrain 3D ·
// randonnée »). Les coordonnées fournies tombent sur le tracé : on les projette une fois
// sur la polyligne (turf.nearestPointOnLine) pour obtenir la distance cumulée le long du
// sentier — ce qui synchronise l'ouverture des popups (boucle GSAP de hikingTerrain.ts) et
// les repères sur le profil d'élévation (HikingChart) avec le marqueur du randonneur.
export type HikePoi = {
  id: string
  name: string
  description: string
  photo: string
  /** Coordonnée brute fournie ([lng, lat]). */
  coord: [number, number]
}

export type HikePoiResolved = HikePoi & {
  /** Coordonnée accrochée au tracé (anc­re du marqueur et du popup). */
  snapped: [number, number]
  /** Distance cumulée le long du sentier (km). */
  dist: number
  /** Fraction du trajet [0..1] — instant d'arrivée du randonneur. */
  frac: number
  /** Altitude (m) au même point, dérivée du profil. */
  alt: number
}

const RAW_POIS: HikePoi[] = [
  {
    id: 'grotte-de-glace',
    name: 'Grotte de glace',
    description:
      'Galerie recreusée chaque année à même le glacier. À l’intérieur, parois et sculptures de glace translucide où la température reste sous zéro toute l’année.',
    photo: grotteGlaceImg,
    coord: [6.9220048, 45.9270893],
  },
  {
    id: 'mer-de-glace',
    name: 'Mer de Glace',
    description:
      'Plus grand glacier de France : sept kilomètres de glace en mouvement descendant du massif du Mont-Blanc. Le sentier domine ses séracs et ses crevasses bleutées.',
    photo: merDeGlaceImg,
    coord: [6.9362431, 45.9103145],
  },
  {
    id: 'refuge-altitude',
    name: 'Refuge d’altitude',
    description:
      'Halte des alpinistes avant l’assaut des sommets : couchage, ravitaillement et point de départ des courses. Dernier abri gardé avant la haute montagne.',
    photo: refugeImg,
    coord: [6.9294331, 45.884695],
  },
  {
    id: 'dent-du-requin',
    name: 'Dent du Requin',
    description:
      'Aiguille de granit emblématique de la Vallée Blanche. Voie d’escalade réputée et panorama à 360° sur la Mer de Glace et les aiguilles de Chamonix.',
    photo: dentDuRequinImg,
    coord: [6.9174998, 45.8875843],
  },
]

export const HIKE_POIS: HikePoiResolved[] = RAW_POIS.map((poi) => {
  const snap = turf.nearestPointOnLine(CHAMONIX_TRAIL, turf.point(poi.coord), {
    units: 'kilometers',
  })
  const dist = snap.properties.location ?? 0
  const frac = Math.max(0, Math.min(1, dist / TRAIL_DISTANCE_KM))
  return {
    ...poi,
    snapped: snap.geometry.coordinates as [number, number],
    dist,
    frac,
    alt: Math.round(altAtFraction(frac)),
  }
}).sort((a, b) => a.dist - b.dist)
