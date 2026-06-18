import type { Map as MLMap } from 'maplibre-gl'

const SOURCE_ID = 'openmaptiles-buildings'

// Source vectorielle du BASEMAP pointant sur le « planet » d'openfreemap (positron :
// `openmaptiles`). C'est la même donnée que notre source dédiée : en réutilisant celle
// du style, les tuiles de la destination ne sont téléchargées/parsées qu'UNE fois
// pendant le vol d'entrée — les extrusions 3D apparaissent en même temps que le fond
// à l'atterrissage, au lieu de traîner derrière le temps qu'une seconde source
// recharge et re-parse les mêmes tuiles.
function findBasemapPlanetSource(map: MLMap): string | null {
  const sources = map.getStyle()?.sources ?? {}
  for (const [id, src] of Object.entries(sources)) {
    if (src.type !== 'vector') continue
    if (typeof src.url === 'string' && src.url.includes('openfreemap.org/planet')) return id
    if (Array.isArray(src.tiles) && src.tiles[0]?.includes('openfreemap.org')) return id
  }
  return null
}
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
  // La couche peut déjà exister (le StartScreen la pose en palette de base comme
  // décor du cinématique d'intro). Ne pas court-circuiter : ré-appliquer la
  // couleur demandée pour que `colorByHeight` gagne (sinon les bâtiments restent
  // beiges au lieu de bleus à l'étape Bâtiments 3D, de façon intermittente).
  if (map.getLayer(LAYER_ID)) {
    map.setPaintProperty(LAYER_ID, 'fill-extrusion-color', colorExpr)
    return
  }
  // Source partagée avec le basemap quand elle existe (cf. findBasemapPlanetSource) ;
  // repli sur une source dédiée sinon (basemap sans « planet », ex. satellite).
  let srcId = findBasemapPlanetSource(map)
  if (!srcId) {
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet',
        promoteId: 'osm_id',
      })
    }
    srcId = SOURCE_ID
  }
  map.addLayer({
    id: LAYER_ID,
    source: srcId,
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
      'fill-extrusion-opacity': 1,
    },
  })
}

export function removeBuildings3D(map: MLMap) {
  if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID)
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
  showBasemapBuildings(map)
}
