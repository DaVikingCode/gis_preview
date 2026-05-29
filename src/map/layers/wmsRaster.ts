import type { Map as MLMap } from 'maplibre-gl'

const SRC = 'gp-ign-wms'
const LYR = 'gp-ign-wms-layer'

// IGN Géoportail open WMTS — orthophotos (no API key required since 2024).
const IGN_ORTHO_TILES =
  'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0' +
  '&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&TILEMATRIXSET=PM' +
  '&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'

export function addIgnRaster(map: MLMap, opacity = 0.6) {
  if (!map.getSource(SRC)) {
    map.addSource(SRC, {
      type: 'raster',
      tiles: [IGN_ORTHO_TILES],
      tileSize: 256,
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

export function setIgnRasterOpacity(map: MLMap, opacity: number) {
  if (map.getLayer(LYR)) map.setPaintProperty(LYR, 'raster-opacity', opacity)
}

export function removeIgnRaster(map: MLMap) {
  if (map.getLayer(LYR)) map.removeLayer(LYR)
  if (map.getSource(SRC)) map.removeSource(SRC)
}
