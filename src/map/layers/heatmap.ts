import type { Map as MLMap } from 'maplibre-gl'
import { SAMPLE_POINTS } from '@/data/sample-points'

const SRC = 'gp-heatmap-src'
const LYR = 'gp-heatmap-layer'
const PT = 'gp-heatmap-points'

export function addHeatmap(map: MLMap) {
  if (!map.getSource(SRC)) {
    map.addSource(SRC, { type: 'geojson', data: SAMPLE_POINTS })
  }
  if (!map.getLayer(LYR)) {
    map.addLayer({
      id: LYR,
      type: 'heatmap',
      source: SRC,
      maxzoom: 12,
      paint: {
        'heatmap-weight': ['interpolate', ['linear'], ['get', 'weight'], 0, 0, 1, 1],
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 12, 3],
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0,
          'rgba(33,102,172,0)',
          0.2,
          'rgb(103,169,207)',
          0.4,
          'rgb(209,229,240)',
          0.6,
          'rgb(253,219,199)',
          0.8,
          'rgb(239,138,98)',
          1,
          'rgb(178,24,43)',
        ],
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 9, 30],
        'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 7, 1, 12, 0.4],
      },
    })
  }
  if (!map.getLayer(PT)) {
    map.addLayer({
      id: PT,
      type: 'circle',
      source: SRC,
      minzoom: 9,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 2, 14, 6],
        'circle-color': '#b91c1c',
        'circle-opacity': 0.7,
      },
    })
  }
}

export function removeHeatmap(map: MLMap) {
  for (const id of [PT, LYR]) if (map.getLayer(id)) map.removeLayer(id)
  if (map.getSource(SRC)) map.removeSource(SRC)
}
