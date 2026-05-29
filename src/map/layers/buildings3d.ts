import type { Map as MLMap } from 'maplibre-gl'

const SOURCE_ID = 'openmaptiles-buildings'
const LAYER_ID = 'gp-buildings-3d'
const SOURCE_LAYER = 'building'

const BASE_COLOR_EXPR = [
  'interpolate',
  ['linear'],
  ['get', 'render_height'],
  0,
  '#ece6d8',
  50,
  '#d8cdb4',
  150,
  '#bca988',
  300,
  '#8c785a',
] as const

// Palette "doc MapLibre" : dégradé par hauteur, lisible sur du bâti haut (NY).
const HEIGHT_COLOR_EXPR = [
  'interpolate',
  ['linear'],
  ['get', 'render_height'],
  0,
  'lightgray',
  200,
  'royalblue',
  400,
  'lightblue',
] as const

// Couches de bâtiments fournies par certains basemaps (liberty, bright). Notre
// extrusion se superpose à elles → z-fighting (clignotement). On les masque
// pendant que notre couche est active, puis on les rétablit.
const BASEMAP_BUILDING_LAYERS = ['building', 'building-3d', 'building-top']

function hideBasemapBuildings(map: MLMap) {
  for (const id of BASEMAP_BUILDING_LAYERS) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none')
  }
}

function showBasemapBuildings(map: MLMap) {
  for (const id of BASEMAP_BUILDING_LAYERS) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible')
  }
}

export function addBuildings3D(map: MLMap, opts?: { colorByHeight?: boolean }) {
  hideBasemapBuildings(map)
  const colorExpr = (opts?.colorByHeight ? HEIGHT_COLOR_EXPR : BASE_COLOR_EXPR) as never
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
      promoteId: 'osm_id',
    })
  }
  // La couche peut déjà exister (le StartScreen la pose en palette de base comme
  // décor du cinématique d'intro). Ne pas court-circuiter : ré-appliquer la
  // couleur demandée pour que `colorByHeight` gagne (sinon les bâtiments restent
  // beiges au lieu de bleus à l'étape Bâtiments 3D, de façon intermittente).
  if (map.getLayer(LAYER_ID)) {
    map.setPaintProperty(LAYER_ID, 'fill-extrusion-color', colorExpr)
    return
  }
  map.addLayer({
    id: LAYER_ID,
    source: SOURCE_ID,
    'source-layer': SOURCE_LAYER,
    type: 'fill-extrusion',
    minzoom: 14,
    filter: ['!=', ['get', 'hide_3d'], true],
    paint: {
      'fill-extrusion-color': colorExpr,
      'fill-extrusion-height': [
        'interpolate',
        ['linear'],
        ['zoom'],
        14,
        0,
        16,
        [
          '*',
          ['coalesce', ['get', 'render_height'], 0],
          ['case', ['boolean', ['feature-state', 'dim'], false], 0, 1],
        ],
      ] as never,
      'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
      'fill-extrusion-opacity': 0.85,
    },
  })
}

export function removeBuildings3D(map: MLMap) {
  if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID)
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
  showBasemapBuildings(map)
}

// --- Spotlight: dim only the buildings within a radius of the pyramid -----

const DIMMED_IDS = new Set<string | number>()
const SPOTLIGHT_CENTER: [number, number] = [2.33587, 48.86088]
const SPOTLIGHT_RADIUS_M = 220

function distanceMeters(a: [number, number], b: [number, number]) {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const lat1 = toRad(a[1]),
    lat2 = toRad(b[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function geometryTouchesSpotlight(geom: GeoJSON.Polygon | GeoJSON.MultiPolygon): boolean {
  const polys: number[][][][] = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates
  for (const poly of polys) {
    for (const ring of poly) {
      for (const pos of ring) {
        if (distanceMeters([pos[0], pos[1]], SPOTLIGHT_CENTER) <= SPOTLIGHT_RADIUS_M) {
          return true
        }
      }
    }
  }
  return false
}

export function applyLouvreSpotlight(map: MLMap) {
  const apply = () => {
    if (!map.getLayer(LAYER_ID)) return
    const feats = map.queryRenderedFeatures({ layers: [LAYER_ID] })
    for (const f of feats) {
      if (f.id == null || DIMMED_IDS.has(f.id)) continue
      const g = f.geometry
      if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') continue
      if (geometryTouchesSpotlight(g)) {
        map.setFeatureState(
          { source: SOURCE_ID, sourceLayer: SOURCE_LAYER, id: f.id },
          { dim: true },
        )
        DIMMED_IDS.add(f.id)
      }
    }
  }
  if (map.areTilesLoaded() && map.isStyleLoaded()) apply()
  else map.once('idle', apply)
  // Run a second pass shortly after — features can stream in across tiles.
  setTimeout(apply, 600)
}

export function clearLouvreSpotlight(map: MLMap) {
  for (const id of DIMMED_IDS) {
    try {
      map.removeFeatureState({ source: SOURCE_ID, sourceLayer: SOURCE_LAYER, id })
    } catch {
      /* source might already be gone */
    }
  }
  DIMMED_IDS.clear()
}

// -----------------------------------------------------------------------------
// Pyramide du Louvre highlight — Google IO Travel style
//
// The pyramid is a small glass structure sitting in the Cour Napoléon
// (an open courtyard). OpenMapTiles does NOT include it as a building
// feature, so feature-state highlighting on the OMT source can never work.
//
// What Google did in their IO 2021 demo: they hand-authored the building
// footprint as a Three.js mesh overlay aligned to the real building.
// We do the same here with a hardcoded GeoJSON polygon + transparent
// extrusion that matches the actual footprint, height and orientation.
// -----------------------------------------------------------------------------

const PYRAMID_SRC = 'gp-louvre-pyramid'
const PYRAMID_FILL = 'gp-louvre-pyramid-extrusion'
const PYRAMID_OUTLINE = 'gp-louvre-pyramid-outline'

const PYRAMID_HEIGHT = 21.64 // meters (real-world apex height)
const PYRAMID_HALF_SIDE = 17.71 // meters
const PYRAMID_CENTER: [number, number] = [2.33587, 48.86088]
const PYRAMID_ROT_DEG = 22.5 // alignment with the Cour Napoléon axes

function pyramidFootprint(): [number, number][] {
  const [cx, cy] = PYRAMID_CENTER
  const mPerDegLat = 111320
  const mPerDegLng = 111320 * Math.cos((cy * Math.PI) / 180)
  const rad = (PYRAMID_ROT_DEG * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const corners: [number, number][] = [
    [+PYRAMID_HALF_SIDE, +PYRAMID_HALF_SIDE],
    [-PYRAMID_HALF_SIDE, +PYRAMID_HALF_SIDE],
    [-PYRAMID_HALF_SIDE, -PYRAMID_HALF_SIDE],
    [+PYRAMID_HALF_SIDE, -PYRAMID_HALF_SIDE],
  ].map(([x, y]) => {
    const rx = x * cos - y * sin
    const ry = x * sin + y * cos
    return [cx + rx / mPerDegLng, cy + ry / mPerDegLat]
  })
  corners.push(corners[0])
  return corners
}

export function highlightLouvre(map: MLMap) {
  if (!map.getSource(PYRAMID_SRC)) {
    map.addSource(PYRAMID_SRC, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [pyramidFootprint()] },
      },
    })
  }
  if (!map.getLayer(PYRAMID_FILL)) {
    map.addLayer({
      id: PYRAMID_FILL,
      type: 'fill-extrusion',
      source: PYRAMID_SRC,
      paint: {
        'fill-extrusion-color': '#10b981', // emerald
        'fill-extrusion-opacity': 0.55,
        'fill-extrusion-height': PYRAMID_HEIGHT,
        'fill-extrusion-base': 0,
      },
    })
  }
  if (!map.getLayer(PYRAMID_OUTLINE)) {
    map.addLayer({
      id: PYRAMID_OUTLINE,
      type: 'line',
      source: PYRAMID_SRC,
      paint: {
        'line-color': '#34d399',
        'line-width': 2,
        'line-opacity': 0.9,
      },
    })
  }
}

export function clearHighlight(map: MLMap) {
  for (const id of [PYRAMID_OUTLINE, PYRAMID_FILL]) {
    if (map.getLayer(id)) map.removeLayer(id)
  }
  if (map.getSource(PYRAMID_SRC)) map.removeSource(PYRAMID_SRC)
}
