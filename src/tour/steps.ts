import type { Map as MLMap } from 'maplibre-gl'
import type { BasemapId } from '@/map/basemaps'
import { addBuildings3D, removeBuildings3D } from '@/map/layers/buildings3d'
import { addTrafficFlow, removeTrafficFlow } from '@/map/layers/trafficFlow'
import { addHikingTerrain, type HikingHandle } from '@/map/layers/hikingTerrain'
import { STATIC_LADEFENSE_HEIGHTS } from '@/data/sample-buildings'
import { addVectorStyled, removeVectorStyled } from '@/map/layers/vectorStyled'
import { addMeasureTool, MEASURE_DEMO_BLOCK, type MeasureHandle } from '@/map/layers/measureLayer'
import { addDrawAnalysis, DRAW_DEMO_POLYGON, type DrawHandle } from '@/map/layers/drawAnalysis'
import { addIsochrones, removeIsochrones, computeIsochroneStats } from '@/map/layers/isochrones'
import { SWIPE_VIEW } from '@/map/swipe-view'
import { addHeatmap, removeHeatmap } from '@/map/layers/heatmap'
import { addCadastre, removeCadastre } from '@/map/layers/cadastre'
import { addRealtimeSupervision, type RealtimeHandle } from '@/map/layers/realtime'
import {
  showRecoveryToast,
  dismissSurchargeToast,
  dismissRecoveryToast,
} from '@/components/IncidentToast'
import { useMapDataStore } from '@/store/map-data-store'
import { useTourStore } from '@/store/tour-store'
import { HEATMAP_CITY_COUNTS } from '@/data/sample-points'

export type ChartKind =
  | 'none'
  | 'buildings'
  | 'basemap'
  | 'table'
  | 'measure'
  | 'heatmap'
  | 'highlight'
  | 'layers-presentation'
  | 'layers-applied'
  | 'draw'
  | 'isochrone'
  | 'swipe'
  | 'realtime'
  | 'hiking'
  | 'ecosystem'
  | 'techstack'

// Real, map-rendering layers demonstrated in the "Suivant applies a layer"
// sub-steps. Display metadata lives in LayersAppliedCard; the add/remove is
// driven by each step's onEnter/onLeave.
export type AppliedLayerId = 'cadastre' | 'buildings3d'

export type StepContext = {
  setBasemap: (id: BasemapId) => void
}

export type TourStep = {
  id: string
  title: string
  description: string
  element?: string // CSS selector for driver.js anchor; defaults to map canvas
  basemap?: BasemapId
  camera: {
    center: [number, number]
    zoom: number
    pitch?: number
    bearing?: number
    // Offsets the visual center (px). e.g. bottom padding lifts the scene above
    // a bottom overlay so it stays visible.
    padding?: { top?: number; bottom?: number; left?: number; right?: number }
  }
  chart: ChartKind
  appliedLayer?: AppliedLayerId
  // Id of a catalogue layer card to "click" (animated cursor) on this step.
  clickLayer?: string
  // Id of a catalogue card/button to spotlight (looping pulse) on this step.
  // Unlike clickLayer, it does NOT auto-advance — the user clicks "Suivant".
  highlightLayer?: string
  // Joue le geste « glisser-déposer un fichier » (faux curseur) sur la zone
  // d'import du catalogue, puis avance tout seul — comme clickLayer mais en
  // drag-and-drop. « Suivant » est verrouillé tant que le dépôt n'a pas eu lieu.
  dropImport?: boolean
  // Animate the camera into this step: jump to `fromZoom` then flyTo camera.zoom,
  // instead of an instant jumpTo. onEnter runs at fromZoom so the layer loads
  // progressively during the zoom.
  flyIn?: { fromZoom: number; duration?: number }
  // Anime depuis la caméra courante vers ce step (pan/vol smooth) au lieu d'un
  // jumpTo. Contrairement à flyIn (qui saute large d'abord), pan part de la
  // position laissée par le step précédent.
  pan?: { duration?: number }
  // Pour une transition pan, le onLeave du step est normalement différé jusqu'à
  // l'arrivée (moveend) pour ne pas faire disparaître ses couches avant le vol.
  // Avec ce flag, on tear-down AVANT le flyTo : utile quand la couche ne doit pas
  // traîner pendant tout le vol (ex. cadastre, dont les limites de parcelles
  // n'ont aucun sens sur le trajet vers la destination).
  leaveBeforePan?: boolean
  cinematic?: boolean
  // Run onEnter only once the camera has settled (on moveend), not before the
  // flight. Required for scripted animations (measure/draw) so the trace replays
  // at the right place when navigating back (pan flight) instead of off-screen.
  enterOnSettle?: boolean
  onEnter?: (map: MLMap, ctx: StepContext) => void | Promise<void>
  onLeave?: (map: MLMap) => void
}

// Per-step ephemeral state (e.g. measure tool handle)
let measureHandle: MeasureHandle | null = null
let drawHandle: DrawHandle | null = null
let realtimeHandle: RealtimeHandle | null = null
let hikingHandle: HikingHandle | null = null

// ── Séquence HTA (supervision live → surcharge → réparation → rétablissement).
// Le poste incident est le poste source P-4521 (id 1) : flambe sur cue puis se
// rétablit vers sa charge nominale (base 0,58 → vert). En supervision, le curseur
// survole un poste « surveillé » (ambre) pour montrer la fiche express live.
export const HTA_INCIDENT_ID = 1
// Postes balayés en supervision : un arc NE → SO qui passe sur 2 postes nominaux
// (8 Étang du Coq, 2 La Borderie) puis les 2 « surveillés » ambre (10 La Charmoie,
// 5 Bois Renault) — tous visibles au cadrage overview z10.2.
export const HTA_HOVER_IDS = [8, 2, 10, 5]
// Accès à la couche live pour le curseur scripté (RtScriptedCursor).
export const getRealtimeHandle = () => realtimeHandle
const HTA_IDS = new Set([
  'rt-supervision',
  'rt-surcharge',
  'rt-todo',
  'rt-in-progress',
  'rt-done',
  'rt-recap',
])

// Construit la couche live si besoin (1re entrée OU re-entrée après détachement,
// ex. retour arrière depuis l'écosystème). Idempotent sur le reste du bloc HTA.
function ensureRealtime(map: MLMap) {
  if (!realtimeHandle) {
    realtimeHandle = addRealtimeSupervision(
      map,
      (feed) => useMapDataStore.getState().setRealtime(feed),
      { incidentId: HTA_INCIDENT_ID },
    )
  }
  return realtimeHandle
}

// Démontage différé : on garde la couche live tant qu'on reste dans le bloc HTA
// (transitions same-anchor de driver.js), on ne détruit qu'à la sortie.
function htaLeave() {
  const nextId = STEPS[useTourStore.getState().currentStep]?.id
  if (nextId && HTA_IDS.has(nextId)) return
  realtimeHandle?.detach()
  realtimeHandle = null
  useMapDataStore.getState().setRealtime(null)
  useMapDataStore.getState().resetPOIStatus()
  useTourStore.getState().setIncidentClicked(false)
  // Sortie du bloc HTA : on referme tout toast d'incident encore affiché.
  dismissSurchargeToast()
  dismissRecoveryToast()
}

export const STEPS: TourStep[] = [
  {
    id: 'workspace-sidebar',
    title: 'Espace de travail',
    description:
      'Toutes vos données métier centralisées à gauche : couches du projet (cadastre, bâtiments, réseau…), jeux de données importés (GeoJSON, Shapefile, WMTS) et activité de l’équipe. Le compte connecté reste accessible en bas.',
    element: '[data-slot="sidebar-inner"]',
    basemap: 'positron',
    camera: { center: [2.5, 46.5], zoom: 5, pitch: 0, bearing: 0 },
    chart: 'none',
  },
  {
    id: 'layers-overview',
    title: 'Catalogue de couches',
    description:
      'Fonds de plan, réseau électrique (HTA/BT, postes, poteaux), overlays raster (cadastre, débroussaillement, UAS) et zones protégées (Natura 2000, ZNIEFF, parcs, réserves…). Toutes activables individuellement ou par catégorie, stylées via expressions data-driven.',
    // Ancré sur le bouton Couches : la modale n'existe pas encore (elle s'ouvre
    // quand le faux curseur « clique » ce bouton — cf. LayersButton).
    element: '#layers-open-button',
    basemap: 'positron',
    camera: { center: [2.5, 46.5], zoom: 5, pitch: 0, bearing: 0 },
    chart: 'layers-presentation',
  },
  {
    id: 'layers-pick-cadastre',
    title: 'Sélection de la couche',
    description:
      'On choisit « Cadastre » dans la catégorie Raster du catalogue. Suivant pour l’appliquer réellement sur la carte.',
    element: '#layers-presentation-modal',
    basemap: 'positron',
    camera: { center: [2.5, 46.5], zoom: 5, pitch: 0, bearing: 0 },
    chart: 'layers-presentation',
    clickLayer: 'cadastre',
  },
  {
    id: 'layers-apply-cadastre',
    title: 'Cadastre appliqué',
    description:
      'Le catalogue se réduit, la carte zoome sur une commune et la couche cadastre (WMTS IGN PARCELLAIRE_EXPRESS) s’affiche réellement — limites de parcelles par-dessus le fond de plan.',
    basemap: 'positron',
    camera: { center: [2.321, 48.829], zoom: 17.4, pitch: 0, bearing: 0 },
    flyIn: { fromZoom: 11, duration: 4200 },
    chart: 'layers-applied',
    appliedLayer: 'cadastre',
    // Retire la couche cadastre avant le vol vers le step suivant (Bâtiments 3D),
    // sinon les limites de parcelles restent affichées pendant tout le pan.
    leaveBeforePan: true,
    onEnter(map) {
      addCadastre(map)
    },
    onLeave(map) {
      removeCadastre(map)
    },
  },
  {
    id: 'layers-apply-buildings',
    title: 'Bâtiments 3D appliqués',
    description:
      'Suivant active la couche suivante : extrusion 3D des bâtiments sur le quartier d’affaires de La Défense, colorés selon leur hauteur. La même mécanique vaut pour n’importe quelle couche du catalogue.',
    basemap: 'positron',
    camera: { center: [2.251476, 48.88991], zoom: 16.14, pitch: 67, bearing: -83.1 },
    chart: 'buildings',
    appliedLayer: 'buildings3d',
    pan: { duration: 4200 },
    cinematic: true,
    onEnter(map) {
      addBuildings3D(map, { colorByHeight: true })
      addTrafficFlow(map)
      useMapDataStore.getState().setBuildingHeights(STATIC_LADEFENSE_HEIGHTS)
    },
    onLeave(map) {
      removeTrafficFlow(map)
      removeBuildings3D(map)
      useMapDataStore.getState().setBuildingHeights([])
    },
  },
  {
    id: 'terrain-hiking',
    title: 'Terrain 3D · randonnée',
    description:
      'Changement d’échelle, cap sur les Alpes : le relief du massif du Mont-Blanc est reconstitué en 3D à partir d’un modèle numérique d’élévation (DEM), drapé d’imagerie satellite et ombré. Un randonneur grimpe en direct depuis Chamonix (~1 060 m) le long d’un sentier d’altitude jusqu’à près de 3 020 m — son tracé se révèle derrière lui et le profil d’altitude défile dans le panneau.',
    basemap: 'satellite',
    // Cadrage de départ du sentier : le vol d'entrée atterrit ici, puis la timeline GSAP
    // prend la main et fait suivre la caméra au randonneur sur une ligne lissée (centre +
    // cap ; pitch/zoom restent ceux-ci). Pas de `cinematic` (sa rotation idle gênerait).
    camera: { center: [6.8888, 45.936], zoom: 14.2, pitch: 68, bearing: 172 },
    chart: 'hiking',
    // Vol longue distance La Défense → Chamonix (flyTo en arc).
    pan: { duration: 5200 },
    // Terrain/ciel/randonneur montés une fois la caméra posée sur le style
    // satellite chargé (cf. measure/draw) ; la boucle GSAP rejoue alors au bon
    // endroit lors d'un retour arrière.
    enterOnSettle: true,
    onEnter(map) {
      hikingHandle = addHikingTerrain(map, (frac) =>
        useMapDataStore.getState().setHikeProgress(frac),
      )
    },
    onLeave() {
      hikingHandle?.detach()
      hikingHandle = null
      useMapDataStore.getState().setHikeProgress(0)
    },
  },
  {
    id: 'customize-theme',
    title: 'Thème & personnalisation',
    description:
      'L’application s’adapte à votre marque : thème clair/sombre, couleurs et fonds de plan personnalisables. Ici, on bascule l’interface en mode sombre — la carte suit avec un fond de plan dark assorti.',
    // Spotlight sur le bouton de thème dans la sidebar ; le faux curseur va le cliquer.
    element: '#gp-theme-toggle',
    basemap: 'positron',
    // Vue large « tout le workspace » : le reveal balaie sidebar + carte d’un coup.
    camera: { center: [2.5, 46.5], zoom: 5, pitch: 0, bearing: 0 },
    chart: 'none',
  },
  {
    id: 'layers-import-pick',
    title: 'Vos propres données',
    description:
      'GeoJSON, KML, Shapefile, GPX, CSV géolocalisé — glissez-déposez vos fichiers ou connectez vos endpoints. L’import démarre automatiquement.',
    element: '#layers-presentation-modal',
    basemap: 'positron',
    camera: { center: [2.5, 46.5], zoom: 5, pitch: 0, bearing: 0 },
    chart: 'layers-presentation',
    dropImport: true,
  },
  {
    id: 'layers-import',
    title: 'Import d’une couche',
    description:
      'La couche de zones Dijon (GeoJSON) est téléversée, reprojetée (Lambert-93 → WGS 84) et validée, puis ajoutée à la carte. Patientez la fin de l’import.',
    element: '#layers-presentation-modal',
    basemap: 'positron',
    camera: { center: [2.5, 46.5], zoom: 5, pitch: 0, bearing: 0 },
    chart: 'layers-presentation',
  },
  {
    id: 'data-table',
    title: 'Vue tabulaire des données',
    description:
      'La couche que vous venez d’importer, vue en tableau : responsables, statuts, couverture et tendances. Ce sont exactement les mêmes objets que sur la carte.',
    element: '#data-table-panel',
    basemap: 'positron',
    // Bottom padding lifts the features into the top half, above the table overlay.
    camera: { center: [5.04, 47.25], zoom: 9.4, pitch: 0, bearing: 0, padding: { bottom: 380 } },
    // Vol smooth depuis la vue d'import (même basemap) plutôt qu'un jumpTo : la
    // couche importée apparaît pendant que la caméra plonge sur les zones.
    pan: { duration: 4000 },
    chart: 'table',
    onEnter(map) {
      addVectorStyled(map)
    },
    onLeave(map) {
      removeVectorStyled(map)
    },
  },
  {
    id: 'measure',
    title: 'Mesure interactive',
    description:
      'Le périmètre d’un pâté de maison est tracé automatiquement : la distance est calculée en direct (Turf.js), la boucle se referme sur le premier point, puis la zone se remplit.',
    basemap: 'positron',
    camera: { center: [5.3689, 43.2944], zoom: 15.5, pitch: 0, bearing: 0 },
    chart: 'measure',
    enterOnSettle: true,
    onEnter(map) {
      useTourStore.getState().setMeasureDone(false)
      useTourStore.getState().setTraceCursorHidden(false)
      measureHandle = addMeasureTool(
        map,
        (pts, km) => useMapDataStore.getState().setMeasure(pts, km),
        {
          auto: true,
          path: MEASURE_DEMO_BLOCK,
          // Pas posé (> défaut 700 ms) pour un tracé lisible, segment par segment.
          stepMs: 800,
          onLastClick: () => useTourStore.getState().setTraceCursorHidden(true),
          onComplete: () => useTourStore.getState().setMeasureDone(true),
        },
      )
    },
    onLeave() {
      measureHandle?.detach()
      measureHandle = null
      useTourStore.getState().setMeasureDone(false)
      useTourStore.getState().setTraceCursorHidden(false)
    },
  },
  {
    id: 'draw-analysis',
    title: 'Dessin & analyse spatiale',
    description:
      'Une zone est tracée automatiquement : la surface est calculée en direct (Turf) et les postes HTA tombant à l’intérieur sont comptés par requête point-dans-polygone.',
    basemap: 'positron',
    camera: { center: [1.85, 47.44], zoom: 10, pitch: 0, bearing: 0 },
    chart: 'draw',
    enterOnSettle: true,
    onEnter(map) {
      useTourStore.getState().setDrawDone(false)
      useTourStore.getState().setTraceCursorHidden(false)
      drawHandle = addDrawAnalysis(map, (stats) => useMapDataStore.getState().setDrawStats(stats), {
        auto: true,
        polygon: DRAW_DEMO_POLYGON,
        onLastClick: () => useTourStore.getState().setTraceCursorHidden(true),
        onComplete: () => useTourStore.getState().setDrawDone(true),
      })
    },
    onLeave() {
      drawHandle?.detach()
      drawHandle = null
      useTourStore.getState().setDrawDone(false)
      useTourStore.getState().setTraceCursorHidden(false)
    },
  },
  {
    id: 'isochrones',
    title: 'Isochrones d’accessibilité',
    description:
      'Depuis le centre de maintenance, les zones atteignables en 5, 10 et 15 minutes de route. Croisé avec le réseau, ça répond à « combien de postes puis-je joindre à temps ? » — base de l’optimisation des tournées.',
    basemap: 'positron',
    camera: { center: [1.85, 47.44], zoom: 9.6, pitch: 0, bearing: 0 },
    flyIn: { fromZoom: 7.5, duration: 3800 },
    chart: 'isochrone',
    onEnter(map) {
      addIsochrones(map)
      useMapDataStore.getState().setIsochroneStats(computeIsochroneStats())
    },
    onLeave(map) {
      removeIsochrones(map)
      useMapDataStore.getState().setIsochroneStats([])
    },
  },
  {
    id: 'swipe',
    title: 'Comparaison avant / après',
    description:
      'Deux millésimes d’orthophotos IGN sur la même emprise, séparés par un curseur que tu fais glisser. Pan et zoom restent synchronisés entre les deux cartes — l’outil classique du suivi diachronique.',
    basemap: 'positron',
    camera: { center: SWIPE_VIEW.center, zoom: SWIPE_VIEW.zoom, pitch: 0, bearing: 0 },
    chart: 'swipe',
  },
  {
    id: 'heatmap',
    title: 'Heatmap de densité',
    description:
      'Couche heatmap MapLibre native sur ~1100 points pondérés. Top 5 des villes les plus denses dans le panneau.',
    basemap: 'positron',
    camera: { center: [2.5, 46.5], zoom: 5.4, pitch: 0, bearing: 0 },
    chart: 'heatmap',
    onEnter(map) {
      addHeatmap(map)
      useMapDataStore.getState().setHeatmapTopZones(HEATMAP_CITY_COUNTS)
    },
    onLeave(map) {
      removeHeatmap(map)
      useMapDataStore.getState().setHeatmapTopZones([])
    },
  },
  {
    id: 'rt-supervision',
    title: 'Supervision temps réel',
    description:
      'Tout le réseau HTA 20 kV de Sologne, supervisé en direct : charge des postes (vert → ambre → rouge), courant qui circule sur les lignes, flotte de maintenance géolocalisée. Le curseur survole un poste — la fiche express s’affiche en direct. Flux SCADA simulé, rafraîchi chaque seconde — en production via WebSocket / Redis.',
    basemap: 'positron',
    // Cadrage « tout le réseau » : le poste source (est) et les postes ouest
    // tiennent à l'écran — la surcharge à venir s'affichera bien en contexte.
    camera: { center: [1.82, 47.45], zoom: 10.2, pitch: 0, bearing: 0 },
    chart: 'realtime',
    pan: { duration: 4200 },
    enterOnSettle: true,
    onEnter(map) {
      const rt = ensureRealtime(map)
      // (Re)part d'un réseau nominal : poste incident vert, fiche fermée.
      rt.resetIncident()
      rt.closePopup()
      useMapDataStore.getState().resetPOIStatus()
      useTourStore.getState().setIncidentClicked(false)
    },
    onLeave: htaLeave,
  },
  {
    id: 'rt-surcharge',
    title: 'Surcharge détectée',
    description:
      "La charge du poste source P-4521 grimpe d'un coup au-delà du seuil critique : le poste vire au rouge et l'anneau d'alerte « sonar » se déclenche. La conduite zoome sur le poste et ouvre sa fiche d'intervention.",
    basemap: 'positron',
    // Même cadrage que la supervision : on entre sans vol, la surcharge éclate
    // en contexte réseau (overview). Le curseur scripté (RtScriptedCursor) joue
    // ensuite le vol vers le poste + le clic qui ouvre la fiche.
    camera: { center: [1.82, 47.45], zoom: 10.2, pitch: 0, bearing: 0 },
    chart: 'realtime',
    // GATE : « Suivant » reste verrouillé (incidentClicked) jusqu'à ce que le
    // curseur ait cliqué le poste et ouvert sa fiche (cf. TourController +
    // RtScriptedCursor). Pas de skip anticipé pendant le climax.
    onEnter(map) {
      ensureRealtime(map).triggerSurcharge(HTA_INCIDENT_ID)
    },
    onLeave: htaLeave,
  },
  {
    id: 'rt-todo',
    title: 'Étape 1 · À faire',
    description:
      "Intervention engagée : la fiche de P-4521 est ouverte. Statut initial — à inspecter. Le technicien voit le contexte (tension, charge, anomalies, dernière visite) avant d'agir.",
    element: '.gp-popup',
    basemap: 'positron',
    // Le vol a déjà été joué par le curseur en « Surcharge détectée » : on reste
    // sur le poste (z15.2), transition instantanée, fiche déjà ouverte.
    camera: { center: [2.04, 47.428], zoom: 15.2, pitch: 0, bearing: 0 },
    chart: 'realtime',
    onEnter(map) {
      const rt = ensureRealtime(map)
      // Garantit l'état rouge + fiche ouverte (re-jeu après retour arrière / saut).
      rt.triggerSurcharge(HTA_INCIDENT_ID)
      if (!rt.popupOpen()) rt.openPost(HTA_INCIDENT_ID)
      useMapDataStore.getState().setPOIStatus(String(HTA_INCIDENT_ID), 'todo')
    },
    onLeave: htaLeave,
  },
  {
    id: 'rt-in-progress',
    title: 'Étape 2 · En cours',
    description:
      "L'agent est sur place — la cellule HTA est ouverte, le diagnostic démarre. La supervision conduite suit l'intervention en temps réel pendant que le poste reste en alerte.",
    element: '.gp-popup',
    basemap: 'positron',
    camera: { center: [2.04, 47.428], zoom: 15.2, pitch: 0, bearing: 0 },
    chart: 'realtime',
    onEnter(map) {
      const rt = ensureRealtime(map)
      rt.triggerSurcharge(HTA_INCIDENT_ID)
      if (!rt.popupOpen()) rt.openPost(HTA_INCIDENT_ID)
      useMapDataStore.getState().setPOIStatus(String(HTA_INCIDENT_ID), 'in_progress')
    },
    onLeave: htaLeave,
  },
  {
    id: 'rt-done',
    title: 'Étape 3 · Terminé — réseau rétabli',
    description:
      "Intervention validée : la charge de P-4521 redescend sous le seuil, le poste repasse au vert dans le flux temps réel et l'alerte se lève. La donnée remonte au SI métier.",
    element: '.gp-popup',
    basemap: 'positron',
    camera: { center: [2.04, 47.428], zoom: 15.2, pitch: 0, bearing: 0 },
    chart: 'realtime',
    onEnter(map) {
      const rt = ensureRealtime(map)
      if (!rt.popupOpen()) rt.openPost(HTA_INCIDENT_ID)
      useMapDataStore.getState().setPOIStatus(String(HTA_INCIDENT_ID), 'done')
      // Réseau rétabli : toast de succès symétrique (auto-fermeture).
      showRecoveryToast()
    },
    onLeave: htaLeave,
  },
  {
    id: 'rt-recap',
    title: 'Réseau rétabli',
    description:
      'Recul sur tout le réseau : plus aucun poste en alerte, charge nominale partout. La supervision confirme le retour à la normale — flux SCADA toujours en direct.',
    basemap: 'positron',
    // Même cadrage overview que la supervision : recul symétrique « tout vert ».
    camera: { center: [1.82, 47.45], zoom: 10.2, pitch: 0, bearing: 0 },
    chart: 'realtime',
    pan: { duration: 3600 },
    onEnter(map) {
      ensureRealtime(map).closePopup()
    },
    onLeave: htaLeave,
  },
  {
    id: 'ecosystem',
    title: 'Un pont vers tout votre écosystème SIG',
    description:
      'Vos outils restent les vôtres : la plateforme importe et exporte avec QGIS, ArcGIS, GeoServer, PostGIS, AutoCAD, Google Earth… GeoJSON, Shapefile, KML, WMS/WMTS et bien d’autres circulent dans les deux sens.',
    element: '#ecosystem-diagram',
    basemap: 'positron',
    camera: { center: [2.5, 46.5], zoom: 5, pitch: 0, bearing: 0 },
    chart: 'ecosystem',
  },
  {
    id: 'techstack',
    title: 'Notre stack technique',
    description:
      'De la donnée à l’écran : conteneurisée avec Docker, la plateforme stocke et interroge la géométrie via PostgreSQL/PostGIS (édition QGIS), Node.js orchestre la logique métier, Redis met en cache et diffuse en temps réel, et MapLibre + React restituent le tout. Une pile pensée pour la performance géospatiale.',
    element: '#techstack-diagram',
    basemap: 'positron',
    camera: { center: [2.5, 46.5], zoom: 5, pitch: 0, bearing: 0 },
    chart: 'techstack',
  },
  {
    id: 'outro',
    title: 'Et bien plus encore',
    description:
      'Point clouds Potree, mesures d’aires, WMS multi-sources, clustering, intégration backend GeoServer / MapProxy… On en discute ?',
    basemap: 'positron',
    camera: { center: [2.5, 46.5], zoom: 5, pitch: 0, bearing: 0 },
    chart: 'none',
  },
]

// Step « Thème & personnalisation » : le faux curseur y bascule l'app en dark.
// Les steps AVANT (intro catalogue/import) restent en light ; ce step et ceux
// d'APRÈS passent en dark (cf. TourController.applyStepTheme).
export const THEME_FLIP_STEP_ID = 'customize-theme'
export const THEME_FLIP_INDEX = STEPS.findIndex((s) => s.id === THEME_FLIP_STEP_ID)
