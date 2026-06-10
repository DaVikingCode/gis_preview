import type {
  CustomLayerInterface,
  CustomRenderMethodInput,
  LngLatLike,
  Map as MLMap,
} from 'maplibre-gl'
import * as THREE from 'three'
import { useMapDataStore, type PointCloudStats } from '@/store/map-data-store'
import { usePreloadStore } from '@/store/preload-store'

// -----------------------------------------------------------------------------
// Nuage de points LiDAR — couche WebGL personnalisée (three.js dans le contexte GL
// de MapLibre), même mécanique que `airplane3d.ts`.
//
// Step « Nuage de points · LiDAR » : scan LiDAR d'Auxonne (France, ~4,7 M points,
// CRS UTM 31N) rendu PAR-DESSUS le fond de plan, posé au sol à son emplacement réel.
// Le binaire est pré-cuit hors-ligne (cf. scripts/prebake-pointcloud.mjs →
// auxonne.points.bin/.json) :
//   layout = [Int16 positions·3 (cm, recentré sur le centre de l'emprise, sol à 0)]
//            ‖ [Uint8 RGB·3 (vraie couleur)] ‖ [Uint8 classification·1 (classe ASPRS)]
// Les points sont TRIÉS PAR CELLULE spatiale (~60 m, sud→nord) et mélangés À L'INTÉRIEUR
// de chaque cellule (meta.cells = ranges contigus + bbox) → un THREE.Points par cellule :
// frustum culling par cellule + budget de densité par zoom (tout préfixe du drawRange
// d'une cellule est un sous-échantillon spatialement uniforme de la cellule).
//
// Repère des positions (coords brutes, mètres) : X est, Y nord, Z hauteur.
//
// 3 colorisations, sélectionnables et animées par un « scan » qui balaie l'axe nord :
//   0 = altitude (rampe turbo), 1 = RGB (vraie couleur), 2 = classification (palette).
// L'état `pointCloudView` (mix de scan) et `pointCloudTuning` (orientation/échelle)
// sont relus par render() à chaque frame. La chorégraphie vit dans
// `usePointCloudChoreography` (hook), montée par `PointCloudDirector`.
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

const LAYER_ID = 'gp-pointcloud'

// Emplacement réel du scan : centre de l'emprise UTM31N → WGS84 (Auxonne, France).
// Émis par le prebake (champ anchorLngLat) ; partagé avec le step (caméra centrée ici).
export const POINTCLOUD_ANCHOR: [number, number] = [5.392126, 47.202674]

// Le binaire (~45 Mo bruts) dépasse la limite de 25 Mio/fichier de Cloudflare Pages : il
// est pré-tranché en chunks committés dans `public/pointcloud/` (cf.
// scripts/split-pointcloud.mjs, chunks gzippés) et ré-assemblé ici. Le `.json`
// (~2 Ko) est servi depuis `public/` lui aussi : `new URL(import.meta.url)` sur un
// `.json` n'était pas émis dans le build de prod (404 → nuage vide en ligne).
// Version du jeu de données : sert à la fois de préfixe de chunks (c3-*.bin) et de
// cache-buster sur les JSON. Un ancien `manifest.json` (forme `chunks:string[]`) traîne
// dans le cache HTTP des navigateurs ayant déjà visité → le `?v=` force une URL neuve,
// jamais servie depuis ce cache périmé. Bumper à chaque changement de layout.
const PC_VERSION = 3
const MANIFEST_URL = `${import.meta.env.BASE_URL}pointcloud/manifest.json?v=${PC_VERSION}`
const META_URL = `${import.meta.env.BASE_URL}pointcloud/auxonne.points.json?v=${PC_VERSION}`

const PC_BASE = `${import.meta.env.BASE_URL}pointcloud/`

// Cache Storage persistant (survit aux sessions, plus robuste à l'éviction que le
// disk cache HTTP). Bumper la version si le nuage est re-cuit avec les MÊMES noms de
// fichiers (sinon les anciens chunks resteraient servis). Couplé à _headers
// (Cache-Control immutable) côté Cloudflare : ceinture + bretelles.
const PC_CACHE = 'gp-pointcloud-v3'

async function openPcCache(): Promise<Cache | null> {
  try {
    if (typeof caches === 'undefined') return null
    return await caches.open(PC_CACHE)
  } catch {
    return null
  }
}

// JSON (manifest/meta, ~2 Ko) : on NE met PAS en Cache Storage et on revalide
// (`no-cache`) — ces fichiers doivent rester frais (un manifest périmé casserait le
// décodage des chunks). Le poids est négligeable.
async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-cache' })
  return res.json() as Promise<T>
}

// Fetchs en cours, partagés entre prefetchPointCloud et load() : arriver au step LiDAR
// PENDANT le prefetch réutilise les promesses en vol au lieu de re-télécharger les mêmes
// chunks en double. Entrée retirée une fois réglée (succès → Cache Storage peuplé ;
// échec → un appel ultérieur retente à neuf).
const inflight = new Map<string, Promise<ArrayBuffer>>()

// Récupère une URL en privilégiant le Cache Storage (persistant entre visites). La
// réponse réseau est stockée pour les fois suivantes ; échec de mise en cache silencieux.
// `priority: 'low'` sur le prefetch : ne concurrence pas le prewarm des tuiles.
function fetchPersistent(url: string, cache: Cache | null, priority?: 'low'): Promise<ArrayBuffer> {
  const pending = inflight.get(url)
  if (pending) return pending
  const p = (async () => {
    const hit = cache ? await cache.match(url).catch(() => undefined) : undefined
    if (hit) return hit.arrayBuffer()
    const res = await fetch(url, { cache: 'force-cache', priority })
    // Cloner AVANT de lire le corps : on stocke la réponse réseau telle quelle (en-têtes
    // Content-Length/Type préservés → taille correcte en DevTools) et on lit l'autre moitié.
    if (cache) await cache.put(url, res.clone()).catch(() => {})
    return res.arrayBuffer()
  })()
  inflight.set(url, p)
  void p.catch(() => {}).finally(() => inflight.delete(url))
  return p
}

// Décompression gzip native (chunks pré-compressés au split, cf. split-pointcloud.mjs —
// Cloudflare ne compresse pas l'octet-stream). Support universel depuis 2023.
async function gunzip(buf: ArrayBuffer): Promise<ArrayBuffer> {
  const body = new Response(buf).body
  if (!body) throw new Error('gunzip: corps de réponse indisponible')
  return new Response(body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
}

// Préchargement du nuage (~32 Mo gzippés) dès l'écran d'accueil : téléchargement en
// tâche de fond pendant que l'utilisateur lit le splash, stocké en Cache Storage. Au
// step LiDAR `load()` (mêmes URLs, même helper) tape le cache → rendu quasi instantané.
// Best-effort : tout échec est silencieux.
// Octets par point DÉCOMPRESSÉS : Int16×3 (positions) + Uint8×3 (RGB) + Uint8 (classe).
// Fallback du loader si un vieux manifest n'a pas `bytes`.
const PC_BYTES_PER_POINT = 10

let prefetched = false
export function prefetchPointCloud() {
  if (prefetched) return
  prefetched = true
  const pl = usePreloadStore.getState()
  const run = async () => {
    const cache = await openPcCache()
    try {
      const manifest = await fetchJson<{
        chunks: { name: string; count: number; bytes?: number }[]
      }>(MANIFEST_URL)
      // Poids réseau réel (gzippé) connu via le manifest → dénominateur exact du loader.
      const weight = (c: { count: number; bytes?: number }) =>
        c.bytes ?? c.count * PC_BYTES_PER_POINT
      for (const c of manifest.chunks) pl.addTotal(weight(c))
      pl.markReady()
      // Tous les chunks démarrent ensemble (Promise.all) dès que le manifest est lu ;
      // chaque chunk terminé (succès OU échec) crédite sa part au loader.
      await Promise.all(
        manifest.chunks.map((c) =>
          fetchPersistent(PC_BASE + c.name, cache, 'low')
            .catch(() => {})
            .finally(() => pl.addLoaded(weight(c))),
        ),
      )
    } catch {
      // silencieux : le prefetch est best-effort. markReady ici aussi pour que le gate
      // ne reste pas bloqué si le manifest est injoignable.
      pl.markReady()
    }
  }
  if ('requestIdleCallback' in window)
    window.requestIdleCallback(() => void run(), { timeout: 1500 })
  else setTimeout(() => void run(), 300)
}

const DEG2RAD = Math.PI / 180

// Modes de colorisation (valeurs numériques lues par le shader).
export const MODE = { altitude: 0, rgb: 1, classification: 2 } as const
export type ModeNum = (typeof MODE)[keyof typeof MODE]

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

// Accès à transform.getMatrixForModel (typé sur ITransform, exposé via map.transform).
type ModelTransform = { getMatrixForModel(location: LngLatLike, altitude?: number): number[] }

type MaterialUniforms = {
  uMaxZ: { value: number }
  uModeFrom: { value: number }
  uModeTo: { value: number }
  uScan: { value: number }
  uScanWidth: { value: number }
  uScanGlow: { value: number }
  uReveal: { value: number }
}

class PointCloudLayer implements CustomLayerInterface {
  readonly id = LAYER_ID
  readonly type = 'custom' as const
  readonly renderingMode: '2d' | '3d' = '3d'

  private map: MLMap | null = null
  private renderer: THREE.WebGLRenderer | null = null
  private scene = new THREE.Scene()
  private camera = new THREE.Camera()
  // Un THREE.Points PAR CELLULE spatiale (meta.cells) : géométries distinctes (drawRange
  // + boundingSphere propres → frustum culling par cellule) mais BufferAttribute
  // PARTAGÉS (un seul VBO côté GPU) et matériau partagé (un seul programme).
  private cells: { points: THREE.Points; offset: number; count: number }[] = []
  private material: THREE.PointsMaterial | null = null
  private totalCount = 0
  private densityF = 1 // facteur LOD appliqué (recalculé à chaque frame depuis le zoom)
  private uniforms: MaterialUniforms | null = null
  private lastMatrix: THREE.Matrix4 | null = null // matrice composée de la dernière frame (project)
  // Matrices/vecteur de travail réutilisés à chaque frame (évite la pression GC sur
  // l'orbit continu) : composition de la matrice et projection des POI.
  private mMain = new THREE.Matrix4()
  private mLocal = new THREE.Matrix4()
  private mScratch = new THREE.Matrix4()
  private vProject = new THREE.Vector4()
  private cancelled = false
  // Streaming : points effectivement uploadés (étendu à chaque chunk) vs nombre que la
  // chorégraphie demande à révéler. Le draw range dessiné = min des deux → « reveal suit
  // le chargement » : les chunks tardifs se densifient derrière le front de scan.
  private loadedCount = 0
  private revealRequested = 0

  readonly ready: Promise<{ count: number }>
  private resolveReady!: (v: { count: number }) => void

  constructor() {
    this.ready = new Promise((res) => {
      this.resolveReady = res
    })
  }

  onAdd(map: MLMap, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.map = map
    // Pas d'`antialias` : le flag n'agit qu'à la création du contexte WebGL, or on
    // réutilise ici celui de MapLibre (déjà créé) → il serait ignoré.
    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
    })
    this.renderer.autoClear = false
    // Nos couleurs (RGB, rampe, palette) sont déjà en sRGB : on écrit les octets tels
    // quels (comme MapLibre), sans ré-encodage sRGB qui délaverait le rendu.
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    void this.load()
  }

  private async load() {
    try {
      // Cache Storage seulement pour les gros chunks (.bin). meta/manifest via fetchJson
      // (revalidés, jamais périmés). Si le prefetch du StartScreen a peuplé le cache, les
      // chunks sont instantanés.
      const cache = await openPcCache()
      const [meta, manifest] = await Promise.all([
        fetchJson<
          PointCloudStats & {
            posScale: number
            classes: { code: number; count: number }[]
            // Ranges contigus par cellule spatiale (tri au prebake) ; bbox en mètres
            // locaux [minE,minN,minZ,maxE,maxN,maxZ] → boundingSphere de culling.
            cells?: { offset: number; count: number; bbox: number[] }[]
            linePath?: [number, number][]
            dangerPois?: {
              veg: [number, number, number]
              cond: [number, number, number]
              clearanceM: number
            }[]
          }
        >(META_URL),
        // Chunks SELF-CONTAINED point-alignés et gzippés (cf. scripts/split-pointcloud.mjs).
        // Manifest : { version, count, encoding, chunks:[{name,count,bytes}] }.
        fetchJson<{
          version: number
          count: number
          encoding?: string
          chunks: { name: string; count: number; bytes?: number }[]
        }>(MANIFEST_URL),
      ])
      if (manifest.encoding !== 'gzip-planes-v1') {
        throw new Error(`encodage de manifest inattendu : ${manifest.encoding}`)
      }

      const count = meta.count
      const s = meta.posScale
      this.totalCount = count

      // Géométrie pré-allouée pour TOUT le nuage, remplie au fil des chunks. Les vues
      // typées restent référencées par les BufferAttribute → on écrit dedans + upload
      // GPU partiel (addUpdateRange) à chaque chunk.
      // Positions gardées en Int16 BRUT (cm) côté GPU — moitié moins de mémoire qu'un
      // Float32 (~28 Mo vs ~57 Mo pour 4,7 M pts) ET aucune boucle de dé-quant JS sur
      // le main-thread : le shader multiplie par `uPosScale` (cm→m) au vertex.
      const positions = new Int16Array(count * 3)
      const rgbU8 = new Uint8Array(count * 3)
      const clsU8 = new Uint8Array(count)

      const posAttr = new THREE.BufferAttribute(positions, 3) // Int16 non normalisé → float brut au shader
      const colAttr = new THREE.BufferAttribute(rgbU8, 3, true)
      const clsAttr = new THREE.BufferAttribute(clsU8, 1, false)

      const material = new THREE.PointsMaterial({
        size: pointCloudTuning.pointSizePx,
        sizeAttenuation: false,
        vertexColors: true,
      })
      const maxZ = meta.zRangeM[1] || 1
      material.onBeforeCompile = (shader) => {
        shader.uniforms.uPosScale = { value: s } // cm (Int16 brut) → mètres
        shader.uniforms.uMaxZ = { value: maxZ }
        shader.uniforms.uModeFrom = { value: pointCloudView.modeFrom }
        shader.uniforms.uModeTo = { value: pointCloudView.modeTo }
        shader.uniforms.uScan = { value: pointCloudView.scan }
        shader.uniforms.uScanWidth = { value: pointCloudView.scanWidth }
        shader.uniforms.uScanGlow = { value: pointCloudView.scanGlow }
        shader.uniforms.uReveal = { value: pointCloudView.reveal }
        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            '#include <common>\nattribute float aClass;\nuniform float uPosScale;\nvarying float vClass;\nvarying float vUp;\nvarying float vScanCoord;',
          )
          .replace(
            // `position` est en cm (Int16 brut) → on remet `transformed` à l'échelle
            // mètres pour la projection, et on exporte les varyings en mètres (vUp et
            // vScanCoord sont comparés à uMaxZ / uScan, exprimés en mètres).
            '#include <begin_vertex>',
            '#include <begin_vertex>\n  transformed *= uPosScale;\n  vClass = aClass;\n  vUp = position.z * uPosScale;\n  vScanCoord = position.y * uPosScale;',
          )
        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            `#include <common>
            varying float vClass;
            varying float vUp;
            varying float vScanCoord;
            uniform float uMaxZ;
            uniform float uModeFrom;
            uniform float uModeTo;
            uniform float uScan;
            uniform float uScanWidth;
            uniform float uScanGlow;
            uniform float uReveal;
            vec3 pcTurbo(float t){
              t = clamp(t, 0.0, 1.0);
              vec3 c0 = vec3(0.188,0.071,0.510);
              vec3 c1 = vec3(0.114,0.620,0.765);
              vec3 c2 = vec3(0.365,0.788,0.388);
              vec3 c3 = vec3(0.941,0.667,0.184);
              vec3 c4 = vec3(0.910,0.353,0.275);
              float x = t * 4.0;
              if (x < 1.0) return mix(c0,c1,x);
              if (x < 2.0) return mix(c1,c2,x-1.0);
              if (x < 3.0) return mix(c2,c3,x-2.0);
              return mix(c3,c4,x-3.0);
            }
            vec3 pcClass(float c){
              // Schéma Enedis élagage (cf. CLASS_INFO) — garder synchronisé.
              if (c < 2.5) return vec3(0.60,0.46,0.33);            // sol
              if (c < 3.5) return vec3(0.62,0.80,0.40);            // vég. basse
              if (c < 4.5) return vec3(0.40,0.68,0.32);            // vég. moyenne
              if (c < 5.5) return vec3(0.18,0.45,0.22);            // vég. haute
              if (c > 23.5 && c < 24.5) return vec3(0.95,0.12,0.12); // ligne élec (rouge)
              if (c > 24.5 && c < 25.5) return vec3(0.769,0.0,0.769); // U0 magenta
              if (c > 25.5 && c < 26.5) return vec3(1.0,0.149,0.149); // U1 rouge
              if (c > 26.5 && c < 27.5) return vec3(1.0,1.0,0.0);     // U2 jaune
              if (c > 27.5 && c < 28.5) return vec3(0.624,1.0,1.0);   // U3 cyan
              if (c > 28.5 && c < 29.5) return vec3(0.059,0.529,1.0); // U4 bleu
              return vec3(0.55,0.55,0.60);                         // autre
            }
            vec3 pcColorFor(float mode, vec3 rgb){
              if (mode < 0.5) return pcTurbo(vUp / uMaxZ);
              if (mode < 1.5) return rgb;
              return pcClass(vClass);
            }`,
          )
          .replace(
            '#include <color_fragment>',
            `#include <color_fragment>
            float pcT = clamp((uScan - vScanCoord) / uScanWidth + 0.5, 0.0, 1.0);
            // Apparition par scan : les points devant le front (pcT < 0.5) ne sont pas
            // encore « matérialisés » → on les jette tant que reveal est actif.
            if (uReveal > 0.5 && pcT < 0.5) discard;
            diffuseColor.rgb = mix(pcColorFor(uModeFrom, diffuseColor.rgb), pcColorFor(uModeTo, diffuseColor.rgb), pcT);
            // Glow du front, en deux couches additives pilotées par uScanGlow :
            //   • halo doux et large (subtil) ;
            //   • crête fine et nette au front exact (effet WOW qui file devant le balayage).
            float pcDist = abs(vScanCoord - uScan);
            float pcHalo = (1.0 - smoothstep(0.0, uScanWidth * 0.9, pcDist)) * uScanGlow;
            float pcCrest = (1.0 - smoothstep(0.0, uScanWidth * 0.12, pcDist)) * uScanGlow;
            diffuseColor.rgb += pcHalo * 0.45 * vec3(0.30, 0.70, 0.85);
            diffuseColor.rgb += pcCrest * 0.60 * vec3(0.70, 0.95, 1.0);`,
          )
        this.uniforms = shader.uniforms as unknown as MaterialUniforms
      }
      this.material = material

      // Une géométrie + un Points par cellule : drawRange = range contigu de la cellule,
      // boundingSphere depuis la bbox du meta — en MÈTRES, l'espace que la matrice
      // composée attend (les attributs sont en cm mais le shader rescale via uPosScale ;
      // le culling CPU ne lit jamais les attributs quand la sphère est fournie).
      // Fallback (meta sans `cells`) : une cellule unique non culled.
      const cellsMeta =
        meta.cells && meta.cells.length > 0 ? meta.cells : [{ offset: 0, count, bbox: null }]
      for (const [ci, c] of cellsMeta.entries()) {
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', posAttr)
        geometry.setAttribute('color', colAttr) // RGB vraie couleur → vColor
        geometry.setAttribute('aClass', clsAttr) // octet brut → float (non normalisé)
        geometry.setDrawRange(c.offset, 0)
        const points = new THREE.Points(geometry, material)
        // La PREMIÈRE cellule n'est JAMAIS culled : three n'uploade les VBO et ne compile
        // le programme que pour les objets qui passent le frustum test, or la couche est
        // préchauffée depuis le step PRÉCÉDENT (caméra ailleurs → tout serait culled, et
        // upload + compile arriveraient en un freeze à l'arrivée du step LiDAR). Les
        // attributs étant partagés, un seul objet visible suffit à tout préchauffer ;
        // son drawRange vaut 0 hors du step → coût nul.
        if (c.bbox && ci > 0) {
          const [x0, y0, z0, x1, y1, z1] = c.bbox
          const center = new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
          const radius = Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2
          geometry.boundingSphere = new THREE.Sphere(center, radius)
          points.frustumCulled = true
        } else {
          points.frustumCulled = false
        }
        this.cells.push({ points, offset: c.offset, count: c.count })
        this.scene.add(points)
      }

      useMapDataStore.getState().setPointCloudStats({
        count: meta.count,
        footprintM: meta.footprintM,
        zRangeM: meta.zRangeM,
      })
      useMapDataStore.getState().setPointCloudClasses(meta.classes ?? [])
      useMapDataStore.getState().setPointCloudLinePath(meta.linePath ?? [])
      useMapDataStore.getState().setPointCloudDangerPois(meta.dangerPois ?? [])

      // Téléchargement parallèle, application ORDONNÉE : tous les fetch (+ décompression
      // gzip, en parallèle aussi) partent ensemble, mais on applique chunk i dans l'ordre
      // pour étendre un draw range contigu. Premier chunk → resolveReady (la chorégraphie
      // démarre). Les cellules étant triées sud→nord, le streaming suit le front de scan.
      const promises = manifest.chunks.map((c) =>
        fetchPersistent(PC_BASE + c.name, cache).then(gunzip),
      )
      for (let i = 0; i < manifest.chunks.length; i++) {
        const cBuf = await promises[i]
        if (this.cancelled) return
        const cN = manifest.chunks[i].count
        const bytes = new Uint8Array(cBuf)
        const base = this.loadedCount
        // Bloc positions en BYTE-PLANES [xLo·n‖xHi·n‖yLo·n‖yHi·n‖zLo·n‖zHi·n] (cf.
        // split-pointcloud.mjs) : refusion lo|hi<<8 → Int16 (cm). L'affectation à un
        // Int16Array applique ToInt16 (wrap signé correct). Le shader rescale via
        // `uPosScale` (cm→m) au vertex.
        for (let c = 0; c < 3; c++) {
          const lo = c * 2 * cN
          const hi = lo + cN
          for (let p = 0; p < cN; p++) {
            positions[(base + p) * 3 + c] = bytes[lo + p] | (bytes[hi + p] << 8)
          }
        }
        rgbU8.set(bytes.subarray(cN * 6, cN * 9), base * 3)
        clsU8.set(bytes.subarray(cN * 9, cN * 10), base)
        // Upload GPU partiel : seule la région ajoutée (évite de ré-uploader tout).
        posAttr.addUpdateRange(base * 3, cN * 3)
        posAttr.needsUpdate = true
        colAttr.addUpdateRange(base * 3, cN * 3)
        colAttr.needsUpdate = true
        clsAttr.addUpdateRange(base, cN)
        clsAttr.needsUpdate = true

        this.loadedCount = base + cN
        this.applyDraw()
        if (i === 0) this.resolveReady({ count })
      }
      // Sécurité : si 0 chunk (manifest vide), résoudre tout de même.
      if (manifest.chunks.length === 0) this.resolveReady({ count })
    } catch (err) {
      console.error('[pointCloud] échec du chargement', err)
      this.resolveReady({ count: 0 })
    }
  }

  setReveal(n: number) {
    this.revealRequested = Math.max(0, n)
    this.applyDraw()
  }

  // Draw range PAR CELLULE = min(part chargée de la cellule, budget) avec budget =
  // count · reveal01 · densityF (reveal01 = part demandée par la chorégraphie, densityF
  // = facteur LOD par zoom). Cellules contiguës dans l'ordre du binaire → la part chargée
  // d'une cellule se déduit du loadedCount global. Appelé par setReveal, à chaque chunk
  // (les points tardifs étendent le rendu derrière le front de scan) et quand le facteur
  // LOD change (depuis render(), sans triggerRepaint : la frame est déjà en cours).
  private applyDraw(repaint = true) {
    if (this.cells.length === 0) return
    const reveal01 = this.totalCount > 0 ? Math.min(1, this.revealRequested / this.totalCount) : 0
    for (const c of this.cells) {
      const loaded = Math.min(Math.max(this.loadedCount - c.offset, 0), c.count)
      const want = Math.round(c.count * reveal01 * this.densityF)
      c.points.geometry.setDrawRange(c.offset, Math.min(loaded, want))
    }
    if (repaint) this.map?.triggerRepaint()
  }

  project(p: [number, number, number]): { x: number; y: number; visible: boolean } | null {
    if (!this.lastMatrix || !this.map) return null
    const v = this.vProject.set(p[0], p[1], p[2], 1).applyMatrix4(this.lastMatrix)
    const canvas = this.map.getCanvas()
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (v.w <= 1e-6) return { x: 0, y: 0, visible: false }
    const ndcX = v.x / v.w
    const ndcY = v.y / v.w
    const x = (ndcX * 0.5 + 0.5) * w
    const y = (1 - (ndcY * 0.5 + 0.5)) * h
    const visible = ndcX >= -1.1 && ndcX <= 1.1 && ndcY >= -1.1 && ndcY <= 1.1
    return { x, y, visible }
  }

  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, args: CustomRenderMethodInput) {
    if (!this.renderer || !this.map || this.cells.length === 0) return

    const mainMatrix = this.mMain.fromArray(args.defaultProjectionData.mainMatrix)
    const transform = (this.map as unknown as { transform: ModelTransform }).transform
    const t = pointCloudTuning
    const s = t.scale
    const sc = this.mScratch
    const l = this.mLocal
      .fromArray(transform.getMatrixForModel(POINTCLOUD_ANCHOR, t.altitudeM))
      // Décalage horizontal dans le repère ENU (X est, Y nord) avant rotations.
      .multiply(sc.makeTranslation(t.offsetEast, t.offsetNorth, 0))
      .multiply(sc.makeRotationZ(t.bearingDeg * DEG2RAD))
      .multiply(sc.makeRotationX(t.pitchDeg * DEG2RAD))
      .multiply(sc.makeRotationY(t.rollDeg * DEG2RAD))
      .multiply(sc.makeScale(s, s, s))
    const composed = mainMatrix.multiply(l)
    this.camera.projectionMatrix = composed
    this.lastMatrix = composed // mémorisée pour project() (overlay POI)
    if (this.material) this.material.size = t.pointSizePx

    // Budget de densité (LOD) recalculé depuis le zoom courant — voir pointCloudTuning.
    const zoom = this.map.getZoom()
    const f = Math.min(1, Math.max(t.lodFloor, Math.pow(4, zoom - t.lodFullZoom)))
    if (f !== this.densityF) {
      this.densityF = f
      this.applyDraw(false)
    }

    if (this.uniforms) {
      const v = pointCloudView
      this.uniforms.uModeFrom.value = v.modeFrom
      this.uniforms.uModeTo.value = v.modeTo
      this.uniforms.uScan.value = v.scan
      this.uniforms.uScanWidth.value = v.scanWidth
      this.uniforms.uScanGlow.value = v.scanGlow
      this.uniforms.uReveal.value = v.reveal
    }

    this.renderer.resetState()
    this.renderer.render(this.scene, this.camera)
  }

  onRemove(_map: MLMap) {
    this.cancelled = true
    // Attributs partagés entre les géométries de cellules : disposer chaque géométrie
    // libère les VBO — teardown global, plus aucun rendu ensuite.
    for (const c of this.cells) c.points.geometry.dispose()
    this.cells = []
    this.material?.dispose()
    this.material = null
    this.uniforms = null
    this.lastMatrix = null
    this.renderer?.dispose()
    this.renderer = null
    this.map = null
  }
}

// Couche préchauffée (créée au step PRÉCÉDENT pour que load() — lecture cache, décodage,
// upload GPU, compile shader — tourne avant le step LiDAR → arrivée sans freeze).
let prewarmed: { map: MLMap; handle: PointCloudHandle } | null = null

// Crée la couche (déclenche onAdd → load()) sans rien pousser dans le store : la
// chorégraphie ne démarre QU'avec pointCloudHandle + pointCloudRun (cf. step 7), donc
// la couche reste invisible (drawRange 0) jusqu'à son adoption. Singleton : réappels
// (re-entrée step, 5↔6) renvoient la même instance.
export function prewarmPointCloud(map: MLMap): PointCloudHandle {
  // Réutilise SEULEMENT si la couche existe encore : un setStyle (changement de basemap)
  // détruit les custom layers → un handle survivant pointerait une couche morte.
  if (prewarmed && prewarmed.map === map && map.getLayer(LAYER_ID)) return prewarmed.handle
  prewarmed = null
  // Reset de l'état animé (re-entrée du step / navigation arrière).
  pointCloudView.modeFrom = MODE.altitude
  pointCloudView.modeTo = MODE.altitude
  pointCloudView.scan = SCAN_MAX
  pointCloudView.scanWidth = 45
  pointCloudView.scanGlow = 0
  pointCloudView.reveal = 0
  pointCloudTuning.pointSizePx = 0.5

  if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID)
  const l = new PointCloudLayer()
  map.addLayer(l as unknown as CustomLayerInterface)
  const handle: PointCloudHandle = {
    detach: () => removePointCloud(map),
    ready: l.ready,
    setReveal: (n) => l.setReveal(n),
    project: (p) => l.project(p),
  }
  prewarmed = { map, handle }
  return handle
}

// Adopte la couche préchauffée si elle existe (step 7), sinon la crée à la volée.
export function addPointCloud(map: MLMap): PointCloudHandle {
  return prewarmPointCloud(map)
}

// Remet le nuage au sommet de la pile de couches. Nécessaire car la préchauffe ajoute
// le nuage AVANT le step LiDAR ; addSatelliteHd (au step) s'insère alors par-dessus et
// masque les points. moveLayer sans beforeId = tout en haut. No-op si le nuage est absent
// ou déjà au sommet (cas sans préchauffe).
export function bringPointCloudToFront(map: MLMap) {
  if (map.getLayer(LAYER_ID)) map.moveLayer(LAYER_ID)
}

export function removePointCloud(map: MLMap) {
  prewarmed = null
  if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID) // déclenche onRemove → libère le GL
  useMapDataStore.getState().setPointCloudStats(null)
}
