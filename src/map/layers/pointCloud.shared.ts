// -----------------------------------------------------------------------------
// Partie LÉGÈRE du nuage de points LiDAR — AUCUN `import 'three'`.
//
// Constantes, état animé et réglages partagés entre le module lourd `pointCloud.ts`
// (three.js), le hook de chorégraphie, la fiche chart et le debug panel. Les regrouper
// ici évite que ces consommateurs (atteints statiquement depuis l'entrée) tirent three.js
// dans le bundle d'entrée. Le rendu lourd reste dans `pointCloud.ts`, chargé via `import()`.
// -----------------------------------------------------------------------------

export type PointCloudHandle = {
  detach: () => void
  ready: Promise<{ count: number }>
  setReveal: (n: number) => void
  // Projette un point en coords LOCALES (mètres, repère du nuage) vers l'écran (px CSS).
  // `visible:false` si derrière la caméra / hors cadre. null si la couche n'a pas encore
  // rendu. Utilisé par l'overlay des POI de danger.
  project: (p: [number, number, number]) => { x: number; y: number; visible: boolean } | null
}

// Emplacement réel du scan : centre de l'emprise UTM31N → WGS84 (Auxonne, France).
// Émis par le prebake (champ anchorLngLat) ; partagé avec le step (caméra centrée ici).
export const POINTCLOUD_ANCHOR: [number, number] = [5.392126, 47.202674]

// Modes de colorisation (valeurs numériques lues par le shader).
export const MODE = { altitude: 0, rgb: 1, classification: 2 } as const

// Bornes du balayage de scan le long de l'axe NORD (position.y, m) — l'emprise fait
// ~496 m de long ; ±260 garantit un wipe complet bord à bord.
export const SCAN_MIN = -260
export const SCAN_MAX = 260

// Réglages d'orientation / placement, édités en live par PointCloudDebugPanel et lus
// par render() à chaque frame. `scale = 1.0` = échelle géographique exacte (vrais
// mètres) → la couleur RGB se cale sur le fond satellite.
export const pointCloudTuning = {
  bearingDeg: 0, // rotation autour de la verticale (Z) — alignement nord
  pitchDeg: -90, // bascule autour de l'axe est (X) — redresse le nuage (repère Y-up)
  rollDeg: 0, // bascule autour de l'axe nord (Y)
  offsetEast: 0, // décalage horizontal est (m) dans le repère ENU de l'ancrage
  offsetNorth: 0, // décalage horizontal nord (m)
  altitudeM: 0, // surélévation (m)
  scale: 1.0, // échelle (1 = géographiquement exact)
  pointSizePx: 0.5, // taille des points (px, sizeAttenuation: false)
  // Budget de densité (LOD) : fraction de points dessinée par cellule =
  // clamp(4^(zoom − lodFullZoom), lodFloor, 1). Le nuage est sur-échantillonné dézoomé
  // (dizaines de points/px en orbite) → réduire la densité y est peu visible et la
  // charge vertex chute d'autant. 4^Δzoom suit la surface écran (m²/px ∝ 4^-zoom).
  // Plancher à 0,35 : en dessous, la perte de densité devient perceptible en vue large
  // (constat visuel) — on garde quand même ~3× moins de vertex qu'à pleine densité.
  lodFullZoom: 18.2, // zoom auquel 100 % des points sont dessinés
  lodFloor: 0.35, // plancher de densité (vue la plus large)
}

// État animé lu par render() à chaque frame (tweené par la chorégraphie / le toggle) :
//   modeFrom/modeTo : colorisations de départ/arrivée du balayage en cours.
//   scan : position du front de scan (m, axe nord) ; hors [SCAN_MIN,SCAN_MAX] = uniforme.
//   scanWidth : largeur du bord doux du wipe (m). scanGlow : intensité ligne de scan cyan.
export const pointCloudView = {
  modeFrom: MODE.altitude as number,
  modeTo: MODE.altitude as number,
  scan: SCAN_MAX,
  scanWidth: 45,
  scanGlow: 0,
  // reveal : >0.5 = apparition par scan active (les points devant le front sont masqués —
  // « matérialisation » directionnelle du nuage). 0 = nuage entièrement visible.
  reveal: 0,
}

// Schéma de classification Enedis « élagage » (repris de enedis-sky-elag) : sol +
// végétation (contexte), LIGNE ÉLECTRIQUE en rouge vif, et niveaux d'urgence U0→U4
// (proximité végétation/conducteur) aux couleurs de sky. `color` en 0–1 (RGB) ; `order`
// = ordre d'affichage dans la légende. Palette PARTAGÉE avec le shader (pcClass) —
// garder les deux synchronisées.
export const CLASS_INFO: Record<
  number,
  { label: string; color: [number, number, number]; order: number }
> = {
  2: { label: 'Sol', color: [0.6, 0.46, 0.33], order: 0 },
  3: { label: 'Végétation basse', color: [0.62, 0.8, 0.4], order: 1 },
  4: { label: 'Végétation moyenne', color: [0.4, 0.68, 0.32], order: 2 },
  5: { label: 'Végétation haute', color: [0.18, 0.45, 0.22], order: 3 },
  24: { label: 'Ligne électrique', color: [0.95, 0.12, 0.12], order: 4 }, // rouge vif
  25: { label: 'Urgence U0', color: [0.769, 0.0, 0.769], order: 5 }, // magenta
  26: { label: 'Urgence U1', color: [1.0, 0.149, 0.149], order: 6 }, // rouge
  27: { label: 'Urgence U2', color: [1.0, 1.0, 0.0], order: 7 }, // jaune
  28: { label: 'Urgence U3', color: [0.624, 1.0, 1.0], order: 8 }, // cyan
  29: { label: 'Urgence U4', color: [0.059, 0.529, 1.0], order: 9 }, // bleu
}
export const CLASS_OTHER = {
  label: 'Autre',
  color: [0.55, 0.55, 0.6] as [number, number, number],
  order: 10,
}
export const classInfo = (code: number) => CLASS_INFO[code] ?? CLASS_OTHER
