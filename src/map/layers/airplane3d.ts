import type {
  CustomLayerInterface,
  CustomRenderMethodInput,
  LngLatLike,
  Map as MLMap,
} from 'maplibre-gl'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import * as turf from '@turf/turf'
import gsap from 'gsap'
import { useMapDataStore } from '@/store/map-data-store'
import { usePreloadStore } from '@/store/preload-store'

// -----------------------------------------------------------------------------
// Avion 3D sur le globe — couche WebGL personnalisée (three.js dans le contexte
// GL de MapLibre).
//
// Step « Survol 3D » : la carte bascule en projection GLOBE (animation de
// dézoom qui fait s'enrouler la Terre en sphère), puis un aéronef glTF texturé
// suit un grand cercle (Paris ↔ New York, aller-retour) EN ALTITUDE, la caméra
// l'accompagnant en survol.
//
// Placement du modèle : on utilise `map.transform.getMatrixForModel(lngLat, alt)`
// — la matrice de placement fournie par MapLibre, valable QUELLE QUE SOIT la
// projection (mercator OU globe), exactement comme l'exemple officiel
// « add a 3D model to globe using threejs ». MapLibre fournit aussi la matrice de
// projection du globe (args.defaultProjectionData.mainMatrix) ; on compose les
// deux et on les injecte dans la caméra three.js. Boucle d'animation pilotée par
// triggerRepaint (MapLibre n'anime pas les couches custom).
// -----------------------------------------------------------------------------

export type AirplaneHandle = { detach: () => void }

const LAYER_ID = 'gp-airplane-3d'
// GLB optimisé hors-ligne (cf. script `build:plane` : gltf-transform optimize +
// compression meshopt + textures WebP) — 17,5 Mo → ~0,77 Mo. Décodé via MeshoptDecoder
// (bundlé avec three, aucun fichier décodeur à héberger).
const MODEL_URL = '/models/plane/plane.glb'

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

const NIGHT_SOURCE_ID = 'gp-airplane-night'
const NIGHT_FILL_ID = 'gp-airplane-night-fill'
const SUN_SOURCE_ID = 'gp-airplane-sun'
const SUN_GLOW_ID = 'gp-airplane-sun-glow'

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

function setSpaceBackground(map: MLMap, on: boolean) {
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

// Point subsolaire (lng, lat) à une date : là où le Soleil est au zénith. Modèle
// simplifié (déclinaison + heure UTC, sans équation du temps) — suffisant pour un
// terminateur jour/nuit crédible en temps réel.
function subsolarPoint(date: Date): [number, number] {
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 0)
  const dayOfYear = Math.floor((date.getTime() - yearStart) / 86_400_000)
  const decl = -23.44 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10))
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
  let lng = -15 * (utcHours - 12)
  lng = ((((lng + 180) % 360) + 360) % 360) - 180 // normalise [-180,180]
  return [lng, decl]
}

const wrapLng = (lng: number) => ((((lng + 180) % 360) + 360) % 360) - 180

// Dessine le côté nuit (hémisphère opposé au Soleil, assombri) + une lueur « soleil »
// au point subsolaire, d'après l'heure UTC courante.
function addDayNight(map: MLMap) {
  const [sunLng, sunLat] = subsolarPoint(new Date())
  const antiSun: [number, number] = [wrapLng(sunLng + 180), -sunLat]

  // Hémisphère nuit = disque géodésique de rayon ~90° (¼ de circonférence) autour
  // de l'antipode du Soleil.
  const night = turf.circle(antiSun, 10_018, { steps: 128, units: 'kilometers' })
  if (!map.getSource(NIGHT_SOURCE_ID)) {
    map.addSource(NIGHT_SOURCE_ID, { type: 'geojson', data: night })
    map.addLayer({
      id: NIGHT_FILL_ID,
      type: 'fill',
      source: NIGHT_SOURCE_ID,
      paint: { 'fill-color': '#03060f', 'fill-opacity': 0.55 },
    })
  }

  // Lueur du Soleil : grand cercle flou jaune au point subsolaire.
  if (!map.getSource(SUN_SOURCE_ID)) {
    map.addSource(SUN_SOURCE_ID, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: [sunLng, sunLat] },
      },
    })
    map.addLayer({
      id: SUN_GLOW_ID,
      type: 'circle',
      source: SUN_SOURCE_ID,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 40, 5, 110],
        'circle-color': '#fff3b0',
        'circle-blur': 1,
        'circle-opacity': 0.5,
      },
    })
  }
}

function removeDayNight(map: MLMap) {
  if (map.getLayer(SUN_GLOW_ID)) map.removeLayer(SUN_GLOW_ID)
  if (map.getSource(SUN_SOURCE_ID)) map.removeSource(SUN_SOURCE_ID)
  if (map.getLayer(NIGHT_FILL_ID)) map.removeLayer(NIGHT_FILL_ID)
  if (map.getSource(NIGHT_SOURCE_ID)) map.removeSource(NIGHT_SOURCE_ID)
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

const DEG2RAD = Math.PI / 180
// Durée d'un aller-retour complet (secondes).
const LOOP_DURATION_S = 40
// Durée de l'intro « dessin du tracé » (secondes) : le grand cercle CDG→JFK se
// trace progressivement avant l'apparition de l'avion.
const LINE_DRAW_S = 2.2
// Traveling « décollage → orbite » : la caméra respire le long de la cloche
// d'altitude (apex 0 = aéroports, 1 = apogée croisière).
//   • Aux aéroports : zoom serré + pitch élevé (regard le long de la piste/tracé) +
//     centre sur l'avion → on voit l'avion décoller en suivant la ligne.
//   • À l'apogée : zoom large + pitch redressé + centre rabaissé vers l'hémisphère →
//     vue orbitale du globe. Bearing fixe.
const ZOOM_NEAR = 5.2 // aéroports (gros plan décollage/atterrissage)
const ZOOM_FAR = 3.0 // apogée (vue large orbitale)
const PITCH_NEAR = 66 // aéroports (regard vers l'horizon, le long du tracé)
const PITCH_FAR = 50 // apogée (vue plus en surplomb du globe)
const GLOBE_BEARING = 21
// Latitude de cadrage à l'APOGÉE : on rabaisse le centre sous le tracé (~40-55° N)
// pour cadrer l'hémisphère et non le pôle. Aux aéroports on suit la latitude réelle
// de l'avion (cf. boucle) pour rester sur le décollage.
const FOLLOW_LAT = 28
// Ramp-in : fond le gros plan CDG (état d'entrée) vers le cadrage orbital sur ~4 s,
// piloté par-frame (pas de flyTo séparé → raccord invisible).
const RAMP_MS = 4000
// Lead : la caméra vise un point un peu en avant de l'avion le long de la route
// (fraction de t) → sensation d'anticipation et de mouvement.
const LEAD_T = 0.012

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3)
// Facteur d'apogée ∈ [0,1] le long du demi-trajet (0 aux aéroports, 1 à mi-trajet) —
// partagé par la cloche d'altitude, la respiration caméra et la taille de l'avion.
function apexAt(t: number): number {
  const legFrac = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5
  return Math.sin(Math.PI * legFrac)
}

// Roulis selon la phase de vol : au sol (apex≈0) on prend la gîte décollage si on
// monte (1re moitié de la jambe) ou atterrissage si on descend ; on interpole vers
// la gîte de croisière à mesure qu'on grimpe vers l'apogée (apex→1).
function rollAt(t: number): number {
  const legFrac = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5
  const climbing = legFrac < 0.5
  const { rollTakeoffDeg, rollCruiseDeg, rollLandingDeg, returnRollFlipDeg } = airplaneTuning
  const groundRoll = climbing ? rollTakeoffDeg : rollLandingDeg
  const roll = lerp(groundRoll, rollCruiseDeg, apexAt(t))
  // Jambe retour (t ≥ 0.5) : retourne l'avion pour qu'il ne vole pas sur le dos.
  return t >= 0.5 ? roll + returnRollFlipDeg : roll
}

// Pose (cap + tangage) selon la jambe : aller (t < 0.5) ou retour (t ≥ 0.5).
const isReturnLeg = (t: number) => t >= 0.5
function headingOffsetAt(t: number): number {
  return isReturnLeg(t) ? airplaneTuning.headingOffsetReturnDeg : airplaneTuning.headingOffsetDeg
}
function pitchAt(t: number): number {
  return isReturnLeg(t) ? airplaneTuning.pitchReturnDeg : airplaneTuning.pitchDeg
}

// Vitesse fictive affichée dans le panneau (km/h).
const CRUISE_SPEED_KMH = 880

// Itinéraire (aéroports). Le trajet réel est densifié en grand cercle, aller-retour,
// pour une trajectoire géodésique propre sur le globe.
const CDG: [number, number] = [2.5479, 49.0097] // Paris–Charles de Gaulle
const JFK: [number, number] = [-73.7781, 40.6413] // New York–JFK

// Grand cercle CDG → JFK (géodésique densifiée), dessiné sur la carte.
const FORWARD_COORDS = turf.greatCircle(turf.point(CDG), turf.point(JFK), { npoints: 128 }).geometry
  .coordinates as [number, number][]

// Trajectoire de vol = aller + retour (chemin inverse) → boucle fermée et continue.
const ROUTE: [number, number][] = [...FORWARD_COORDS, ...[...FORWARD_COORDS].reverse().slice(1)]

const ROUTE_COLOR = 0x38bdf8 // cyan ciel (accent « aérien »)

// Longueurs de segments cumulées (en degrés planaires : suffisant pour interpoler
// la fraction le long d'un tracé déjà densifié ; le cap est recalculé localement).
function cumulativeLengths(route: [number, number][]) {
  const segLen: number[] = []
  let total = 0
  for (let i = 0; i < route.length - 1; i++) {
    const dx = route[i + 1][0] - route[i][0]
    const dy = route[i + 1][1] - route[i][1]
    const l = Math.hypot(dx, dy)
    segLen.push(l)
    total += l
  }
  return { segLen, total }
}

// Position + cap au paramètre t∈[0,1] le long de la polyligne densifiée.
function sampleRoute(
  route: [number, number][],
  segLen: number[],
  total: number,
  t: number,
): { lng: number; lat: number; bearingRad: number } {
  const target = t * total
  let acc = 0
  for (let i = 0; i < segLen.length; i++) {
    if (acc + segLen[i] >= target || i === segLen.length - 1) {
      const local = segLen[i] > 0 ? (target - acc) / segLen[i] : 0
      const a = route[i]
      const b = route[i + 1]
      const lng = a[0] + (b[0] - a[0]) * local
      const lat = a[1] + (b[1] - a[1]) * local
      const bearingRad = Math.atan2(b[1] - a[1], b[0] - a[0])
      return { lng, lat, bearingRad }
    }
    acc += segLen[i]
  }
  const a = route[0]
  return { lng: a[0], lat: a[1], bearingRad: 0 }
}

// Altitude en cloche sur chaque demi-trajet : basse aux aéroports (takeoffAltKm),
// pic en croisière (cruiseAltKm) à mi-parcours → décollage puis atterrissage.
function altitudeAt(t: number): number {
  const { takeoffAltKm: lo, cruiseAltKm: hi } = airplaneTuning
  return (lo + (hi - lo) * apexAt(t)) * 1000
}

// Accès à transform.getMatrixForModel (typé sur ITransform, exposé via map.transform).
type ModelTransform = { getMatrixForModel(location: LngLatLike, altitude?: number): number[] }

// État courant de l'avion, écrit par la timeline GSAP et lu par render().
type FlightState = {
  lng: number
  lat: number
  alt: number
  bearingRad: number
  apex: number
  rollDeg: number
  headingOffsetDeg: number
  pitchDeg: number
  reduced: boolean
  // Fraction du tracé déjà dessinée (0 → 1) : pilote l'instanceCount du Line2 pour
  // « tracer » le grand cercle CDG→JFK avant l'apparition de l'avion.
  lineProgress: number
  // L'avion n'est rendu qu'une fois le tracé entièrement dessiné.
  planeVisible: boolean
}

class AirplaneLayer implements CustomLayerInterface {
  readonly id = LAYER_ID
  readonly type = 'custom' as const
  readonly renderingMode: '2d' | '3d' = '3d'

  private map: MLMap | null = null
  private renderer: THREE.WebGLRenderer | null = null
  private scene = new THREE.Scene()
  private camera = new THREE.Camera()
  private model: THREE.Group | null = null
  private maxDim = 1
  private state: FlightState

  private lineScene = new THREE.Scene()
  private lineCamera = new THREE.Camera()
  private line: Line2 | null = null
  private lineMaterial: LineMaterial | null = null
  private lineSegments = 0
  // Matrices de travail réutilisées par frame (la boucle de vol tourne en continu) :
  // matrice de projection principale, matrice de pose, et scratch de rotation.
  private mMain = new THREE.Matrix4()
  private mPose = new THREE.Matrix4()
  private mScratch = new THREE.Matrix4()

  constructor(state: FlightState) {
    this.state = state
  }

  onAdd(map: MLMap, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.map = map

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.4))
    const sun = new THREE.DirectionalLight(0xffffff, 1.1)
    sun.position.set(0, -70, 100)
    this.scene.add(sun)

    // Pas d'`antialias` : le flag n'agit qu'à la création du contexte WebGL, or on
    // réutilise ici celui de MapLibre (déjà créé) → il serait ignoré. L'AA du tracé
    // vient de `alphaToCoverage` sur la Line2.
    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
    })
    this.renderer.autoClear = false

    this.buildRouteLine(map)

    const loader = new GLTFLoader()
    loader.setMeshoptDecoder(MeshoptDecoder)
    loader.load(MODEL_URL, (gltf) => {
      const model = gltf.scene
      // Centrer le modèle sur son origine, pour que les rotations pivotent autour de
      // son centre (pas d'un coin du DCC). L'échelle est appliquée live dans render()
      // depuis airplaneTuning.lengthKm.
      const box = new THREE.Box3().setFromObject(model)
      const size = new THREE.Vector3()
      const center = new THREE.Vector3()
      box.getSize(size)
      box.getCenter(center)
      model.position.sub(center)
      this.maxDim = Math.max(size.x, size.y, size.z) || 1
      const wrapper = new THREE.Group()
      wrapper.add(model)
      this.model = wrapper
      this.scene.add(wrapper)
      this.map?.triggerRepaint()
    })
  }

  // Construit le tracé 3D du grand cercle, EN ALTITUDE (suit la cloche d'altitude de
  // la jambe aller). Fat line (Line2) : épaisseur réelle en pixels — `THREE.Line`
  // ignore `linewidth` sous WebGL. Les sommets sont les positions-monde (4e colonne
  // de getMatrixForModel, invariante à la caméra) ; la projection mainMatrix est
  // appliquée chaque frame via la caméra (cf. render).
  private buildRouteLine(map: MLMap) {
    const transform = (map as unknown as { transform: ModelTransform }).transform
    const n = FORWARD_COORDS.length
    const positions = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      // La jambe aller occupe la première moitié du paramètre de route [0..0.5].
      const t = (i / (n - 1)) * 0.5
      const mm = transform.getMatrixForModel(FORWARD_COORDS[i], altitudeAt(t))
      // w (mm[15]) == 1 pour une matrice modèle affine → on prend xyz directement.
      positions[i * 3] = mm[12]
      positions[i * 3 + 1] = mm[13]
      positions[i * 3 + 2] = mm[14]
    }

    const geometry = new LineGeometry()
    geometry.setPositions(positions)
    this.lineSegments = n - 1
    const cv = map.getCanvas()
    const material = new LineMaterial({
      color: ROUTE_COLOR,
      linewidth: airplaneTuning.lineWidthPx, // pixels (worldUnits: false par défaut)
      transparent: true,
      opacity: 0.9,
      depthTest: true,
      depthWrite: false,
      // Antialiasing du tracé : active le chemin de coverage analytique du shader
      // Line2 (atténuation douce du bord via `fwidth`) au lieu du `discard` net qui
      // produit des bords « en escalier ». Combiné à transparent:true, les bords se
      // fondent par blending même sans MSAA sur le contexte GL de MapLibre.
      alphaToCoverage: true,
    })
    material.resolution.set(cv.width, cv.height)
    const line = new Line2(geometry, material)
    line.frustumCulled = false
    this.line = line
    this.lineMaterial = material
    this.lineScene.add(line)
  }

  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, args: CustomRenderMethodInput) {
    if (!this.renderer || !this.map) return

    // mainMatrix pristine (réutilisée pour projeter le tracé) — calculée tôt car le
    // tracé peut être rendu seul (pendant l'animation de dessin, avion encore caché).
    const mainMatrix = this.mMain.fromArray(args.defaultProjectionData.mainMatrix)

    // Tracé 3D (fat line) : dessin progressif via instanceCount (chaque segment = une
    // instance). Pendant l'intro, lineProgress monte de 0 → 1 et « trace » le grand
    // cercle ; on rend le tracé même quand l'avion est encore caché.
    if (this.line && this.lineMaterial && this.lineSegments > 0) {
      const drawn = Math.max(0, Math.round(this.state.lineProgress * this.lineSegments))
      if (drawn > 0) {
        this.line.geometry.instanceCount = drawn
        this.lineCamera.projectionMatrix.copy(mainMatrix)
        const cv = this.map.getCanvas()
        this.lineMaterial.resolution.set(cv.width, cv.height)
        this.lineMaterial.linewidth = airplaneTuning.lineWidthPx
        this.renderer.resetState()
        this.renderer.render(this.lineScene, this.lineCamera)
      }
    }

    // Avion masqué tant que le tracé n'est pas entièrement dessiné (ou si le modèle
    // glTF n'a pas encore fini de charger).
    if (!this.state.planeVisible || !this.model) {
      if (!this.state.reduced) this.map.triggerRepaint()
      return
    }

    // Matrice de placement (translate + oriente le repère ENU) au point/altitude
    // courants — valable en mercator comme en globe.
    // On rehausse l'avion au-dessus du tracé (qui suit la même cloche d'altitude) :
    // décalage en mètres, indépendant de l'altitude affichée (state.alt / télémétrie).
    const transform = (this.map as unknown as { transform: ModelTransform }).transform
    const modelMatrix = transform.getMatrixForModel(
      [this.state.lng, this.state.lat],
      this.state.alt + airplaneTuning.planeRiseKm * 1000,
    )

    // Échelle live (km → mètres-monde) depuis l'éditeur, modulée par la respiration
    // de taille (plus gros aux aéroports, plus discret à l'apogée).
    const sizeMul = lerp(airplaneTuning.scaleNearMul, airplaneTuning.scaleFarMul, this.state.apex)
    const k = (airplaneTuning.lengthKm * 1000 * sizeMul) / this.maxDim
    this.model.scale.setScalar(k)

    // Orientation : cap (autour de l'up local) · tangage · roulis.
    const heading = this.state.bearingRad + this.state.headingOffsetDeg * DEG2RAD
    const sc = this.mScratch
    const l = this.mPose
      .fromArray(modelMatrix)
      .multiply(sc.makeRotationZ(heading))
      .multiply(sc.makeRotationX(this.state.pitchDeg * DEG2RAD))
      .multiply(sc.makeRotationY(this.state.rollDeg * DEG2RAD))

    // Projection de l'avion : mainMatrix composée avec la matrice de pose, écrite
    // directement dans la matrice de la caméra (pas de clone → pas d'alloc/frame).
    this.camera.projectionMatrix.copy(mainMatrix).multiply(l)

    this.renderer.resetState()
    this.renderer.render(this.scene, this.camera)

    if (!this.state.reduced) this.map.triggerRepaint()
  }

  onRemove(_map: MLMap) {
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (mesh.isMesh) {
        mesh.geometry?.dispose()
        const mat = mesh.material
        if (Array.isArray(mat)) mat.forEach((mm) => mm.dispose())
        else mat?.dispose()
      }
    })
    if (this.line) {
      this.line.geometry.dispose()
      ;(this.line.material as THREE.Material).dispose()
      this.line = null
    }
    this.lineMaterial = null
    this.renderer?.dispose()
    this.renderer = null
    this.model = null
    this.map = null
  }
}

export function addAirplane3D(map: MLMap): AirplaneHandle {
  if (map.getLayer(LAYER_ID)) return { detach: () => removeAirplane3D(map) }

  // Bascule en projection globe : l'animation de dézoom (pan du step) la fait
  // « s'enrouler » en sphère.
  map.setProjection({ type: 'globe' })

  // Fond « espace » étoilé (conteneur) + halo d'atmosphère + terminateur jour/nuit.
  setSpaceBackground(map, true)
  map.setSky(SPACE_SKY as unknown as Parameters<MLMap['setSky']>[0])
  addDayNight(map)

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const { segLen, total } = cumulativeLengths(ROUTE)
  const start = sampleRoute(ROUTE, segLen, total, 0)
  const state: FlightState = {
    lng: start.lng,
    lat: start.lat,
    alt: altitudeAt(0),
    bearingRad: start.bearingRad,
    apex: apexAt(0),
    rollDeg: rollAt(0),
    headingOffsetDeg: headingOffsetAt(0),
    pitchDeg: pitchAt(0),
    reduced,
    lineProgress: 0,
    planeVisible: false,
  }

  map.addLayer(new AirplaneLayer(state))
  useMapDataStore.getState().setFlightStats({
    altitudeM: state.alt,
    speedKmh: CRUISE_SPEED_KMH,
    headingDeg: 0,
  })

  // En reduced-motion : pas de boucle ni de traveling, on pose directement une vue
  // orbitale « moyenne » et statique.
  if (reduced) {
    state.lineProgress = 1
    state.planeVisible = true
    map.jumpTo({
      center: [start.lng, FOLLOW_LAT],
      zoom: ZOOM_FAR,
      pitch: (PITCH_NEAR + PITCH_FAR) / 2,
      bearing: GLOBE_BEARING,
    })
    map.triggerRepaint()
    return { detach: () => removeAirplane3D(map) }
  }

  // Vue d'ensemble (overview) pendant le dessin du tracé : on s'écarte vers le
  // milieu de l'arc CDG↔JFK pour voir le grand cercle se tracer en entier, avant
  // que l'avion n'apparaisse à Paris et n'amorce son décollage.
  const arcMid = FORWARD_COORDS[Math.floor(FORWARD_COORDS.length / 2)]
  const OVERVIEW = { lng: arcMid[0], lat: arcMid[1] + 12, zoom: 2.3, pitch: 38 }

  // État caméra d'entrée (gros plan CDG posé par le tour) : point de départ de
  // l'intro. `entry`/`startMs` du vol sont (re)capturés à la fin de l'intro pour que
  // le ramp-in de la boucle reparte du cadrage overview (raccord invisible).
  const introStart = {
    lng: map.getCenter().lng,
    lat: map.getCenter().lat,
    zoom: map.getZoom(),
    pitch: map.getPitch(),
  }
  let entry = { ...introStart }
  let startMs = performance.now()

  // Boucle de vol : { t } animé linéairement en boucle. À chaque frame on
  // ré-échantillonne position/cap/altitude ET on pilote la caméra directement
  // depuis le même clock (center/zoom/pitch), pour un suivi parfaitement continu.
  const progress = { t: 0 }
  const flight = gsap.timeline({ repeat: -1, paused: true })

  // Intro : dessin progressif du tracé (lineProgress 0→1, eased) tout en s'écartant
  // vers l'overview. À la fin, on révèle l'avion, on recapture l'état caméra courant
  // comme point de départ du ramp-in, puis on lance la boucle de vol.
  const drawn = { p: 0 }
  const intro = gsap.timeline()
  intro.to(drawn, {
    p: 1,
    duration: LINE_DRAW_S,
    ease: 'power2.inOut',
    onUpdate() {
      state.lineProgress = drawn.p
      const e = easeOutCubic(drawn.p)
      map.jumpTo({
        center: [lerp(introStart.lng, OVERVIEW.lng, e), lerp(introStart.lat, OVERVIEW.lat, e)],
        zoom: lerp(introStart.zoom, OVERVIEW.zoom, e),
        pitch: lerp(introStart.pitch, OVERVIEW.pitch, e),
        bearing: GLOBE_BEARING,
      })
      map.triggerRepaint()
    },
    onComplete() {
      state.lineProgress = 1
      state.planeVisible = true
      const c = map.getCenter()
      entry = { lng: c.lng, lat: c.lat, zoom: map.getZoom(), pitch: map.getPitch() }
      startMs = performance.now()
      flight.play()
    },
  })

  {
    flight.to(progress, {
      t: 1,
      duration: LOOP_DURATION_S,
      ease: 'none',
      onUpdate() {
        const s = sampleRoute(ROUTE, segLen, total, progress.t)
        const a = apexAt(progress.t)
        state.lng = s.lng
        state.lat = s.lat
        state.alt = altitudeAt(progress.t)
        state.bearingRad = s.bearingRad
        state.apex = a
        state.rollDeg = rollAt(progress.t)
        state.headingOffsetDeg = headingOffsetAt(progress.t)
        state.pitchDeg = pitchAt(progress.t)

        // Traveling « décollage → orbite » : zoom & pitch suivent la cloche d'apogée.
        const zoom = lerp(ZOOM_NEAR, ZOOM_FAR, a)
        const pitch = lerp(PITCH_NEAR, PITCH_FAR, a)
        // Lead : on vise un point un peu en avant de l'avion le long de la route.
        const lead = sampleRoute(ROUTE, segLen, total, Math.min(progress.t + LEAD_T, 1))
        // Centre : on suit la latitude réelle de l'avion près du sol (apex≈0) pour
        // voir le décollage le long du tracé, puis on rabaisse vers FOLLOW_LAT à
        // l'apogée pour le cadrage orbital de l'hémisphère.
        const followLat = lerp(lead.lat, FOLLOW_LAT, a)
        // Ramp-in : fondu de l'état d'entrée (gros plan CDG posé par le tour) vers le
        // cadrage de suivi, sur les premières secondes (raccord invisible).
        const ramp = easeOutCubic(clamp01((performance.now() - startMs) / RAMP_MS))
        map.jumpTo({
          center: [lerp(entry.lng, lead.lng, ramp), lerp(entry.lat, followLat, ramp)],
          zoom: lerp(entry.zoom, zoom, ramp),
          pitch: lerp(entry.pitch, pitch, ramp),
          bearing: GLOBE_BEARING,
        })

        const headingDeg = (90 - (s.bearingRad * 180) / Math.PI + 360) % 360
        useMapDataStore.getState().setFlightStats({
          altitudeM: Math.round(state.alt),
          speedKmh: CRUISE_SPEED_KMH,
          headingDeg: Math.round(headingDeg),
        })
        map.triggerRepaint()
      },
    })
  }

  return {
    detach: () => {
      intro.kill()
      flight.kill()
      removeAirplane3D(map)
    },
  }
}

export function removeAirplane3D(map: MLMap) {
  if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID) // déclenche onRemove → libère le GL
  removeDayNight(map)
  setSpaceBackground(map, false)
  // Retour à la projection mercator + ciel par défaut pour les steps suivants.
  map.setProjection({ type: 'mercator' })
  ;(map.setSky as (sky?: unknown) => void)()
  useMapDataStore.getState().setFlightStats(null)
}
