// Découpe du binaire LiDAR en chunks servables par Cloudflare Pages, ALIGNÉS PAR POINTS
// pour le streaming progressif (cf. src/map/layers/pointCloud.ts).
//
// Cloudflare Pages refuse tout asset > 25 Mio. `auxonne.points.bin` (~95 Mo, cf.
// scripts/prebake-pointcloud.mjs) a un layout GLOBAL attribute-major :
//   [Int16 positions·3 (×count)] ‖ [Uint8 RGB·3 (×count)] ‖ [Uint8 classe·1 (×count)]
//
// Une coupe byte brute mélangerait des morceaux d'attributs → chunk non décodable seul.
// On re-packe donc chaque chunk en SELF-CONTAINED : pour une tranche de points [p0,p1),
//   chunk = [posI16·3 de la tranche] ‖ [rgbU8·3] ‖ [clsU8·1]
// Chaque chunk est ainsi décodable indépendamment et rendu dès son arrivée (streaming).
// L'ordre des points (déjà shuffle au prebake) est PRÉSERVÉ → chaque chunk est un
// échantillon spatialement uniforme du nuage entier (densification progressive).
//
// One-shot (dev only) : les chunks produits sont COMMITTÉS (la source .bin, elle,
// n'est pas versionnée). Relancer puis re-committer `public/pointcloud/` seulement
// quand la source change. Usage : `node scripts/split-pointcloud.mjs`. Idempotent.
//
// Sorties (dans public/pointcloud/) :
//   c2-000.bin, c2-001.bin, …  — chunks self-contained (~8 Mio chacun)
//   manifest.json              — { version, count, chunks:[{name,count}, …] }
//
// Noms versionnés (`c2-`) : `_headers` sert les .bin en `immutable`, donc une URL déjà
// vue n'est jamais re-téléchargée. Changer de layout ⇒ changer le préfixe (sinon stale).

import { readFile, writeFile, mkdir, rm, copyFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, '..', 'src', 'assets', 'pointcloud', 'auxonne.points.bin')
const META = join(HERE, '..', 'src', 'assets', 'pointcloud', 'auxonne.points.json')
const OUT_DIR = join(HERE, '..', 'public', 'pointcloud')

const VERSION = 2
const PREFIX = `c${VERSION}-`
const POINT_BYTES = 3 * 2 + 3 * 1 + 1 // Int16·3 + Uint8·3 + Uint8·1
// ~8 Mio par chunk (premier paint plus tôt), aligné sur un nombre entier de points.
const POINTS_PER_CHUNK = Math.floor((8 * 1024 * 1024) / POINT_BYTES)

const buf = await readFile(SRC)
const meta = JSON.parse(await readFile(META, 'utf8'))
const count = meta.count

// Régions du layout global attribute-major.
const POS_OFF = 0
const RGB_OFF = count * 6
const CLS_OFF = count * 6 + count * 3

// Repart de zéro pour rester idempotent (purge aussi l'ancien jeu chunk-*.bin).
await rm(OUT_DIR, { recursive: true, force: true })
await mkdir(OUT_DIR, { recursive: true })

const chunks = []
for (let p0 = 0, i = 0; p0 < count; p0 += POINTS_PER_CHUNK, i++) {
  const p1 = Math.min(p0 + POINTS_PER_CHUNK, count)
  const n = p1 - p0
  const pos = buf.subarray(POS_OFF + p0 * 6, POS_OFF + p1 * 6)
  const rgb = buf.subarray(RGB_OFF + p0 * 3, RGB_OFF + p1 * 3)
  const cls = buf.subarray(CLS_OFF + p0, CLS_OFF + p1)
  const name = `${PREFIX}${String(i).padStart(3, '0')}.bin`
  await writeFile(join(OUT_DIR, name), Buffer.concat([pos, rgb, cls]))
  chunks.push({ name, count: n })
}

// La meta JSON est servie au runtime depuis public/pointcloud/ (cf. META_URL) : on la
// (re)copie depuis src/assets car le `rm` ci-dessus vide tout OUT_DIR.
await copyFile(META, join(OUT_DIR, 'auxonne.points.json'))

await writeFile(join(OUT_DIR, 'manifest.json'), JSON.stringify({ version: VERSION, count, chunks }))

const sum = chunks.reduce((a, c) => a + c.count, 0)
if (sum !== count) throw new Error(`somme des counts (${sum}) != meta.count (${count})`)

console.log(
  `split-pointcloud: ${count.toLocaleString()} points → ${chunks.length} chunks self-contained (~${(POINTS_PER_CHUNK * POINT_BYTES) / 1024 / 1024} Mio) dans public/pointcloud/`,
)
