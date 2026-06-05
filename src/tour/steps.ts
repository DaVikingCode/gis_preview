import type { Map as MLMap } from 'maplibre-gl'
import type { BasemapId } from '@/map/basemaps'
import { addBuildings3D, removeBuildings3D } from '@/map/layers/buildings3d'
import { addTrafficFlow, removeTrafficFlow } from '@/map/layers/trafficFlow'
import { addHikingTerrain, type HikingHandle } from '@/map/layers/hikingTerrain'
import { addAirplane3D, type AirplaneHandle } from '@/map/layers/airplane3d'
import {
  addPointCloud,
  prewarmPointCloud,
  POINTCLOUD_ANCHOR,
  type PointCloudHandle,
} from '@/map/layers/pointCloud'
import { addSatelliteHd, removeSatelliteHd } from '@/map/layers/satelliteHd'
import { STATIC_LADEFENSE_HEIGHTS } from '@/data/sample-buildings'
import { addVectorStyled, removeVectorStyled } from '@/map/layers/vectorStyled'
import { addMeasureTool, MEASURE_DEMO_BLOCK, type MeasureHandle } from '@/map/layers/measureLayer'
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
  | 'isochrone'
  | 'swipe'
  | 'realtime'
  | 'hiking'
  | 'pointcloud'
  | 'airplane'
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
    // Zoom de repli sur mobile (useIsMobile, <768px) : le viewport étant plus étroit,
    // certains cadrages paraissent trop zoomés. Optionnel — sinon `zoom` est utilisé.
    mobileZoom?: number
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
  // flight. Required for scripted animations (measure) so the trace replays
  // at the right place when navigating back (pan flight) instead of off-screen.
  enterOnSettle?: boolean
  onEnter?: (map: MLMap, ctx: StepContext) => void | Promise<void>
  onLeave?: (map: MLMap) => void
}

// Per-step ephemeral state (e.g. measure tool handle)
let measureHandle: MeasureHandle | null = null
let realtimeHandle: RealtimeHandle | null = null
let hikingHandle: HikingHandle | null = null
let airplaneHandle: AirplaneHandle | null = null
let pointCloudHandle: PointCloudHandle | null = null

// Séquence HTA (supervision live → surcharge → réparation → rétablissement).
// Poste incident = poste source P-4521 (id 1) : flambe sur cue puis se rétablit.
export const HTA_INCIDENT_ID = 1
// Postes balayés en supervision (arc NE → SO) : 2 nominaux puis 2 « surveillés » ambre.
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
      'Toutes vos données métier réunies au même endroit : couches du projet, jeux de données importés et activité de l’équipe.',
    element: '[data-slot="sidebar-inner"]',
    basemap: 'positron',
    camera: { center: [2.5, 46.5], zoom: 5, pitch: 0, bearing: 0 },
    chart: 'none',
  },
  {
    id: 'layers-overview',
    title: 'Catalogue de couches',
    description:
      'Activez vos couches d’un clic, individuellement ou par catégorie : fonds de plan, réseaux, raster et zones protégées.',
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
    description: 'Choisissez une couche dans le catalogue. Suivant pour l’appliquer sur la carte.',
    element: '#layers-presentation-modal',
    basemap: 'positron',
    camera: { center: [2.5, 46.5], zoom: 5, pitch: 0, bearing: 0 },
    chart: 'layers-presentation',
    clickLayer: 'cadastre',
  },
  {
    id: 'layers-apply-cadastre',
    title: 'Cadastre',
    description:
      'La couche s’affiche sur la carte : limites de parcelles cadastrales par-dessus le fond de plan.',
    basemap: 'positron',
    camera: { center: [2.321, 48.829], zoom: 17.4, pitch: 0, bearing: 0 },
    // Le saut (caché derrière le backdrop plein écran de la modale) atterrit déjà
    // au-dessus de z13 : les parcelles cadastrales sont visibles dès que la modale
    // se dissout. Glisse douce z14 → 17.4 pendant la dissolution.
    flyIn: { fromZoom: 14, duration: 3000 },
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
    title: 'Bâtiments 3D',
    description:
      'Bâtiments en 3D, colorés selon leur hauteur — ici La Défense. La même mécanique vaut pour n’importe quelle couche.',
    basemap: 'positron',
    camera: {
      center: [2.251476, 48.88991],
      zoom: 16.14,
      mobileZoom: 15,
      pitch: 67,
      bearing: -83.1,
    },
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
      'Relief 3D reconstitué à partir d’un modèle d’élévation, drapé d’imagerie satellite. Ici, un parcours d’altitude suivi en direct dans les Alpes.',
    basemap: 'satellite',
    // Cadrage FIXE du sentier : le vol d'entrée atterrit ici et la caméra n'en bouge plus pendant
    // toute la montée (la timeline GSAP n'anime que le randonneur, pas la caméra) — aucun re-rendu
    // terrain forcé par frame, donc bien meilleurs fps. Pas de `cinematic`.
    camera: {
      center: [6.93397, 45.906809],
      zoom: 13.14,
      mobileZoom: 12.4,
      pitch: 57.3,
      bearing: -57.1,
    },
    chart: 'hiking',
    // Vol longue distance La Défense → Chamonix (flyTo en arc).
    pan: { duration: 3800 },
    // Monté une fois la caméra posée pour que la boucle GSAP rejoue au bon endroit
    // au retour arrière (cf. measure).
    enterOnSettle: true,
    // Le step PRÉCÉDENT (bâtiments 3D) a un `pan` : un retour arrière passe donc par le vol pané,
    // qui sinon différerait le détachement jusqu'à l'atterrissage — markers (randonneur + pin),
    // popup POI et timeline GSAP de la rando traîneraient sur tout le vol. On nettoie AVANT le pan.
    leaveBeforePan: true,
    onEnter(map) {
      hikingHandle = addHikingTerrain(map, (frac) =>
        useMapDataStore.getState().setHikeProgress(frac),
      )
      // Préchauffe le nuage LiDAR (step suivant) : load() — lecture cache, décodage,
      // upload GPU, compile shader — tourne pendant qu'on regarde le terrain → arrivée
      // au step sans freeze. N'écrit rien dans le store → pas d'animation ici. NE PAS
      // le détacher dans onLeave (déclenché aussi sur 6→7, ça tuerait le préchauffe).
      prewarmPointCloud(map)
    },
    onLeave() {
      hikingHandle?.detach()
      hikingHandle = null
      useMapDataStore.getState().setHikeProgress(0)
    },
  },
  {
    id: 'pointcloud-lidar',
    title: 'Nuage de points · LiDAR',
    description:
      'Scan LiDAR d’Auxonne (~9,5 millions de points, vraie couleur RGB + classification), rendu en 3D via three.js dans le contexte WebGL de la carte, posé sur le fond de plan. Le scan bascule entre colorisation par altitude, vraie couleur et classification.',
    basemap: 'satellite',
    // Cadrage sur le VRAI emplacement du scan (Auxonne, France — cf. POINTCLOUD_ANCHOR).
    // Bande de ~496 × 176 m, plate : cadrage large incliné pour voir tout le nuage.
    camera: {
      center: POINTCLOUD_ANCHOR,
      zoom: 16,
      mobileZoom: 15.2,
      pitch: 45,
      bearing: 0,
    },
    chart: 'pointcloud',
    // Vol Chamonix → Auxonne (France).
    pan: { duration: 3200 },
    // Rendu posé une fois la caméra arrivée (cf. hiking) : au retour arrière, le nuage
    // réapparaît au bon endroit après le vol pané plutôt qu'hors champ.
    enterOnSettle: true,
    // Le step précédent (rando) a un pan : on nettoie sa couche AVANT le vol retour.
    leaveBeforePan: true,
    // Pas d'orbite plate auto : la timeline GSAP (usePointCloudChoreography) possède
    // TOUT le mouvement (survol + scans de colorisation), puis réactive l'orbite calme
    // (setCinematic(true)) une fois posée.
    cinematic: false,
    onEnter(map) {
      // La timeline GSAP vit dans usePointCloudChoreography (monté par
      // PointCloudDirector) ; ici on ne fait que poser la couche dans le store et
      // incrémenter le jeton de lecture (le hook (re)joue alors la séquence).
      const ds = useMapDataStore.getState()
      ds.setPointCloudColorMode('altitude')
      useTourStore.getState().setCinematic(false)

      // Calque satellite surzoomable SOUS le nuage : au survol de la ligne (zoom ~20)
      // l'imagerie reste visible au lieu de blanchir (cf. satelliteHd.ts). Ajouté avant
      // le nuage → les points restent au-dessus.
      addSatelliteHd(map)

      pointCloudHandle = addPointCloud(map)
      const handle = pointCloudHandle
      ds.setPointCloudHandle(handle)
      ds.setPointCloudReplay(() => useMapDataStore.getState().bumpPointCloudRun())

      // Démarre une fois la géométrie chargée, si on est toujours sur ce step.
      void handle.ready.then(() => {
        if (pointCloudHandle !== handle) return
        useMapDataStore.getState().bumpPointCloudRun()
      })
    },
    onLeave(map) {
      removeSatelliteHd(map)
      const ds = useMapDataStore.getState()
      // STOP SYNCHRONE de l'orbite caméra : en fin de chorégraphie, makeOrbit() relance
      // une orbite infinie qui pilote la caméra (map.jumpTo) chaque frame, tuée seulement
      // à la 1re interaction SUR LA CARTE (clic « Suivant » = bouton DOM → ne la libère
      // pas). Le cleanup useGSAP de resetPointCloudRun() est asynchrone et arriverait
      // APRÈS le flyTo de la transition → l'orbite l'annulerait (« Suivant » sans effet).
      // On la pause donc tout de suite, avant le vol (onLeave précède le flyTo via
      // leaveBeforePan). Le cleanup useGSAP finira de tout tuer ensuite.
      ds.pointCloudStopCamera?.()
      ds.resetPointCloudRun() // tue la timeline via le hook (revertOnUpdate)
      pointCloudHandle?.detach()
      pointCloudHandle = null
      ds.setPointCloudHandle(null)
      ds.setPointCloudStats(null)
      ds.setPointCloudReplay(null)
      ds.setPointCloudColorMode('altitude')
    },
  },
  {
    id: 'flyover-3d',
    title: 'Survol 3D · globe',
    description:
      'La carte bascule en projection globe puis un modèle 3D glTF, rendu via three.js dans le contexte WebGL de la carte, suit un grand cercle Paris ↔ New York en altitude — la caméra l’accompagnant autour de la Terre.',
    basemap: 'satellite',
    // Départ : gros plan incliné sur Paris–Charles de Gaulle. Le tour pose la caméra
    // ici (pan depuis Chamonix), puis onEnter (enterOnSettle) lance l'avion + le
    // dézoom vers la vue orbitale (cf. addAirplane3D).
    // Gros plan incliné sur Paris–Charles de Gaulle : on démarre cadré sur l'avion
    // au sol pour le voir décoller en suivant le tracé, avant que la boucle ne
    // pull-out vers la vue orbitale (cf. ZOOM_NEAR/PITCH_NEAR dans addAirplane3D).
    camera: {
      center: [2.5479, 49.0097],
      zoom: 5.2,
      mobileZoom: 4.4,
      pitch: 66,
      bearing: 21,
    },
    chart: 'airplane',
    pan: { duration: 3200 },
    enterOnSettle: true,
    // La boucle de vol pilote la caméra par-frame (map.jumpTo) et bascule en projection
    // globe : on doit la démonter (kill timelines + retour mercator) AVANT tout vol pané,
    // sinon au retour arrière (Prev → nuage) elle se bat contre le flyTo et le globe ne
    // se replat qu'à l'atterrissage. Symétrique de `pointcloud-lidar`.
    leaveBeforePan: true,
    // Pas de `cinematic` ici : la boucle de vol (addAirplane3D) pilote entièrement
    // la caméra par-frame ; la rotation idle de CinematicCamera entrerait en conflit.
    onEnter(map) {
      airplaneHandle = addAirplane3D(map)
    },
    onLeave() {
      airplaneHandle?.detach()
      airplaneHandle = null
    },
  },
  {
    id: 'customize-theme',
    title: 'Thème & personnalisation',
    description:
      'L’application s’adapte à votre marque : thème clair/sombre, couleurs et fonds de plan personnalisables.',
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
      'Glissez-déposez vos fichiers — GeoJSON, KML, Shapefile, GPX, CSV — ou connectez vos sources de données.',
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
      'Vos données sont importées, reprojetées et validées automatiquement, puis ajoutées à la carte.',
    element: '#layers-presentation-modal',
    basemap: 'positron',
    camera: { center: [2.5, 46.5], zoom: 5, pitch: 0, bearing: 0 },
    chart: 'layers-presentation',
  },
  {
    id: 'data-table',
    title: 'Vue tabulaire des données',
    description:
      'Vos données en tableau — les mêmes objets que sur la carte. Triez, filtrez, suivez statuts et tendances.',
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
      'Mesurez distances et périmètres directement sur la carte, avec un calcul mis à jour en direct.',
    basemap: 'positron',
    camera: { center: [5.3689, 43.2944], zoom: 15.5, mobileZoom: 14.4, pitch: 0, bearing: 0 },
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
    id: 'isochrones',
    title: 'Isochrones d’accessibilité',
    description:
      'Visualisez les zones atteignables par temps de trajet — la base pour planifier et optimiser vos tournées.',
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
      'Comparez deux états d’un même territoire avec un curseur — idéal pour suivre une évolution dans le temps.',
    basemap: 'positron',
    camera: { center: SWIPE_VIEW.center, zoom: SWIPE_VIEW.zoom, pitch: 0, bearing: 0 },
    chart: 'swipe',
  },
  {
    id: 'heatmap',
    title: 'Heatmap de densité',
    description:
      'Faites ressortir les zones de forte concentration à partir de vos points de données.',
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
      'Supervisez l’ensemble de vos installations en direct : état des équipements, flux et équipes sur le terrain, mis à jour en continu.',
    basemap: 'positron',
    // Cadrage « tout le réseau » : le poste source (est) et les postes ouest
    // tiennent à l'écran — la surcharge à venir s'affichera bien en contexte.
    camera: { center: [1.82, 47.45], zoom: 10.2, mobileZoom: 9.1, pitch: 0, bearing: 0 },
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
    title: 'Anomalie en direct',
    description:
      'Une anomalie est détectée et remontée instantanément. La supervision vous y conduit pour agir sans délai.',
    basemap: 'positron',
    // Même cadrage que la supervision : on entre sans vol, la surcharge éclate
    // en contexte réseau (overview). Le curseur scripté (RtScriptedCursor) joue
    // ensuite le vol vers le poste + le clic qui ouvre la fiche.
    camera: { center: [1.82, 47.45], zoom: 10.2, mobileZoom: 9.1, pitch: 0, bearing: 0 },
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
    title: 'Détection',
    description:
      'La plateforme rassemble tout le contexte de l’équipement concerné — vous gardez la main dès le départ.',
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
    title: 'Intervention',
    description:
      'L’intervention se pilote et se suit en direct, sans jamais perdre de vue l’ensemble de vos données.',
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
    title: 'Résolution',
    description:
      'Une fois résolue, la situation est tracée et l’information remonte automatiquement à vos outils métier.',
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
    title: 'Retour à la normale',
    description:
      'Vue d’ensemble retrouvée : tout est revenu à la normale, et la supervision continue en direct.',
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
      'Nuages de points, mesures de surfaces, sources multiples, intégrations sur mesure… et bien plus. On en discute ?',
    basemap: 'positron',
    camera: { center: [2.5, 46.5], zoom: 5, pitch: 0, bearing: 0 },
    chart: 'none',
  },
]

// Step où le faux curseur bascule l'app en dark : les steps avant restent light,
// ce step et les suivants passent en dark (cf. TourController.applyStepTheme).
export const THEME_FLIP_STEP_ID = 'customize-theme'
export const THEME_FLIP_INDEX = STEPS.findIndex((s) => s.id === THEME_FLIP_STEP_ID)
