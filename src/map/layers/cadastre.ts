import type { Map as MLMap } from 'maplibre-gl'

const SRC = 'gp-cadastre'
const LYR = 'gp-cadastre-layer'

// IGN Géoportail WMTS (PARCELLAIRE_EXPRESS). PNG transparent : se fond sur le fond de carte.
const CADASTRE_TILES =
  'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0' +
  '&LAYER=CADASTRALPARCELS.PARCELLAIRE_EXPRESS&STYLE=normal&TILEMATRIXSET=PM' +
  '&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'

export function addCadastre(map: MLMap, opacity = 0.9) {
  if (!map.getSource(SRC)) {
    map.addSource(SRC, {
      type: 'raster',
      tiles: [CADASTRE_TILES],
      tileSize: 256,
      minzoom: 13,
      attribution: 'IGN-F/Géoportail',
    })
  }
  if (!map.getLayer(LYR)) {
    // Démarre transparent puis monte vers `opacity` : les parcelles se révèlent en
    // fondu (raster-opacity-transition) au lieu de surgir d'un coup quand la modale
    // catalogue se dissout sur la carte déjà en vol.
    map.addLayer({
      id: LYR,
      type: 'raster',
      source: SRC,
      paint: {
        'raster-opacity': 0,
        'raster-opacity-transition': { duration: 700, delay: 0 },
      },
    })
    requestAnimationFrame(() => {
      if (map.getLayer(LYR)) map.setPaintProperty(LYR, 'raster-opacity', opacity)
    })
  }
}

export function removeCadastre(map: MLMap) {
  if (map.getLayer(LYR)) map.removeLayer(LYR)
  if (map.getSource(SRC)) map.removeSource(SRC)
}
