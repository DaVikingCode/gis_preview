import type { StyleSpecification } from 'maplibre-gl'

export type BasemapId = 'positron' | 'liberty' | 'bright' | 'satellite'

export const BASEMAPS: Record<BasemapId, { label: string; style: string | StyleSpecification }> = {
  positron: {
    label: 'Positron',
    style: 'https://tiles.openfreemap.org/styles/positron',
  },
  liberty: {
    label: 'Liberty',
    style: 'https://tiles.openfreemap.org/styles/liberty',
  },
  bright: {
    label: 'Bright',
    style: 'https://tiles.openfreemap.org/styles/bright',
  },
  satellite: {
    label: 'Satellite',
    style: {
      version: 8,
      sources: {
        sat: {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics',
        },
      },
      layers: [{ id: 'sat', type: 'raster', source: 'sat' }],
    } satisfies StyleSpecification,
  },
}
