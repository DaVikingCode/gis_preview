import type { Map as MLMap } from 'maplibre-gl'
import { SAMPLE_VECTORS, type VectorCategory } from '@/data/sample-vectors'

const SRC = 'gp-vector-styled'
const FILL = 'gp-vector-styled-fill'
const LINE = 'gp-vector-styled-line'

export const CATEGORY_COLORS: Record<VectorCategory, string> = {
  agricole: '#facc15',
  urbain: '#ef4444',
  industriel: '#3b82f6',
  forêt: '#22c55e',
}

export function addVectorStyled(map: MLMap) {
  if (!map.getSource(SRC)) {
    map.addSource(SRC, { type: 'geojson', data: SAMPLE_VECTORS })
  }
  if (!map.getLayer(FILL)) {
    map.addLayer({
      id: FILL,
      type: 'fill',
      source: SRC,
      paint: {
        'fill-color': [
          'match',
          ['get', 'category'],
          'agricole',
          CATEGORY_COLORS.agricole,
          'urbain',
          CATEGORY_COLORS.urbain,
          'industriel',
          CATEGORY_COLORS.industriel,
          'forêt',
          CATEGORY_COLORS.forêt,
          '#888',
        ],
        'fill-opacity': 0.6,
      },
    })
  }
  if (!map.getLayer(LINE)) {
    map.addLayer({
      id: LINE,
      type: 'line',
      source: SRC,
      paint: { 'line-color': '#0b0d12', 'line-opacity': 0.5, 'line-width': 1.4 },
    })
  }
}

export function removeVectorStyled(map: MLMap) {
  for (const id of [LINE, FILL]) if (map.getLayer(id)) map.removeLayer(id)
  if (map.getSource(SRC)) map.removeSource(SRC)
}
