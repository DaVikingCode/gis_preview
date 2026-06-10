// Découpe du binaire LiDAR en chunks servables par Cloudflare Pages, ALIGNÉS PAR POINTS
// pour le streaming progressif (cf. src/map/layers/pointCloud.ts).
//
// Cloudflare Pages refuse tout asset > 25 Mio. `auxonne.points.bin` (cf.
// scripts/prebake-pointcloud.mjs) a un layout GLOBAL attribute-major :
//   [Int16 positions·3 (×count)] ‖ [Uint8 RGB·3 (×count)] ‖ [Uint8 classe·1 (×count)]
//
// Une coupe byte brute mélangerait des morceaux d'attributs → chunk non décodable seul.
// On re-packe donc chaque chunk en SELF-CONTAINED pour une tranche de points [p0,p1),
// PUIS on le compresse :
//   1. le bloc positions est réécrit en BYTE-PLANES par composante
//      [xLo·n ‖ xHi·n ‖ yLo·n ‖ yHi·n ‖ zLo·n ‖ zHi·n] — les octets de poids fort,
//      peu entropiques (points triés par cellule au prebake), se compressent bien
//      mieux séparés des octets de poids faible (bruit de quantification cm) ;
//   2. chunk = gzip([planes pos] ‖ [rgbU8·3] ‖ [clsU8·1]).
// Cloudflare ne compresse pas l'octet-stream : on pré-compresse ici, le client
// décompresse via DecompressionStream('gzip') et refusionne les planes en Int16.
//
// L'ordre des points (tri par cellule + shuffle intra-cellule au prebake) est PRÉSERVÉ →
// les ranges contigus des cellules (meta.cells) restent valides après concat des chunks.
//
// One-shot (dev only) : les chunks produits sont COMMITTÉS (la source .bin, elle,
// n'est pas versionnée). Relancer puis re-committer `public/pointcloud/` seulement
// quand la source change. Usage : `node scripts/split-pointcloud.mjs`. Idempotent.
//
// Sorties (dans public/pointcloud/) :
//   c3-000.bin, c3-001.bin, …  — chunks self-contained gzippés
//   manifest.json              — { version, count, encoding, chunks:[{name,count}, …] }
//
// Noms versionnés (`c3-`) : `_headers` sert les .bin en `immutable`, donc une URL déjà
// vue n'est jamais re-téléchargée. Changer de layout ⇒ changer le préfixe (sinon stale).

import { readFile, writeFile, mkdir, rm, copyFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { gzipSync } from 'node:zlib'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, '..', 'src', 'assets', 'pointcloud', 'auxonne.points.bin')
const META = join(HERE, '..', 'src', 'assets', 'pointcloud', 'auxonne.points.json')
const OUT_DIR = join(HERE, '..', 'public', 'pointcloud')

const VERSION = 3
const PREFIX = `c${VERSION}-`
// Sentinelle de layout lue par le client (refuse un manifest d'une autre forme).
const ENCODING = 'gzip-planes-v1'
const POINT_BYTES = 3 * 2 + 3 * 1 + 1 // Int16·3 + Uint8·3 + Uint8·1
// ~8 Mio par chunk AVANT compression (premier paint plus tôt), nombre entier de points.
const POINTS_PER_CHUNK = Math.floor((8 * 1024 * 1024) / POINT_BYTES)

const buf = await readFile(SRC)
const meta = JSON.parse(await readFile(META, 'utf8'))
const count = meta.count

// Régions du layout global attribute-major.
const POS_OFF = 0
const RGB_OFF = count * 6
const CLS_OFF = count * 6 + count * 3

// Bloc positions [p0,p1) → byte-planes par composante (lo puis hi, ordre x,y,z).
function posPlanes(p0, p1) {
  const n = p1 - p0
  const i16 = new Int16Array(buf.buffer, buf.byteOffset + POS_OFF + p0 * 6, n * 3)
  const planes = Buffer.alloc(n * 6)
  for (let c = 0; c < 3; c++) {
    const lo = c * 2 * n
    const hi = lo + n
    for (let i = 0; i < n; i++) {
      const v = i16[i * 3 + c] & 0xffff
      planes[lo + i] = v & 0xff
      planes[hi + i] = v >> 8
    }
  }
  return planes
}

// Repart de zéro pour rester idempotent (purge aussi l'ancien jeu c2-*.bin).
await rm(OUT_DIR, { recursive: true, force: true })
await mkdir(OUT_DIR, { recursive: true })

const chunks = []
let rawTotal = 0
let gzTotal = 0
for (let p0 = 0, i = 0; p0 < count; p0 += POINTS_PER_CHUNK, i++) {
  const p1 = Math.min(p0 + POINTS_PER_CHUNK, count)
  const n = p1 - p0
  const rgb = buf.subarray(RGB_OFF + p0 * 3, RGB_OFF + p1 * 3)
  const cls = buf.subarray(CLS_OFF + p0, CLS_OFF + p1)
  const raw = Buffer.concat([posPlanes(p0, p1), rgb, cls])
  const gz = gzipSync(raw, { level: 9 })
  const name = `${PREFIX}${String(i).padStart(3, '0')}.bin`
  await writeFile(join(OUT_DIR, name), gz)
  // `bytes` = poids RÉEL sur le réseau (gzippé) → dénominateur exact du loader.
  chunks.push({ name, count: n, bytes: gz.length })
  rawTotal += raw.length
  gzTotal += gz.length
}

// La meta JSON est servie au runtime depuis public/pointcloud/ (cf. META_URL) : on la
// (re)copie depuis src/assets car le `rm` ci-dessus vide tout OUT_DIR.
await copyFile(META, join(OUT_DIR, 'auxonne.points.json'))

await writeFile(
  join(OUT_DIR, 'manifest.json'),
  JSON.stringify({ version: VERSION, count, encoding: ENCODING, chunks }),
)

const sum = chunks.reduce((a, c) => a + c.count, 0)
if (sum !== count) throw new Error(`somme des counts (${sum}) != meta.count (${count})`)

const mio = (b) => (b / 1024 / 1024).toFixed(1)
console.log(
  `split-pointcloud: ${count.toLocaleString()} points → ${chunks.length} chunks gzip ` +
    `(${mio(rawTotal)} Mio bruts → ${mio(gzTotal)} Mio, ${Math.round((gzTotal / rawTotal) * 100)} %) dans public/pointcloud/`,
)
