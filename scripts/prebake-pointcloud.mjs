// Pré-cuisson du nuage de points LiDAR (one-shot, dev only).
//
// Décode `Palac_Moszna.laz` (LAS 1.2, format 3 = XYZ + RGB, ~5,7 M points,
// CRS EPSG:2178, mètres) une fois, le décime et le réécrit en un binaire compact
// committé que l'app charge instantanément au runtime — pas de laz-perf/WASM côté
// client (cf. src/map/layers/pointCloud.ts).
//
// Usage : `node scripts/prebake-pointcloud.mjs`
// À relancer si on change la décimation (TARGET_POINTS) ou la source .laz.
//
// Sorties (dans src/assets/pointcloud/) :
//   palac_moszna.points.bin  — Int16 positions (count·3, cm, recentré sur le
//                              centroïde XY et posé au sol minZ) puis Uint8 RGB (count·3)
//   palac_moszna.points.json — { count, footprintM:[w,h], zRangeM:[0,maxUp], posScale,
//                              anchorLngLat:[lng,lat] (centroïde EPSG:2178 → WGS84) }

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parse } from '@loaders.gl/core'
import { LASLoader } from '@loaders.gl/las'

const HERE = dirname(fileURLToPath(import.meta.url))
const ASSET_DIR = join(HERE, '..', 'src', 'assets', 'pointcloud')
const SRC = join(ASSET_DIR, 'Palac_Moszna.laz')
const OUT_BIN = join(ASSET_DIR, 'palac_moszna.points.bin')
const OUT_JSON = join(ASSET_DIR, 'palac_moszna.points.json')

// Cible de décimation : Infinity = TOUS les points du scan (nuage complet, ~5,7 M).
const TARGET_POINTS = Infinity
// Précision de quantification des positions : 1 cm (value = mètres · 100).
const POS_SCALE = 0.01

console.log('Décodage', SRC, '…')
const buf = await readFile(SRC)
const data = await parse(
  buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  LASLoader,
)

const pos = data.attributes.POSITION?.value
if (!pos) throw new Error('Pas d’attribut POSITION dans le LAS décodé')
const total = pos.length / 3
console.log('Points décodés :', total.toLocaleString('fr-FR'))

// Couleurs : ce scan est en LAS format 3 mais les champs RGB sont vides (0,0,0) —
// seule l'INTENSITÉ (réflectance, 16 bits) porte de l'information. On colorise donc
// par ALTITUDE (rampe « turbo ») modulée par l'intensité normalisée pour révéler le
// détail des surfaces. Si un jour la source porte un vrai RGB, on le réutilise tel quel.
const colorAttr = data.attributes.COLOR_0
const rawColors = colorAttr?.value
const colorSize = colorAttr?.size ?? 3
// Détection d'un vrai RGB : on échantillonne les canaux R/G/B (en sautant l'alpha,
// qui vaut 255 quand size==4) — sinon l'alpha ferait croire à tort à une couleur.
let hasRGB = false
if (rawColors) {
  const n = Math.min(total, 2000)
  for (let i = 0; i < n && !hasRGB; i++) {
    const c = i * colorSize
    if (rawColors[c] > 0 || rawColors[c + 1] > 0 || rawColors[c + 2] > 0) hasRGB = true
  }
}
const intensity = data.attributes.intensity?.value

// Centroïde XY + minZ + plage d'intensité (sur l'ensemble, avant décimation).
let cx = 0
let cy = 0
let minZ = Infinity
let maxZ = -Infinity
let minI = Infinity
let maxI = -Infinity
for (let i = 0; i < total; i++) {
  cx += pos[i * 3]
  cy += pos[i * 3 + 1]
  const z = pos[i * 3 + 2]
  if (z < minZ) minZ = z
  if (z > maxZ) maxZ = z
  if (intensity) {
    const it = intensity[i]
    if (it < minI) minI = it
    if (it > maxI) maxI = it
  }
}
cx /= total
cy /= total
const iSpan = maxI - minI || 1
const zSpan = maxZ - minZ || 1

// Centroïde EPSG:2178 (ETRS89 / Poland CS2000 zone 6) → WGS84, par Transverse
// Mercator inverse (GRS80, lon0=18°, k0=0.999923, faux est x0=6 500 000). Sert à
// poser le nuage à son VRAI emplacement (Pałac w Mosznej) sur la carte ; émis dans
// le manifest et reporté en dur dans POINTCLOUD_ANCHOR (src/map/layers/pointCloud.ts).
function epsg2178ToWgs84(X, Y) {
  const a = 6378137
  const f = 1 / 298.257222101
  const e2 = f * (2 - f)
  const k0 = 0.999923
  const lon0 = (18 * Math.PI) / 180
  const x0 = 6_500_000
  const E = X - x0
  const M = Y / k0
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2))
  const mu = M / (a * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 ** 3) / 256))
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 * e1) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu)
  const ep2 = e2 / (1 - e2)
  const C1 = ep2 * Math.cos(phi1) ** 2
  const T1 = Math.tan(phi1) ** 2
  const N1 = a / Math.sqrt(1 - e2 * Math.sin(phi1) ** 2)
  const R1 = (a * (1 - e2)) / Math.pow(1 - e2 * Math.sin(phi1) ** 2, 1.5)
  const D = E / (N1 * k0)
  const lat =
    phi1 -
    ((N1 * Math.tan(phi1)) / R1) *
      ((D * D) / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ep2) * D ** 4) / 24 +
        ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ep2 - 3 * C1 * C1) * D ** 6) / 720)
  const lon =
    lon0 +
    (D -
      ((1 + 2 * T1 + C1) * D ** 3) / 6 +
      ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ep2 + 24 * T1 * T1) * D ** 5) / 120) /
      Math.cos(phi1)
  return [(lon * 180) / Math.PI, (lat * 180) / Math.PI]
}
const anchorLngLat = epsg2178ToWgs84(cx, cy).map((v) => Number(v.toFixed(6)))
console.log('Ancrage WGS84 (centroïde → vrai emplacement) :', anchorLngLat)

// Rampe « turbo » compacte (5 arrêts) : bleu → cyan → vert → orange → rouge clair.
const RAMP = [
  [48, 18, 130],
  [29, 158, 195],
  [93, 201, 99],
  [240, 170, 47],
  [232, 90, 70],
]
function ramp(t) {
  const x = Math.min(0.999, Math.max(0, t)) * (RAMP.length - 1)
  const i = Math.floor(x)
  const f = x - i
  const a = RAMP[i]
  const b = RAMP[i + 1]
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
}
console.log(hasRGB ? 'Couleurs : RGB source' : 'Couleurs : altitude × intensité (pas de RGB)')

const stride = Math.max(1, Math.round(total / TARGET_POINTS))
const count = Math.floor((total - 1) / stride) + 1
console.log('Décimation stride', stride, '→', count.toLocaleString('fr-FR'), 'points')

const outPos = new Int16Array(count * 3)
const outCol = new Uint8Array(count * 3)
let maxUp = 0
let j = 0
for (let i = 0; i < total; i += stride) {
  const east = pos[i * 3] - cx
  const north = pos[i * 3 + 1] - cy
  const up = pos[i * 3 + 2] - minZ
  if (up > maxUp) maxUp = up
  outPos[j * 3] = Math.round(east / POS_SCALE)
  outPos[j * 3 + 1] = Math.round(north / POS_SCALE)
  outPos[j * 3 + 2] = Math.round(up / POS_SCALE)
  if (hasRGB) {
    const c = i * colorSize
    const big = rawColors[c] > 255 || rawColors[c + 1] > 255 || rawColors[c + 2] > 255
    outCol[j * 3] = big ? rawColors[c] >> 8 : rawColors[c]
    outCol[j * 3 + 1] = big ? rawColors[c + 1] >> 8 : rawColors[c + 1]
    outCol[j * 3 + 2] = big ? rawColors[c + 2] >> 8 : rawColors[c + 2]
  } else {
    // Couleur dérivée : teinte par altitude (rampe turbo), luminosité modulée par
    // l'intensité normalisée (0.55 → 1.0) pour faire ressortir les surfaces.
    const [r, g, b] = ramp(up / zSpan)
    const inorm = intensity ? (intensity[i] - minI) / iSpan : 0.7
    const lum = 0.55 + 0.45 * Math.min(1, Math.max(0, inorm))
    outCol[j * 3] = Math.round(r * lum)
    outCol[j * 3 + 1] = Math.round(g * lum)
    outCol[j * 3 + 2] = Math.round(b * lum)
  }
  j++
}

// Mélange de l'ordre des points (Fisher-Yates) : le runtime révèle le nuage
// progressivement via setDrawRange(0, n) ; un ordre aléatoire donne une
// matérialisation DISPERSÉE (points qui apparaissent partout) plutôt qu'un balayage
// par ligne de scan.
for (let i = count - 1; i > 0; i--) {
  const k = Math.floor(Math.random() * (i + 1))
  for (let d = 0; d < 3; d++) {
    const pa = i * 3 + d
    const pb = k * 3 + d
    const tp = outPos[pa]
    outPos[pa] = outPos[pb]
    outPos[pb] = tp
    const tc = outCol[pa]
    outCol[pa] = outCol[pb]
    outCol[pb] = tc
  }
}

// Emprise réelle (m) pour la carte de stats.
let minE = Infinity
let maxE = -Infinity
let minN = Infinity
let maxN = -Infinity
for (let i = 0; i < count; i++) {
  const e = outPos[i * 3] * POS_SCALE
  const n = outPos[i * 3 + 1] * POS_SCALE
  if (e < minE) minE = e
  if (e > maxE) maxE = e
  if (n < minN) minN = n
  if (n > maxN) maxN = n
}

const out = Buffer.concat([Buffer.from(outPos.buffer), Buffer.from(outCol.buffer)])
await writeFile(OUT_BIN, out)
const meta = {
  count,
  footprintM: [Math.round(maxE - minE), Math.round(maxN - minN)],
  zRangeM: [0, Math.round(maxUp)],
  posScale: POS_SCALE,
  anchorLngLat,
}
await writeFile(OUT_JSON, JSON.stringify(meta, null, 2))

console.log('Écrit', OUT_BIN, '—', (out.length / 1_048_576).toFixed(1), 'Mo')
console.log('Meta', meta)
