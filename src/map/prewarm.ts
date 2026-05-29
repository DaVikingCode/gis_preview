import type { Map as MLMap, StyleSpecification } from 'maplibre-gl'
import { BASEMAPS, type BasemapId } from './basemaps'
import type { TourStep } from '@/tour/steps'

// -----------------------------------------------------------------------------
// Tile prewarming.
//
// MapLibre v5 has no viewport-prefetch API (no `prefetchZoomDelta`); the only
// native knobs are maxTileCacheSize / maxTileCacheZoomLevels (in-memory
// retention). So to make "Suivant" land instantly, we warm the *browser HTTP
// cache* ahead of time: compute the tile URLs every tour step will request and
// fetch() them in the background during idle. When MapLibre later requests the
// same URL it is served from the disk cache → zero network at click time.
//
// Works for raster (cadastre/ortho) and vector (.pbf) tiles alike, as long as
// the tile server sends cacheable headers (openfreemap, data.geopf.fr do).
// -----------------------------------------------------------------------------

type TileTemplate = {
  template: string
  tileSize: number
  minzoom: number
  maxzoom: number
}

type Camera = TourStep['camera']

// --- Tile math (WebMercator / XYZ — identical to IGN's TILEMATRIXSET=PM) ------

function lngLatToTileXY(lng: number, lat: number, z: number): { x: number; y: number } {
  const n = Math.pow(2, z)
  const x = ((lng + 180) / 360) * n
  const latRad = (lat * Math.PI) / 180
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  return { x, y }
}

const MAX_TILES_PER_LAYER_ZOOM = 400

// Integer-zoom tiles covering a (future) camera view, with generous buffering so
// pitched/rotated views — which see further toward the horizon — are fully
// covered. Not pixel-perfect (we don't replicate MapLibre's coverage algorithm);
// the margin guarantees the visible tiles are warmed.
function tilesForView(
  cam: Camera,
  viewport: { width: number; height: number },
  tpl: TileTemplate,
): { z: number; x: number; y: number }[] {
  const pitch = cam.pitch ?? 0
  const bearing = cam.bearing ?? 0
  const base = cam.zoom

  // Candidate integer zooms: raster rounds, vector floors — cover both. Pitched
  // views also pull in lower-detail tiles toward the horizon.
  const zoomSet = new Set<number>([Math.floor(base), Math.round(base)])
  if (pitch > 0) zoomSet.add(Math.floor(base) - 1)
  if (pitch >= 60) zoomSet.add(Math.floor(base) - 2)

  const rotFactor = bearing !== 0 ? 1.45 : 1.1
  const pitchVert = 1 + pitch / 35

  const out: { z: number; x: number; y: number }[] = []
  const seen = new Set<string>()

  for (const candidate of zoomSet) {
    const zInt = Math.max(tpl.minzoom, Math.min(tpl.maxzoom, Math.round(candidate)))
    const worldTiles = Math.pow(2, zInt)
    // px covered by one zInt-tile at the fractional render zoom.
    const tilePx = tpl.tileSize * Math.pow(2, base - zInt)
    const halfX = (viewport.width / tilePx / 2) * rotFactor + 1
    const halfY = (viewport.height / tilePx / 2) * rotFactor * pitchVert + 1
    const c = lngLatToTileXY(cam.center[0], cam.center[1], zInt)

    let count = 0
    let capped = false
    for (let x = Math.floor(c.x - halfX); x <= Math.ceil(c.x + halfX) && !capped; x++) {
      for (let y = Math.floor(c.y - halfY); y <= Math.ceil(c.y + halfY); y++) {
        if (x < 0 || y < 0 || x >= worldTiles || y >= worldTiles) continue
        const key = `${zInt}/${x}/${y}`
        if (seen.has(key)) continue
        if (count >= MAX_TILES_PER_LAYER_ZOOM) {
          capped = true
          break
        }
        seen.add(key)
        out.push({ z: zInt, x, y })
        count++
      }
    }
    if (capped) {
      console.warn(`[prewarm] tile cap (${MAX_TILES_PER_LAYER_ZOOM}) hit at z${zInt}`)
    }
  }
  return out
}

// --- Tile-template resolution ------------------------------------------------

type AnySource = {
  type?: string
  tiles?: string[]
  url?: string
  tileSize?: number
  minzoom?: number
  maxzoom?: number
}
type TileJson = { tiles?: string[]; minzoom?: number; maxzoom?: number; tileSize?: number }

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, mode: 'cors' })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return (await res.json()) as T
}

async function resolveSourceTemplate(
  src: AnySource,
  signal?: AbortSignal,
): Promise<TileTemplate | null> {
  if (src.type !== 'vector' && src.type !== 'raster' && src.type !== 'raster-dem') return null
  const isVector = src.type === 'vector'
  let tiles = src.tiles
  let minzoom = src.minzoom ?? 0
  let maxzoom = src.maxzoom ?? (isVector ? 14 : 19)
  let tileSize = src.tileSize ?? (isVector ? 512 : 256)
  // Indirect source: fetch its TileJSON to discover the tile URL template.
  if (!tiles && typeof src.url === 'string') {
    const tj = await fetchJson<TileJson>(src.url, signal)
    tiles = tj.tiles
    if (tj.minzoom != null) minzoom = tj.minzoom
    if (tj.maxzoom != null) maxzoom = tj.maxzoom
    if (tj.tileSize != null) tileSize = tj.tileSize
  }
  if (!tiles || tiles.length === 0) return null
  return { template: tiles[0], tileSize, minzoom, maxzoom }
}

const styleTplCache = new Map<string, Promise<TileTemplate[]>>()

// Resolve every tiled source of a basemap style (positron/liberty/bright are
// style URLs we fetch; satellite is an inline raster style). Memoized.
function resolveStyleTemplates(
  style: string | StyleSpecification,
  signal?: AbortSignal,
): Promise<TileTemplate[]> {
  const key = typeof style === 'string' ? style : JSON.stringify(style.sources ?? {})
  const cached = styleTplCache.get(key)
  if (cached) return cached
  const p = (async () => {
    const spec =
      typeof style === 'string' ? await fetchJson<StyleSpecification>(style, signal) : style
    const sources = (spec.sources ?? {}) as Record<string, AnySource>
    const out: TileTemplate[] = []
    for (const src of Object.values(sources)) {
      try {
        const t = await resolveSourceTemplate(src, signal)
        if (t) out.push(t)
      } catch {
        /* unreachable source — skip, MapLibre will fetch it lazily */
      }
    }
    return out
  })()
  // Don't poison the cache with a rejected (e.g. aborted) resolution.
  p.catch(() => styleTplCache.delete(key))
  styleTplCache.set(key, p)
  return p
}

// --- Overlay tile templates (raster layers added by step onEnter hooks) ------
// Kept in sync by hand with the layer modules they mirror. Add a tiled layer ⇒
// add a line here so its tiles get prewarmed.
//   cadastre  → src/map/layers/cadastre.ts
//   ortho     → src/map/layers/wmsRaster.ts  +  src/map/SwipeCompare.tsx
const GEOPF = 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0'
const wmts = (layer: string, format: string): string =>
  `${GEOPF}&LAYER=${layer}&STYLE=normal&TILEMATRIXSET=PM` +
  `&FORMAT=${format}&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}`

const CADASTRE_TPL: TileTemplate = {
  template: wmts('CADASTRALPARCELS.PARCELLAIRE_EXPRESS', 'image/png'),
  tileSize: 256,
  minzoom: 13,
  maxzoom: 19,
}

const ORTHO_TPL: TileTemplate = {
  template: wmts('ORTHOIMAGERY.ORTHOPHOTOS', 'image/jpeg'),
  tileSize: 256,
  minzoom: 0,
  maxzoom: 21,
}

const ORTHO_HISTO_TPL: TileTemplate = {
  template: wmts('ORTHOIMAGERY.ORTHOPHOTOS.1950-1965', 'image/png'),
  tileSize: 256,
  minzoom: 0,
  maxzoom: 18,
}

function overlayTemplates(step: TourStep): TileTemplate[] {
  switch (step.id) {
    case 'layers-apply-cadastre':
      return [CADASTRE_TPL]
    case 'raster-wms':
      return [ORTHO_TPL]
    case 'swipe':
      return [ORTHO_TPL, ORTHO_HISTO_TPL]
    // buildings3d / building-highlight use the openfreemap `planet` vector
    // source — the very same source positron's basemap already pulls, so it's
    // warmed by the basemap pass at those steps' locations.
    default:
      return []
  }
}

function buildUrl(tpl: TileTemplate, t: { z: number; x: number; y: number }): string {
  return tpl.template
    .replace('{z}', String(t.z))
    .replace('{x}', String(t.x))
    .replace('{y}', String(t.y))
}

// --- Orchestration -----------------------------------------------------------

const CONCURRENCY = 6
const warmed = new Set<string>()
let controller: AbortController | null = null

function scheduleIdle(): Promise<void> {
  return new Promise((resolve) => {
    const ric = (
      window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void
      }
    ).requestIdleCallback
    if (typeof ric === 'function') ric(() => resolve(), { timeout: 500 })
    else setTimeout(resolve, 60)
  })
}

async function warmUrls(urls: string[], signal: AbortSignal): Promise<void> {
  const fresh = [...new Set(urls)].filter((u) => !warmed.has(u))
  let i = 0
  const worker = async () => {
    while (i < fresh.length && !signal.aborted) {
      const url = fresh[i++]
      try {
        const res = await fetch(url, {
          signal,
          mode: 'cors',
          cache: 'force-cache',
          credentials: 'omit',
        })
        // Drain the body so the full response lands in the HTTP cache.
        await res.arrayBuffer()
        warmed.add(url)
      } catch {
        /* abort or network error — MapLibre will fetch it lazily if still needed */
      }
      // Breathe between batches so we never compete with an in-flight animation.
      if (i % CONCURRENCY === 0) await scheduleIdle()
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, fresh.length) }, worker))
}

// Warm, in tour order, every tile each step's view will request (basemap +
// overlays). Runs in the background; safe to call again — already-warmed URLs
// are skipped. Cancels any prior run.
export function startPrewarm(map: MLMap, steps: TourStep[]): void {
  if (typeof window === 'undefined') return
  cancelPrewarm()
  const ctrl = new AbortController()
  controller = ctrl
  const { signal } = ctrl

  void (async () => {
    const container = map.getContainer()
    const viewport = {
      width: container.clientWidth || window.innerWidth || 1280,
      height: container.clientHeight || window.innerHeight || 800,
    }
    // The controller carries the basemap forward across steps that don't set
    // one, so mirror that here.
    let lastBm: BasemapId = 'positron'
    for (let idx = 0; idx < steps.length; idx++) {
      if (signal.aborted) return
      const step = steps[idx]
      const prevBm: BasemapId = lastBm
      const bm: BasemapId = step.basemap ?? prevBm
      lastBm = bm
      const bmChanges = bm !== prevBm

      let templates: TileTemplate[] = []
      try {
        templates = await resolveStyleTemplates(BASEMAPS[bm].style, signal)
      } catch {
        /* basemap style unreachable — still warm the overlays below */
      }
      templates = templates.concat(overlayTemplates(step))
      // A `pan` defers the previous step's onLeave until the camera lands, so
      // its overlays stay rendered throughout the flight (e.g. the cadastre
      // stays visible while panning into the 3D step). Warm them at this step's
      // destination too — unless this step swaps basemap, since the setStyle
      // wipes those layers before the flight.
      if (step.pan && idx > 0 && !bmChanges) {
        templates = templates.concat(overlayTemplates(steps[idx - 1]))
      }
      if (signal.aborted) return

      const urls: string[] = []
      for (const tpl of templates) {
        for (const t of tilesForView(step.camera, viewport, tpl)) {
          urls.push(buildUrl(tpl, t))
        }
      }
      await warmUrls(urls, signal)
      if (signal.aborted) return
      await scheduleIdle() // yield between steps
    }
  })()
}

export function cancelPrewarm(): void {
  controller?.abort()
  controller = null
}
