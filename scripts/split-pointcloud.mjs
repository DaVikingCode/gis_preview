// Découpe du binaire LiDAR en chunks servables par Cloudflare Pages.
//
// Cloudflare Pages refuse tout asset > 25 Mio. `auxonne.points.bin` (~95 Mo, cf.
// scripts/prebake-pointcloud.mjs) est donc tranché en chunks < 25 Mio écrits dans
// `public/pointcloud/`, copiés tels quels dans `dist/` par Vite et ré-assemblés
// au runtime (concat byte-exact → un seul ArrayBuffer, cf. src/map/layers/pointCloud.ts).
//
// One-shot (dev only) : les chunks produits sont COMMITTÉS (la source .bin, elle,
// n'est pas versionnée). Relancer puis re-committer `public/pointcloud/` seulement
// quand la source change. Usage : `node scripts/split-pointcloud.mjs`. Idempotent.
//
// Sorties (dans public/pointcloud/) :
//   chunk-000.bin, chunk-001.bin, …  — tranches contiguës du .bin (24 Mio chacune)
//   manifest.json                    — { bytes, chunks:[nom, …] } pour le ré-assemblage

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, '..', 'src', 'assets', 'pointcloud', 'auxonne.points.bin')
const OUT_DIR = join(HERE, '..', 'public', 'pointcloud')

// 24 Mio < limite 25 Mio de Cloudflare Pages.
const CHUNK_BYTES = 24 * 1024 * 1024

const buf = await readFile(SRC)
const bytes = buf.length

// Repart de zéro pour rester idempotent (évite des chunks orphelins si la taille change).
await rm(OUT_DIR, { recursive: true, force: true })
await mkdir(OUT_DIR, { recursive: true })

const chunks = []
for (let offset = 0, i = 0; offset < bytes; offset += CHUNK_BYTES, i++) {
  const name = `chunk-${String(i).padStart(3, '0')}.bin`
  await writeFile(join(OUT_DIR, name), buf.subarray(offset, offset + CHUNK_BYTES))
  chunks.push(name)
}

await writeFile(join(OUT_DIR, 'manifest.json'), JSON.stringify({ bytes, chunks }))

console.log(
  `split-pointcloud: ${(bytes / 1024 / 1024).toFixed(1)} Mio → ${chunks.length} chunks dans public/pointcloud/`,
)
