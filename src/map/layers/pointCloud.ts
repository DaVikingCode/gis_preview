import type {
  CustomLayerInterface,
  CustomRenderMethodInput,
  LngLatLike,
  Map as MLMap,
} from 'maplibre-gl'
import * as THREE from 'three'
import gsap from 'gsap'
import { useMapDataStore, type PointCloudStats } from '@/store/map-data-store'

// -----------------------------------------------------------------------------
// Nuage de points LiDAR — couche WebGL personnalisée (three.js dans le contexte GL
// de MapLibre), même mécanique que `airplane3d.ts`.
//
// Step « Nuage de points · LiDAR » : on affiche un vrai scan LiDAR (Palac Moszna,
// ~0,95 M points colorisés par altitude) PAR-DESSUS le fond de plan, posé au sol à
// un ancrage parisien. Le binaire est pré-cuit hors-ligne (cf.
// scripts/prebake-pointcloud.mjs → palac_moszna.points.bin/.json) : positions en
// mètres recentrées sur le centroïde (Int16, cm) + couleurs Uint8 RGB. Aucun
// décodage .laz/WASM au runtime.
//
// Placement : les positions sont des offsets ENU en mètres (X est, Y nord, Z haut)
// autour de l'ancrage ; `map.transform.getMatrixForModel(ANCHOR, 0)` fournit la
// matrice repère→monde (valable quelle que soit la projection), composée avec la
// matrice de projection de MapLibre (args.defaultProjectionData.mainMatrix) et
// injectée dans la caméra three.js — exactement comme l'avion glTF.
// -----------------------------------------------------------------------------

export type PointCloudHandle = { detach: () => void }

const LAYER_ID = 'gp-pointcloud'

// VRAI emplacement du scan : centroïde EPSG:2178 (ETRS89 / Poland CS2000 zone 6)
// transformé en WGS84 — Pałac w Mosznej (Pologne). Recalculé et émis dans le
// manifest par scripts/prebake-pointcloud.mjs (champ anchorLngLat). Partagé avec le
// step (caméra centrée ici).
export const POINTCLOUD_ANCHOR: [number, number] = [17.768101, 50.44078]

const BIN_URL = new URL('../../assets/pointcloud/palac_moszna.points.bin', import.meta.url).href
const META_URL = new URL('../../assets/pointcloud/palac_moszna.points.json', import.meta.url).href

const DEG2RAD = Math.PI / 180

// Animation de révélation : à l'arrivée, le nuage n'apparaît PAS d'un coup. Après un
// court délai, les points (mélangés dans le binaire — cf. prebake) se matérialisent
// progressivement via geometry.setDrawRange(0, n) qui monte de 0 au total.
const REVEAL_DELAY_S = 0.6
const REVEAL_DURATION_S = 3.8

// Réglages d'orientation / rendu, édités en live par PointCloudDebugPanel et lus par
// render() à chaque frame (même pattern que airplaneTuning). Le nuage étant recentré
// sur son centroïde (origine locale = centre, sol à Z=0), les rotations pivotent
// autour de son centre.
export const pointCloudTuning = {
  bearingDeg: 0, // rotation autour de la verticale (Z) — alignement nord
  pitchDeg: -90, // bascule autour de l'axe est (X) — redresse le nuage (repère Y-up)
  rollDeg: 0, // bascule autour de l'axe nord (Y)
  altitudeM: 0, // surélévation (m)
  scale: 1.1, // facteur d'échelle
  pointSizePx: 0.5, // taille des points (px, sizeAttenuation: false)
}

// Accès à transform.getMatrixForModel (typé sur ITransform, exposé via map.transform).
type ModelTransform = { getMatrixForModel(location: LngLatLike, altitude?: number): number[] }

class PointCloudLayer implements CustomLayerInterface {
  readonly id = LAYER_ID
  readonly type = 'custom' as const
  readonly renderingMode: '2d' | '3d' = '3d'

  private map: MLMap | null = null
  private renderer: THREE.WebGLRenderer | null = null
  private scene = new THREE.Scene()
  private camera = new THREE.Camera()
  private points: THREE.Points | null = null
  private reveal: gsap.core.Tween | null = null
  private cancelled = false

  onAdd(map: MLMap, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.map = map
    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: true,
    })
    this.renderer.autoClear = false

    // Chargement asynchrone du binaire pré-cuit ; une fois prêt, le nuage se révèle
    // progressivement (cf. load → reveal).
    void this.load()
  }

  private async load() {
    try {
      const [metaRes, binRes] = await Promise.all([fetch(META_URL), fetch(BIN_URL)])
      const meta = (await metaRes.json()) as PointCloudStats & { posScale: number }
      const buf = await binRes.arrayBuffer()
      if (this.cancelled) return

      const count = meta.count
      const posI16 = new Int16Array(buf, 0, count * 3)
      const colU8 = new Uint8Array(buf, count * 3 * 2, count * 3)

      // Dé-quantification des positions (cm → mètres) en Float32 pour le GPU.
      const positions = new Float32Array(count * 3)
      const s = meta.posScale
      for (let i = 0; i < positions.length; i++) positions[i] = posI16[i] * s

      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      // Couleurs Uint8 normalisées (0-255 → 0-1) lues directement par vertexColors.
      geometry.setAttribute('color', new THREE.BufferAttribute(colU8, 3, true))

      const material = new THREE.PointsMaterial({
        size: pointCloudTuning.pointSizePx,
        sizeAttenuation: false,
        vertexColors: true,
      })
      const points = new THREE.Points(geometry, material)
      points.frustumCulled = false
      this.points = points
      this.scene.add(points)

      useMapDataStore.getState().setPointCloudStats({
        count: meta.count,
        footprintM: meta.footprintM,
        zRangeM: meta.zRangeM,
      })

      // Révélation progressive (sauf prefers-reduced-motion → tout d'un coup).
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduced) {
        geometry.setDrawRange(0, count)
      } else {
        geometry.setDrawRange(0, 0)
        const prog = { n: 0 }
        this.reveal = gsap.to(prog, {
          n: count,
          duration: REVEAL_DURATION_S,
          delay: REVEAL_DELAY_S,
          ease: 'power1.out',
          onUpdate: () => {
            geometry.setDrawRange(0, Math.round(prog.n))
            this.map?.triggerRepaint()
          },
        })
      }
      this.map?.triggerRepaint()
    } catch (err) {
      console.error('[pointCloud] échec du chargement', err)
    }
  }

  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, args: CustomRenderMethodInput) {
    if (!this.renderer || !this.map || !this.points) return

    const mainMatrix = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix)
    const transform = (this.map as unknown as { transform: ModelTransform }).transform
    // Repère ENU (mètres) posé au sol à l'ancrage réel (Moszna), surélevé de altitudeM.
    const t = pointCloudTuning
    const s = t.scale
    const l = new THREE.Matrix4()
      .fromArray(transform.getMatrixForModel(POINTCLOUD_ANCHOR, t.altitudeM))
      .multiply(new THREE.Matrix4().makeRotationZ(t.bearingDeg * DEG2RAD))
      .multiply(new THREE.Matrix4().makeRotationX(t.pitchDeg * DEG2RAD))
      .multiply(new THREE.Matrix4().makeRotationY(t.rollDeg * DEG2RAD))
      .multiply(new THREE.Matrix4().makeScale(s, s, s))
    this.camera.projectionMatrix = mainMatrix.multiply(l)
    // Taille des points relue chaque frame (réglable en live via le debug panel).
    ;(this.points.material as THREE.PointsMaterial).size = t.pointSizePx

    this.renderer.resetState()
    this.renderer.render(this.scene, this.camera)
  }

  onRemove(_map: MLMap) {
    this.cancelled = true
    this.reveal?.kill()
    this.reveal = null
    if (this.points) {
      this.points.geometry.dispose()
      ;(this.points.material as THREE.Material).dispose()
      this.points = null
    }
    this.renderer?.dispose()
    this.renderer = null
    this.map = null
  }
}

export function addPointCloud(map: MLMap): PointCloudHandle {
  if (!map.getLayer(LAYER_ID)) map.addLayer(new PointCloudLayer())
  return { detach: () => removePointCloud(map) }
}

export function removePointCloud(map: MLMap) {
  if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID) // déclenche onRemove → libère le GL
  useMapDataStore.getState().setPointCloudStats(null)
}
