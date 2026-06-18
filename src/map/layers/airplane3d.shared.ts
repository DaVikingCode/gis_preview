import type { Map as MLMap } from 'maplibre-gl'
import { usePreloadStore } from '@/store/preload-store'

// -----------------------------------------------------------------------------
// Partie LÉGÈRE de l'avion 3D — AUCUN `import 'three'`.
//
// Tout ce dont `steps.ts`, `StartScreen.tsx` et `AirplaneDebugPanel.tsx` ont besoin AVANT
// (ou sans) le rendu 3D vit ici : préchargement du glb, préchauffe du globe (projection +
// ciel) et réglages. Le module lourd `airplane3d.ts` (three.js + GLTFLoader) importe ces
// symboles et n'est chargé QUE via `import()` dynamique au step « Survol 3D » → three.js
// reste hors du bundle d'entrée.
// -----------------------------------------------------------------------------

export type AirplaneHandle = { detach: () => void }

// GLB optimisé hors-ligne (cf. script `build:plane`) — ~0,77 Mo.
export const MODEL_URL = '/models/plane/plane.glb'

// Budget de repli si le serveur n'expose pas Content-Length (le glb fait ~0,77 Mo).
const PLANE_BYTES_FALLBACK = 800_000

// Préchargement du glb dès le splash : réchauffe le cache HTTP pour que le GLTFLoader du
// step « Survol 3D » le serve sans latence, et alimente le loader. Best-effort.
let planePrefetched = false
export function prefetchAirplaneModel(): void {
  if (planePrefetched) return
  planePrefetched = true
  const pl = usePreloadStore.getState()
  void (async () => {
    try {
      const res = await fetch(MODEL_URL, { cache: 'force-cache' })
      const len = Number(res.headers.get('content-length')) || PLANE_BYTES_FALLBACK
      pl.addTotal(len)
      pl.markReady()
      const buf = await res.arrayBuffer()
      pl.addLoaded(buf.byteLength || len)
    } catch {
      // injoignable : on crédite quand même le budget de repli pour ne pas bloquer le gate.
      pl.addTotal(PLANE_BYTES_FALLBACK)
      pl.markReady()
      pl.addLoaded(PLANE_BYTES_FALLBACK)
    }
  })()
}

// Ciel « espace » : fond quasi noir + fin halo d'atmosphère bleu au limbe du globe.
const SPACE_SKY = {
  'sky-color': '#01030a',
  'horizon-color': '#0b1f47',
  'fog-color': '#02040c',
  'sky-horizon-blend': 0.4,
  'horizon-fog-blend': 0.6,
  'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 0.9, 5, 0.5, 10, 0],
} as const

// Fond « espace » étoilé posé sur le CONTENEUR de carte (le canvas MapLibre est
// transparent — cf. index.css — donc ce fond apparaît dans le vide autour du globe,
// que le globe opaque recouvre). Étoiles générées en SVG data-URI (un seul calque).
function spaceStarsImage(): string {
  const w = 1600
  const h = 900
  let circles = ''
  for (let i = 0; i < 240; i++) {
    const x = (Math.random() * w).toFixed(1)
    const y = (Math.random() * h).toFixed(1)
    const r = (Math.random() * 1.1 + 0.25).toFixed(2)
    const o = (Math.random() * 0.6 + 0.3).toFixed(2)
    circles += `<circle cx="${x}" cy="${y}" r="${r}" fill="white" opacity="${o}"/>`
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>${circles}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

const SPACE_BG_IMAGE = `${spaceStarsImage()}, radial-gradient(ellipse at 32% 24%, #0c1838 0%, #03060f 58%, #01020a 100%)`

export function setSpaceBackground(map: MLMap, on: boolean) {
  const el = map.getContainer()
  if (on) {
    el.style.backgroundColor = '#01020a'
    el.style.backgroundImage = SPACE_BG_IMAGE
    el.style.backgroundSize = 'cover, cover'
    el.style.backgroundRepeat = 'no-repeat, no-repeat'
    el.style.backgroundPosition = 'center, center'
  } else {
    el.style.backgroundColor = ''
    el.style.backgroundImage = ''
    el.style.backgroundSize = ''
    el.style.backgroundRepeat = ''
    el.style.backgroundPosition = ''
  }
}

// Socle « globe » posé AVANT le flyTo du step (hook `onBeforePan`, cf. terrain) : la
// bascule mercator→globe + le ciel espace compilent leurs shaders au départ du vol
// (à z16 le globe se rend comme du mercator → bascule invisible), au lieu de freezer
// à l'atterrissage. Bonus : la Terre « s'enroule » en sphère pendant le dézoom.
// Idempotent — re-traversé par addAirplane3D à l'arrivée.
export function prewarmGlobe(map: MLMap): void {
  if (map.getProjection()?.type !== 'globe') map.setProjection({ type: 'globe' })
  // Fond étoilé (conteneur) : invisible tant que le globe couvre tout l'écran,
  // révélé à mesure que le dézoom dégage le limbe.
  setSpaceBackground(map, true)
  map.setSky(SPACE_SKY as unknown as Parameters<MLMap['setSky']>[0])
}

// Annule prewarmGlobe (projection + ciel + fond espace). En vol normal,
// removeAirplane3D fait déjà ce retour ; ce reset sert quand prewarmGlobe a posé le
// globe (onBeforePan) mais que addAirplane3D n'a jamais été adopté — sortie du step
// avant la résolution de l'import dynamique → sinon la carte reste bloquée en globe.
export function resetGlobe(map: MLMap): void {
  if (map.getProjection()?.type === 'globe') map.setProjection({ type: 'mercator' })
  setSpaceBackground(map, false)
  ;(map.setSky as (sky?: unknown) => void)()
}

// --- Réglages d'orientation / échelle (édités live par AirplaneDebugPanel) ----
// Mutable : lu par render() à chaque frame. Unités « friendly » (degrés, km) pour
// l'éditeur. Valeurs exagérées car, vu de l'orbite, un avion réaliste serait sous-
// pixel (cf. l'exemple officiel qui scale ×10 000).
export const airplaneTuning = {
  // Cap : aligne le nez sur la direction de vol. atan2 donne un cap (0 = est, sens
  // trigo) ; cet offset (degrés) recale le nez selon l'axe avant du modèle. Le retour
  // (JFK→CDG) demande une pose distincte (cap + tangage) car le sens de vol s'inverse.
  headingOffsetDeg: 30, // aller (CDG→JFK)
  headingOffsetReturnDeg: 135, // retour (JFK→CDG)
  // Tangage (nez haut/bas), en degrés. Redresse la pose de repos du modèle.
  pitchDeg: 85, // aller
  pitchReturnDeg: -85, // retour
  // Roulis (gîte sur l'aile) selon la phase de vol : l'avion est interpolé entre la
  // gîte « sol » (décollage en montée / atterrissage en descente) et la gîte de
  // croisière au fil de la cloche d'altitude. Calés visuellement via le debug panel.
  rollTakeoffDeg: -50, // décollage (montée, près de l'aéroport de départ)
  rollCruiseDeg: -40, // croisière (apogée)
  rollLandingDeg: -15, // atterrissage (descente, près de l'aéroport d'arrivée)
  // Jambe retour (JFK→CDG) : le cap s'inverse de ~180° (lacet pur autour de la
  // verticale), ce qui présente le ventre de l'avion à la caméra → il paraît « sur
  // le dos ». On le retourne de 180° autour de son axe de roulis sur le retour.
  returnRollFlipDeg: 180,
  // Longueur du modèle, en km-monde (exagérée pour la lisibilité orbitale).
  lengthKm: 350,
  // Respiration de taille : comme la caméra serre fortement aux aéroports (zoom
  // élevé pour voir le décollage) et s'éloigne à l'apogée (zoom faible), on réduit
  // beaucoup la taille-monde près du sol pour garder une taille-écran ~constante.
  scaleNearMul: 0.22, // aux extrémités (vue serrée, gros plan décollage)
  scaleFarMul: 1.3, // à l'apogée / en vol (vue large orbitale) — un peu plus gros
  // Rehausse de l'avion au-dessus du tracé (km) : l'avion « flotte » au-dessus de la
  // ligne au lieu d'être posé dessus.
  planeRiseKm: 30,
  // Épaisseur du tracé suivi, en pixels (fat line, indépendante du zoom).
  lineWidthPx: 4,
  // Cloche d'altitude (km) : basse au départ/arrivée (aéroports), pic en croisière.
  // Exagérées pour que l'avion « flotte » visiblement au-dessus du globe.
  cruiseAltKm: 330, // pic (mi-trajet)
  takeoffAltKm: 12, // décollage / atterrissage (extrémités)
}
