import type { Map as MLMap } from 'maplibre-gl'
import { ESRI_ATTRIBUTION, ESRI_WORLD_IMAGERY_TILES } from '@/map/basemaps'

// Calque satellite « HD » : même imagerie Esri que le fond `satellite`, mais avec un
// `maxzoom` → MapLibre SURZOOME la dernière tuile dispo au lieu d'en demander d'inexistantes
// (404) au-delà de la résolution native d'Esri. Posé PAR-DESSUS la source `sat` de base le
// temps du step nuage de points : lors du survol de la ligne (zoom ~20) l'imagerie reste
// visible au ras du sol au lieu de devenir grise. On ne touche pas la source `sat` partagée
// → les autres steps satellite (flyover-3d) sont intacts.

const SRC = 'gp-sat-hd'
const LYR = 'gp-sat-hd'

export function addSatelliteHd(map: MLMap, maxzoom = 18) {
  if (!map.getSource(SRC)) {
    map.addSource(SRC, {
      type: 'raster',
      tiles: [ESRI_WORLD_IMAGERY_TILES],
      tileSize: 256,
      maxzoom,
      attribution: ESRI_ATTRIBUTION,
    })
  }
  // Ajouté au sommet de la pile courante (au-dessus de `sat`). Le rendu se fait avant
  // l'ajout de la couche nuage de points → les points restent au-dessus.
  if (!map.getLayer(LYR)) {
    map.addLayer({ id: LYR, type: 'raster', source: SRC })
  }
}

export function removeSatelliteHd(map: MLMap) {
  if (map.getLayer(LYR)) map.removeLayer(LYR)
  if (map.getSource(SRC)) map.removeSource(SRC)
}
