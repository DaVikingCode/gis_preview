import type {
  CustomLayerInterface,
  CustomRenderMethodInput,
  LngLatLike,
  Map as MLMap,
} from 'maplibre-gl'
import * as THREE from 'three'
import { useMapDataStore, type PointCloudStats } from '@/store/map-data-store'

// -----------------------------------------------------------------------------
// Nuage de points LiDAR — couche WebGL personnalisée (three.js dans le contexte GL
// de MapLibre), même mécanique que `airplane3d.ts`.
//
// Step « Nuage de points · LiDAR » : scan LiDAR d'Auxonne (France, ~9,5 M points,
// CRS UTM 31N) rendu PAR-DESSUS le fond de plan, posé au sol à son emplacement réel.
// Le binaire est pré-cuit hors-ligne (cf. scripts/prebake-pointcloud.mjs →
// auxonne.points.bin/.json) :
//   layout = [Int16 positions·3 (cm, recentré sur le centre de l'emprise, sol à 0)]
//            ‖ [Uint8 RGB·3 (vraie couleur)] ‖ [Uint8 classification·1 (classe ASPRS)]
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

// Le binaire (~95 Mo) dépasse la limite de 25 Mio/fichier de Cloudflare Pages : il
// est pré-tranché en chunks committés dans `public/pointcloud/` (cf.
// scripts/split-pointcloud.mjs) et ré-assemblé ici (concat byte-exact). Le `.json`
// (~2 Ko) reste bundlé normalement.
const MANIFEST_URL = `${import.meta.env.BASE_URL}pointcloud/manifest.json`
const META_URL = new URL('../../assets/pointcloud/auxonne.points.json', import.meta.url).href

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
  private points: THREE.Points | null = null
  private uniforms: MaterialUniforms | null = null
  private lastMatrix: THREE.Matrix4 | null = null // matrice composée de la dernière frame (project)
  private cancelled = false

  readonly ready: Promise<{ count: number }>
  private resolveReady!: (v: { count: number }) => void

  constructor() {
    this.ready = new Promise((res) => {
      this.resolveReady = res
    })
  }

  onAdd(map: MLMap, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.map = map
    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: true,
    })
    this.renderer.autoClear = false
    // Nos couleurs (RGB, rampe, palette) sont déjà en sRGB : on écrit les octets tels
    // quels (comme MapLibre), sans ré-encodage sRGB qui délaverait le rendu.
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    void this.load()
  }

  private async load() {
    try {
      const [metaRes, manifestRes] = await Promise.all([fetch(META_URL), fetch(MANIFEST_URL)])
      const meta = (await metaRes.json()) as PointCloudStats & {
        posScale: number
        classes: { code: number; count: number }[]
        linePath?: [number, number][]
        dangerPois?: {
          veg: [number, number, number]
          cond: [number, number, number]
          clearanceM: number
        }[]
      }
      // Ré-assemblage des chunks (cf. scripts/split-pointcloud.mjs) en un buffer unique.
      const manifest = (await manifestRes.json()) as { bytes: number; chunks: string[] }
      const base = `${import.meta.env.BASE_URL}pointcloud/`
      const parts = await Promise.all(
        manifest.chunks.map((name) => fetch(base + name).then((r) => r.arrayBuffer())),
      )
      if (this.cancelled) return
      const u8 = new Uint8Array(manifest.bytes)
      let off = 0
      for (const part of parts) {
        u8.set(new Uint8Array(part), off)
        off += part.byteLength
      }
      const buf = u8.buffer

      const count = meta.count
      const posI16 = new Int16Array(buf, 0, count * 3)
      const rgbU8 = new Uint8Array(buf, count * 3 * 2, count * 3)
      const clsU8 = new Uint8Array(buf, count * 3 * 2 + count * 3, count)

      // Dé-quantification des positions (cm → mètres) en Float32 pour le GPU.
      const positions = new Float32Array(count * 3)
      const s = meta.posScale
      for (let i = 0; i < positions.length; i++) positions[i] = posI16[i] * s

      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      // RGB (vraie couleur) via vertexColors → vColor dans le shader.
      geometry.setAttribute('color', new THREE.BufferAttribute(rgbU8, 3, true))
      // Classification : octet brut → float (non normalisé) lu par le shader.
      geometry.setAttribute('aClass', new THREE.BufferAttribute(clsU8, 1, false))

      const material = new THREE.PointsMaterial({
        size: pointCloudTuning.pointSizePx,
        sizeAttenuation: false,
        vertexColors: true,
      })
      const maxZ = meta.zRangeM[1] || 1
      material.onBeforeCompile = (shader) => {
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
            '#include <common>\nattribute float aClass;\nvarying float vClass;\nvarying float vUp;\nvarying float vScanCoord;',
          )
          .replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\n  vClass = aClass;\n  vUp = position.z;\n  vScanCoord = position.y;',
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

      const points = new THREE.Points(geometry, material)
      points.frustumCulled = false
      this.points = points
      this.scene.add(points)

      useMapDataStore.getState().setPointCloudStats({
        count: meta.count,
        footprintM: meta.footprintM,
        zRangeM: meta.zRangeM,
      })
      useMapDataStore.getState().setPointCloudClasses(meta.classes ?? [])
      useMapDataStore.getState().setPointCloudLinePath(meta.linePath ?? [])
      useMapDataStore.getState().setPointCloudDangerPois(meta.dangerPois ?? [])

      geometry.setDrawRange(0, 0)
      this.map?.triggerRepaint()
      this.resolveReady({ count })
    } catch (err) {
      console.error('[pointCloud] échec du chargement', err)
      this.resolveReady({ count: 0 })
    }
  }

  setReveal(n: number) {
    if (!this.points) return
    this.points.geometry.setDrawRange(0, Math.max(0, Math.round(n)))
    this.map?.triggerRepaint()
  }

  project(p: [number, number, number]): { x: number; y: number; visible: boolean } | null {
    if (!this.lastMatrix || !this.map) return null
    const v = new THREE.Vector4(p[0], p[1], p[2], 1).applyMatrix4(this.lastMatrix)
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
    if (!this.renderer || !this.map || !this.points) return

    const mainMatrix = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix)
    const transform = (this.map as unknown as { transform: ModelTransform }).transform
    const t = pointCloudTuning
    const s = t.scale
    const l = new THREE.Matrix4()
      .fromArray(transform.getMatrixForModel(POINTCLOUD_ANCHOR, t.altitudeM))
      // Décalage horizontal dans le repère ENU (X est, Y nord) avant rotations.
      .multiply(new THREE.Matrix4().makeTranslation(t.offsetEast, t.offsetNorth, 0))
      .multiply(new THREE.Matrix4().makeRotationZ(t.bearingDeg * DEG2RAD))
      .multiply(new THREE.Matrix4().makeRotationX(t.pitchDeg * DEG2RAD))
      .multiply(new THREE.Matrix4().makeRotationY(t.rollDeg * DEG2RAD))
      .multiply(new THREE.Matrix4().makeScale(s, s, s))
    const composed = mainMatrix.multiply(l)
    this.camera.projectionMatrix = composed
    this.lastMatrix = composed // mémorisée pour project() (overlay POI)
    ;(this.points.material as THREE.PointsMaterial).size = t.pointSizePx

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
    if (this.points) {
      this.points.geometry.dispose()
      ;(this.points.material as THREE.Material).dispose()
      this.points = null
    }
    this.uniforms = null
    this.lastMatrix = null
    this.renderer?.dispose()
    this.renderer = null
    this.map = null
  }
}

export function addPointCloud(map: MLMap): PointCloudHandle {
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
  return {
    detach: () => removePointCloud(map),
    ready: l.ready,
    setReveal: (n) => l.setReveal(n),
    project: (p) => l.project(p),
  }
}

export function removePointCloud(map: MLMap) {
  if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID) // déclenche onRemove → libère le GL
  useMapDataStore.getState().setPointCloudStats(null)
}
