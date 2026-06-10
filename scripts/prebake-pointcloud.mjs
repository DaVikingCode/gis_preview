// Pré-cuisson du nuage de points LiDAR (one-shot, dev only).
//
// Décode `auxonne.las` (LAS 1.2, format 3 = XYZ + RGB 16 bits + classification,
// ~9,5 M points, CRS UTM zone 31N / EPSG:32631, mètres — Auxonne, France) une fois
// et le réécrit en un binaire compact committé que l'app charge au runtime — pas de
// laz-perf/WASM côté client (cf. src/map/layers/pointCloud.ts).
//
// Usage : `node scripts/prebake-pointcloud.mjs`
// À relancer si on change la décimation (TARGET_POINTS) ou la source .las.
//
// Sorties (dans src/assets/pointcloud/) :
//   auxonne.points.bin  — [Int16 positions ·3 (cm, recentré sur le centre de l'emprise
//                          XY, sol à minZ)] ‖ [Uint8 RGB ·3] ‖ [Uint8 classification ·1]
//   auxonne.points.json — { count, footprintM:[w,h], zRangeM:[0,maxUp], posScale,
//                          anchorLngLat:[lng,lat] (centre UTM31N → WGS84), crs,
//                          classes:[{code,count}] (histogramme trié),
//                          cells:[{offset,count,bbox:[minE,minN,minZ,maxE,maxN,maxZ] m}]
//                          (ranges contigus par cellule spatiale, ordre sud→nord) }

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parse } from '@loaders.gl/core'
import { LASLoader } from '@loaders.gl/las'

const HERE = dirname(fileURLToPath(import.meta.url))
const ASSET_DIR = join(HERE, '..', 'src', 'assets', 'pointcloud')
const SRC = join(ASSET_DIR, 'auxonne.las')
const OUT_BIN = join(ASSET_DIR, 'auxonne.points.bin')
const OUT_JSON = join(ASSET_DIR, 'auxonne.points.json')

// Cible de décimation : Infinity = TOUS les points (~9,5 M). 5 M (stride 2 → ~4,74 M)
// divise par 2 le transfert, la VRAM et la charge vertex — indiscernable aux tailles de
// points de la démo (0,5–5,5 px, nuage très sur-échantillonné à l'écran).
const TARGET_POINTS = 5_000_000
// Précision de quantification des positions : 1 cm (value = mètres · 100).
const POS_SCALE = 0.01
const CRS = 'EPSG:32631'

console.log('Décodage', SRC, '…')
const buf = await readFile(SRC)
const data = await parse(
  buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  LASLoader,
)
console.log('Attributs décodés :', Object.keys(data.attributes).join(', '))

const pos = data.attributes.POSITION?.value
if (!pos) throw new Error('Pas d’attribut POSITION dans le LAS décodé')
const total = pos.length / 3
console.log('Points décodés :', total.toLocaleString('fr-FR'))

// ⚠️ loaders.gl décode MAL le RGB de ce fichier (COLOR_0 ressort à [0,0,0]). On lit
// donc le RGB ET la classification DIRECTEMENT dans les enregistrements bruts du .las.
// loaders.gl conserve l'ordre des points → l'index i = l'enregistrement i du fichier.
// LAS 1.2 format 3 ; longueur d'enregistrement variable (champs « extra bytes »).
const PT_LEN = buf.readUInt16LE(105)
const DATA_OFFSET = buf.readUInt32LE(96)
const REC_CLASS = 15 // classification (1 octet) dans l'enregistrement
const REC_R = 28 // R/G/B (uint16 chacun) ; octet de poids fort = valeur 8 bits → >>8

// Centre de l'emprise XY + minZ (sur l'ensemble). On recentre sur le CENTRE de la
// bbox (et non la moyenne) pour garantir que les offsets tiennent en Int16 (±327 m).
let minX = Infinity
let maxX = -Infinity
let minY = Infinity
let maxY = -Infinity
let minZ = Infinity
let maxZ = -Infinity
for (let i = 0; i < total; i++) {
  const x = pos[i * 3]
  const y = pos[i * 3 + 1]
  const z = pos[i * 3 + 2]
  if (x < minX) minX = x
  if (x > maxX) maxX = x
  if (y < minY) minY = y
  if (y > maxY) maxY = y
  if (z < minZ) minZ = z
  if (z > maxZ) maxZ = z
}
const cx = (minX + maxX) / 2
const cy = (minY + maxY) / 2

// UTM zone 31N (EPSG:32631, WGS84) → WGS84 lng/lat, par Transverse Mercator inverse
// (lon0=3°E, k0=0,9996, faux est 500 000, faux nord 0, ellipsoïde GRS80/WGS84). Sert
// à poser le nuage à son VRAI emplacement (Auxonne) ; reporté dans POINTCLOUD_ANCHOR.
function utm31nToWgs84(X, Y) {
  const a = 6378137
  const f = 1 / 298.257223563
  const e2 = f * (2 - f)
  const k0 = 0.9996
  const lon0 = (3 * Math.PI) / 180
  const x0 = 500000
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
const anchorLngLat = utm31nToWgs84(cx, cy).map((v) => Number(v.toFixed(6)))
console.log('Ancrage WGS84 (centre emprise → Auxonne) :', anchorLngLat)

const stride = Math.max(1, Math.round(total / TARGET_POINTS))
const count = Math.floor((total - 1) / stride) + 1
console.log('Décimation stride', stride, '→', count.toLocaleString('fr-FR'), 'points')

const outPos = new Int16Array(count * 3)
const outRgb = new Uint8Array(count * 3) // vraie couleur RGB du scan
const outCls = new Uint8Array(count) // classification ASPRS (5 bits)
const classHist = {}
// Points de la ligne électrique (classe 24, UTM XYZ) → polyligne centrale + POI danger.
const LINE_CLASS = 24
const lineXs = []
const lineYs = []
const lineZs = []
// Végétation U4 (classe 29, la plus présente, UTM XYZ) → POI de danger reliant la
// végétation à la ligne.
const URGENT_CLASSES = new Set([29])
const vegX = []
const vegY = []
const vegZ = []
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
  // RGB + classification lus dans l'enregistrement brut i (cf. note ci-dessus).
  const rec = DATA_OFFSET + i * PT_LEN
  outRgb[j * 3] = buf.readUInt16LE(rec + REC_R) >> 8
  outRgb[j * 3 + 1] = buf.readUInt16LE(rec + REC_R + 2) >> 8
  outRgb[j * 3 + 2] = buf.readUInt16LE(rec + REC_R + 4) >> 8
  const cls = buf.readUInt8(rec + REC_CLASS) & 0x1f
  outCls[j] = cls
  classHist[cls] = (classHist[cls] || 0) + 1
  if (cls === LINE_CLASS) {
    lineXs.push(pos[i * 3])
    lineYs.push(pos[i * 3 + 1])
    lineZs.push(pos[i * 3 + 2])
  } else if (URGENT_CLASSES.has(cls)) {
    vegX.push(pos[i * 3])
    vegY.push(pos[i * 3 + 1])
    vegZ.push(pos[i * 3 + 2])
  }
  j++
}

// Polyligne centrale de la ligne électrique : on binne les points classe 24 le long de
// leur axe principal (le plus étendu) et on moyenne l'autre coord par bin → waypoints
// UTM, convertis en [lng,lat]. Sert à faire suivre la ligne par la caméra (plan rapproché).
let linePath = []
if (lineXs.length > 500) {
  let lnX = Infinity,
    lxX = -Infinity,
    lnY = Infinity,
    lxY = -Infinity
  for (let i = 0; i < lineXs.length; i++) {
    if (lineXs[i] < lnX) lnX = lineXs[i]
    if (lineXs[i] > lxX) lxX = lineXs[i]
    if (lineYs[i] < lnY) lnY = lineYs[i]
    if (lineYs[i] > lxY) lxY = lineYs[i]
  }
  const alongY = lxY - lnY >= lxX - lnX // axe principal de la ligne
  const lo = alongY ? lnY : lnX
  const hi = alongY ? lxY : lxX
  const K = 24
  const span = hi - lo || 1
  const bins = Array.from({ length: K }, () => ({ sx: 0, sy: 0, n: 0 }))
  for (let i = 0; i < lineXs.length; i++) {
    const a = alongY ? lineYs[i] : lineXs[i]
    const bi = Math.min(K - 1, Math.max(0, Math.floor(((a - lo) / span) * K)))
    bins[bi].sx += lineXs[i]
    bins[bi].sy += lineYs[i]
    bins[bi].n++
  }
  const minPer = lineXs.length / K / 6 // ignore les bins quasi vides
  const wp = bins
    .filter((b) => b.n > minPer)
    .map((b) => [b.sx / b.n, b.sy / b.n])
    .sort((p, q) => (alongY ? p[1] - q[1] : p[0] - q[0]))
  linePath = wp.map(([X, Y]) => utm31nToWgs84(X, Y).map((v) => Number(v.toFixed(6))))
  console.log('Ligne électrique :', lineXs.length, 'points →', linePath.length, 'waypoints')
} else {
  console.log('Ligne électrique : pas assez de points (', lineXs.length, ') → pas de polyligne')
}

// POI de danger : pour chaque point végétation urgente (U0/U1), on cherche le conducteur
// (classe 24) le plus proche en 3D → vrai écart végétation↔ligne. On retient les 4 plus
// dangereux, espacés horizontalement, et on émet leurs coords LOCALES (m, repère du bin).
let dangerPois = []
if (vegX.length > 0 && lineXs.length > 0) {
  // U4 est très peuplé (~700k pts) : on sous-échantillonne les candidats (≤3000) pour
  // garder la recherche du conducteur le plus proche rapide (on ne veut que 4 POI).
  const VEG_CAP = 3000
  const vegStride = Math.max(1, Math.ceil(vegX.length / VEG_CAP))
  const cand = []
  for (let a = 0; a < vegX.length; a += vegStride) {
    let best = Infinity
    let bk = -1
    for (let k = 0; k < lineXs.length; k++) {
      const dx = vegX[a] - lineXs[k]
      const dy = vegY[a] - lineYs[k]
      const dz = vegZ[a] - lineZs[k]
      const d2 = dx * dx + dy * dy + dz * dz
      if (d2 < best) {
        best = d2
        bk = k
      }
    }
    cand.push({ a, k: bk, d: Math.sqrt(best) })
  }
  // On veut un écart VISIBLE et dangereux : un segment assez long pour bien relier la
  // végétation à la ligne à l'écran (on écarte les points coïncidents et les trop loin).
  const MIN_GAP = 1.5
  const MAX_GAP = 12.0
  const usable = cand.filter((c) => c.d >= MIN_GAP && c.d <= MAX_GAP).sort((p, q) => p.d - q.d)
  const pool = usable.length >= 2 ? usable : cand.sort((p, q) => p.d - q.d)
  const SEP = 50 // m : écart horizontal mini entre POI retenus
  const sel = []
  for (const c of pool) {
    if (sel.every((s) => Math.hypot(vegX[c.a] - vegX[s.a], vegY[c.a] - vegY[s.a]) >= SEP)) {
      sel.push(c)
      if (sel.length >= 4) break
    }
  }
  const loc = (x, y, z) => [
    Number((x - cx).toFixed(2)),
    Number((y - cy).toFixed(2)),
    Number((z - minZ).toFixed(2)),
  ]
  dangerPois = sel.map((c) => ({
    veg: loc(vegX[c.a], vegY[c.a], vegZ[c.a]),
    cond: loc(lineXs[c.k], lineYs[c.k], lineZs[c.k]),
    clearanceM: Number(c.d.toFixed(1)),
  }))
  console.log(
    'POI danger :',
    dangerPois.length,
    '→',
    dangerPois.map((p) => p.clearanceM + ' m').join(', '),
  )
} else {
  console.log('POI danger : pas de végétation U0/U1 ou pas de conducteur')
}

// ── Partition en CELLULES spatiales + shuffle INTRA-cellule ─────────────────────
// Le runtime (pointCloud.ts) rend un THREE.Points par cellule : ranges CONTIGUS dans le
// binaire → frustum culling par cellule (gros plan = ~80 % du nuage hors-champ éliminé
// avant le vertex shader) ET budget de densité par cellule. Le shuffle Fisher-Yates est
// fait À L'INTÉRIEUR de chaque cellule : tout préfixe du drawRange d'une cellule est un
// sous-échantillon spatialement uniforme de la cellule → LOD par simple drawRange.
// Cellules ordonnées SUD → NORD (puis ouest→est) : le streaming réseau remplit le nuage
// dans le sens du front de scan de révélation (qui balaie sud→nord).
const CELL_M = 60 // ~60 m de côté → ~3×9 cellules sur l'emprise 176×496 m

// Bornes de l'emprise (unités quantifiées, cm) — servent à la grille ET aux stats.
let minEq = Infinity
let maxEq = -Infinity
let minNq = Infinity
let maxNq = -Infinity
for (let i = 0; i < count; i++) {
  const e = outPos[i * 3]
  const n = outPos[i * 3 + 1]
  if (e < minEq) minEq = e
  if (e > maxEq) maxEq = e
  if (n < minNq) minNq = n
  if (n > maxNq) maxNq = n
}
const cellCm = CELL_M / POS_SCALE
const gridX = Math.max(1, Math.ceil((maxEq - minEq + 1) / cellCm))
const gridY = Math.max(1, Math.ceil((maxNq - minNq + 1) / cellCm))
const cellOf = (i) => {
  const cxI = Math.min(gridX - 1, Math.floor((outPos[i * 3] - minEq) / cellCm))
  const cyI = Math.min(gridY - 1, Math.floor((outPos[i * 3 + 1] - minNq) / cellCm))
  return cyI * gridX + cxI // row-major, rangées sud (minN) d'abord
}

// Tri par cellule (counting sort, stable — l'ordre intra-cellule est re-mélangé après).
const cellCounts = new Uint32Array(gridX * gridY)
for (let i = 0; i < count; i++) cellCounts[cellOf(i)]++
const cellOffsets = new Uint32Array(gridX * gridY)
for (let c = 1; c < cellCounts.length; c++) cellOffsets[c] = cellOffsets[c - 1] + cellCounts[c - 1]
const cursor = Uint32Array.from(cellOffsets)
const sortedPos = new Int16Array(count * 3)
const sortedRgb = new Uint8Array(count * 3)
const sortedCls = new Uint8Array(count)
for (let i = 0; i < count; i++) {
  const j = cursor[cellOf(i)]++
  sortedPos[j * 3] = outPos[i * 3]
  sortedPos[j * 3 + 1] = outPos[i * 3 + 1]
  sortedPos[j * 3 + 2] = outPos[i * 3 + 2]
  sortedRgb[j * 3] = outRgb[i * 3]
  sortedRgb[j * 3 + 1] = outRgb[i * 3 + 1]
  sortedRgb[j * 3 + 2] = outRgb[i * 3 + 2]
  sortedCls[j] = outCls[i]
}

// Fisher-Yates aligné (positions ‖ RGB ‖ classe) DANS chaque cellule.
for (let c = 0; c < cellCounts.length; c++) {
  const o = cellOffsets[c]
  for (let r = cellCounts[c] - 1; r > 0; r--) {
    const i = o + r
    const k = o + Math.floor(Math.random() * (r + 1))
    for (let d = 0; d < 3; d++) {
      const pa = i * 3 + d
      const pb = k * 3 + d
      let t = sortedPos[pa]
      sortedPos[pa] = sortedPos[pb]
      sortedPos[pb] = t
      t = sortedRgb[pa]
      sortedRgb[pa] = sortedRgb[pb]
      sortedRgb[pb] = t
    }
    const tc = sortedCls[i]
    sortedCls[i] = sortedCls[k]
    sortedCls[k] = tc
  }
}

// Meta des cellules NON VIDES : range contigu + bbox (m, coords locales) pour la
// boundingSphere (frustum culling) côté runtime. L'ordre des entrées = ordre du binaire.
const cells = []
for (let c = 0; c < cellCounts.length; c++) {
  const n = cellCounts[c]
  if (n === 0) continue
  const o = cellOffsets[c]
  let bMinE = Infinity,
    bMaxE = -Infinity
  let bMinN = Infinity,
    bMaxN = -Infinity
  let bMinZ = Infinity,
    bMaxZ = -Infinity
  for (let i = o; i < o + n; i++) {
    const e = sortedPos[i * 3]
    const nn = sortedPos[i * 3 + 1]
    const z = sortedPos[i * 3 + 2]
    if (e < bMinE) bMinE = e
    if (e > bMaxE) bMaxE = e
    if (nn < bMinN) bMinN = nn
    if (nn > bMaxN) bMaxN = nn
    if (z < bMinZ) bMinZ = z
    if (z > bMaxZ) bMaxZ = z
  }
  const m = (v) => Number((v * POS_SCALE).toFixed(2))
  cells.push({
    offset: o,
    count: n,
    bbox: [m(bMinE), m(bMinN), m(bMinZ), m(bMaxE), m(bMaxN), m(bMaxZ)],
  })
}
console.log('Cellules :', gridX, '×', gridY, '→', cells.length, 'non vides')

// Emprise réelle (m) pour la carte de stats.
const minE = minEq * POS_SCALE
const maxE = maxEq * POS_SCALE
const minN = minNq * POS_SCALE
const maxN = maxNq * POS_SCALE

// Layout du binaire : positions (Int16·3) ‖ RGB (Uint8·3) ‖ classification (Uint8·1).
const out = Buffer.concat([
  Buffer.from(sortedPos.buffer),
  Buffer.from(sortedRgb.buffer),
  Buffer.from(sortedCls.buffer),
])
await writeFile(OUT_BIN, out)
const classes = Object.entries(classHist)
  .map(([code, n]) => ({ code: Number(code), count: n }))
  .sort((a, b) => b.count - a.count)
const meta = {
  count,
  footprintM: [Math.round(maxE - minE), Math.round(maxN - minN)],
  zRangeM: [0, Math.round(maxUp)],
  posScale: POS_SCALE,
  anchorLngLat,
  crs: CRS,
  classes,
  cells,
  linePath,
  dangerPois,
}
await writeFile(OUT_JSON, JSON.stringify(meta, null, 2))

console.log('Écrit', OUT_BIN, '—', (out.length / 1_048_576).toFixed(1), 'Mo')
console.log('Meta', JSON.stringify(meta))
