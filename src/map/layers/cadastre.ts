import type { Map as MLMap } from 'maplibre-gl'

const SRC = 'gp-cadastre'
const LYR = 'gp-cadastre-layer'

// IGN Géoportail open WMTS — cadastral parcels (PARCELLAIRE_EXPRESS).
// PNG with transparency so it blends over the basemap. Visible at high zoom.
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
    map.addLayer({
      id: LYR,
      type: 'raster',
      source: SRC,
      paint: { 'raster-opacity': opacity },
    })
  }
}

export function removeCadastre(map: MLMap) {
  if (map.getLayer(LYR)) map.removeLayer(LYR)
  if (map.getSource(SRC)) map.removeSource(SRC)
}
