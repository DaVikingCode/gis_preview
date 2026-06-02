import type { ExpressionSpecification, Map as MLMap } from 'maplibre-gl'
import { SAMPLE_VECTORS, ZONES, type VectorCategory } from '@/data/sample-vectors'

const SRC = 'gp-vector-styled'
const FILL = 'gp-vector-styled-fill'
const LINE = 'gp-vector-styled-line'

// Palette cartographique d'occupation du sol : teintes riches et terreuses (et non
// les défauts criards de Tailwind) qui tiennent sur le fond clair (positron) sans
// virer au pastel délavé, et restent lisibles en pastille sur l'UI sombre du tableau.
export const CATEGORY_COLORS: Record<VectorCategory, string> = {
  agricole: '#e0a82e', // or blé / ocre chaud
  urbain: '#d2604a', // terre cuite / argile
  industriel: '#5685a6', // bleu acier ardoise
  forêt: '#4f9d69', // vert mousse / pin
}

// Contour : variante assombrie et saturée de chaque teinte → liseré net et « dessiné »
// au lieu du noir terne d'avant. Chaque zone est cerclée de sa propre couleur.
const CATEGORY_STROKE: Record<VectorCategory, string> = {
  agricole: '#9a6c12',
  urbain: '#8c3422',
  industriel: '#2c4f66',
  forêt: '#27613c',
}

// Expressions MapLibre partagées. Cast en ExpressionSpecification car, extraites en
// const, les littéraux se généralisent en `string[]` et ne matchent plus les tuples
// stricts attendus par le style spec.
const categoryColor = [
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
] as ExpressionSpecification
const categoryStroke = [
  'match',
  ['get', 'category'],
  'agricole',
  CATEGORY_STROKE.agricole,
  'urbain',
  CATEGORY_STROKE.urbain,
  'industriel',
  CATEGORY_STROKE.industriel,
  'forêt',
  CATEGORY_STROKE.forêt,
  '#555',
] as ExpressionSpecification
const HOVER = ['boolean', ['feature-state', 'hover'], false] as ExpressionSpecification
const DIM = ['boolean', ['feature-state', 'dim'], false] as ExpressionSpecification
const GREY = '#94a3b8' // teinte des zones ternies (spotlight)

// Dernière zone survolée, gardée pour ne rien recalculer si l'id ne change pas.
let hoveredId: string | null = null

export function addVectorStyled(map: MLMap) {
  if (!map.getSource(SRC)) {
    // promoteId : remonte properties.id comme id de feature → adressable par feature-state.
    map.addSource(SRC, { type: 'geojson', data: SAMPLE_VECTORS, promoteId: 'id' })
  }
  if (!map.getLayer(FILL)) {
    map.addLayer({
      id: FILL,
      type: 'fill',
      source: SRC,
      paint: {
        // Spotlight : la zone ternie passe au gris, sinon couleur de catégorie.
        'fill-color': ['case', DIM, GREY, categoryColor] as ExpressionSpecification,
        'fill-color-transition': { duration: 240, delay: 0 },
        // Survolée vive ; ternies très estompées ; sinon état de base.
        'fill-opacity': ['case', HOVER, 0.85, DIM, 0.12, 0.5] as ExpressionSpecification,
        'fill-opacity-transition': { duration: 240, delay: 0 },
      },
    })
  }
  if (!map.getLayer(LINE)) {
    map.addLayer({
      id: LINE,
      type: 'line',
      source: SRC,
      // Jointures/extrémités arrondies → liseré propre dans les angles des parcelles.
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        // État de base : liseré net dans la teinte assombrie de la catégorie, au lieu
        // de l'ancien contour noir à 0.4 qui bavait en gris sale. Hover/spotlight
        // (survol, ternissement) inchangés par rapport à l'origine.
        'line-color': [
          'case',
          HOVER,
          categoryColor,
          DIM,
          '#0b0d12',
          categoryStroke,
        ] as ExpressionSpecification,
        'line-color-transition': { duration: 240, delay: 0 },
        'line-width': ['case', HOVER, 2.8, 1.4] as ExpressionSpecification,
        'line-width-transition': { duration: 240, delay: 0 },
        'line-opacity': ['case', HOVER, 1, DIM, 0.15, 0.9] as ExpressionSpecification,
        'line-opacity-transition': { duration: 240, delay: 0 },
      },
    })
  }
}

// Survol piloté par le faux curseur (lignes du tableau) : effet spotlight — la zone
// survolée reste vive (contour net), TOUTES les autres se ternissent. `id = null`
// remet tout l'ensemble à l'état de base.
export function setVectorHover(map: MLMap, id: string | null) {
  if (!map.getSource(SRC) || id === hoveredId) return
  hoveredId = id
  for (const z of ZONES) {
    map.setFeatureState(
      { source: SRC, id: z.id },
      { hover: id === z.id, dim: id !== null && id !== z.id },
    )
  }
}

export function removeVectorStyled(map: MLMap) {
  hoveredId = null
  for (const id of [LINE, FILL]) if (map.getLayer(id)) map.removeLayer(id)
  if (map.getSource(SRC)) map.removeSource(SRC)
}
