import type { Map as MLMap, MapMouseEvent } from 'maplibre-gl'
import gsap from 'gsap'
import * as turf from '@turf/turf'
import type { FeatureCollection, LineString, Point, Polygon } from 'geojson'
import { createTourCursor, createTourPulse, type TourPulse } from '@/animations/tourCursor'
import { createMeasureReveal } from '@/animations/measureReveal'
import { createMeasureLabels, type MeasureLabels } from '@/animations/measureLabels'

const SRC_PTS = 'gp-measure-pts'
const SRC_LINE = 'gp-measure-line'
const SRC_DOTS = 'gp-measure-dots'
const SRC_FILL = 'gp-measure-fill'
const LYR_PTS = 'gp-measure-pts-circle'
const LYR_LINE = 'gp-measure-line'
const LYR_DOTS = 'gp-measure-dots'
const LYR_FILL = 'gp-measure-fill'

const DOT_COLOR = '#FFEB04'
const FILL_COLOR = '#FFEB04'
const FILL_BASE = 0.18
const FILL_DARK = 0.3

// Polygone irrégulier « à la main » à Marseille (7 sommets, ring OUVERT —
// refresh() ré-ajoute ring[0] pour fermer la boucle). ~900 m de large : centre
// caméra ≈ [5.3689, 43.2944] (step 'measure' dans steps.ts), zoom ~15.5.
export const MEASURE_DEMO_BLOCK: [number, number][] = [
  [5.3655513, 43.2923412],
  [5.3699935, 43.2930705],
  [5.3745359, 43.2942252],
  [5.3742687, 43.2960241],
  [5.3728826, 43.2963766],
  [5.3688412, 43.296012],
  [5.3632133, 43.2950882],
]

export type MeasureHandle = {
  detach: () => void
}

export type MeasureOptions = {
  // Trace automatiquement le périmètre d'un pâté au lieu d'attendre les clics.
  // En mode auto les handlers de clic ne sont pas posés (rien ne perturbe le tracé).
  auto?: boolean
  path?: [number, number][]
  stepMs?: number
  // Tracé terminé : remplissage propagé, on déverrouille la suite (Next + chart).
  onComplete?: () => void
  // Dernier clic posé : on masque le faux curseur tout de suite, sans attendre le
  // remplissage qui suit.
  onLastClick?: () => void
}

export function addMeasureTool(
  map: MLMap,
  onChange: (pts: { lng: number; lat: number }[], lengthKm: number) => void,
  opts?: MeasureOptions,
): MeasureHandle {
  const points: { lng: number; lat: number }[] = []
  const interactive = !opts?.auto
  let closed = false
  let tl: gsap.core.Timeline | null = null
  let pulse: TourPulse | null = null
  let labels: MeasureLabels | null = null

  const emptyPts: FeatureCollection<Point> = { type: 'FeatureCollection', features: [] }
  const emptyLine: FeatureCollection<LineString> = {
    type: 'FeatureCollection',
    features: [],
  }
  const emptyFill: FeatureCollection<Polygon> = { type: 'FeatureCollection', features: [] }

  if (!map.getSource(SRC_FILL)) map.addSource(SRC_FILL, { type: 'geojson', data: emptyFill })
  if (!map.getSource(SRC_DOTS)) map.addSource(SRC_DOTS, { type: 'geojson', data: emptyPts })
  if (!map.getSource(SRC_PTS)) map.addSource(SRC_PTS, { type: 'geojson', data: emptyPts })
  if (!map.getSource(SRC_LINE)) map.addSource(SRC_LINE, { type: 'geojson', data: emptyLine })

  // Ordre de rendu : aplat (fond) SOUS la trame de points, elle-même SOUS la ligne
  // et les sommets. Aplat à opacité 0 + points à rayon/opacité 0 au départ : rien
  // n'apparaît avant le reveal (vague de points → flood qui les absorbe).
  if (!map.getLayer(LYR_FILL)) {
    map.addLayer({
      id: LYR_FILL,
      type: 'fill',
      source: SRC_FILL,
      paint: { 'fill-color': FILL_COLOR, 'fill-opacity': 0 },
    })
  }
  if (!map.getLayer(LYR_DOTS)) {
    map.addLayer({
      id: LYR_DOTS,
      type: 'circle',
      source: SRC_DOTS,
      paint: {
        'circle-color': DOT_COLOR,
        'circle-radius': 0,
        'circle-opacity': 0,
        'circle-blur': 0.2,
      },
    })
  }
  if (!map.getLayer(LYR_LINE)) {
    map.addLayer({
      id: LYR_LINE,
      type: 'line',
      source: SRC_LINE,
      paint: { 'line-color': '#FFEB04', 'line-width': 3 },
    })
  }
  if (!map.getLayer(LYR_PTS)) {
    map.addLayer({
      id: LYR_PTS,
      type: 'circle',
      source: SRC_PTS,
      paint: {
        'circle-radius': 5,
        'circle-color': '#fff',
        'circle-stroke-color': '#FFEB04',
        'circle-stroke-width': 2,
      },
    })
  }
  const setData = (id: string, data: FeatureCollection) =>
    (map.getSource(id) as maplibregl.GeoJSONSource | undefined)?.setData(data)

  const refresh = () => {
    setData(SRC_PTS, {
      type: 'FeatureCollection',
      features: points.map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: {},
      })),
    })

    let km = 0
    let lineFC: FeatureCollection<LineString> = {
      type: 'FeatureCollection',
      features: [],
    }

    if (points.length >= 2) {
      const coords = points.map((p) => [p.lng, p.lat] as [number, number])
      // Boucle fermée : on ré-ajoute le 1er point → le segment final rejoint le
      // départ et la distance devient le périmètre.
      const ring = closed && points.length >= 3 ? [...coords, coords[0]] : coords
      const line = turf.lineString(ring)
      km = turf.length(line, { units: 'kilometers' })
      lineFC = {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: line.geometry, properties: {} }],
      }
    }
    setData(SRC_LINE, lineFC)
    onChange([...points], km)
  }

  const onClick = (e: MapMouseEvent) => {
    points.push({ lng: e.lngLat.lng, lat: e.lngLat.lat })
    refresh()
  }
  const onDblClick = (e: MapMouseEvent) => {
    e.preventDefault()
    points.length = 0
    refresh()
  }

  if (interactive) {
    map.getCanvas().style.cursor = 'crosshair'
    map.doubleClickZoom.disable()
    map.on('click', onClick)
    map.on('dblclick', onDblClick)
  } else {
    // Mode auto : tracé scripté du périmètre, aucun input utilisateur. On révèle
    // le pâté sommet par sommet, on ferme la boucle, puis la trame de points éclot.
    const ring = opts?.path ?? MEASURE_DEMO_BLOCK
    const stepSec = (opts?.stepMs ?? 700) / 1000
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    labels = createMeasureLabels(map, ring)
    const reveal = createMeasureReveal(map, {
      ring,
      dotsSource: SRC_DOTS,
      dotsLayer: LYR_DOTS,
      fillSource: SRC_FILL,
      fillLayer: LYR_FILL,
      fillBase: FILL_BASE,
      fillDark: FILL_DARK,
    })
    if (reduced) {
      for (const [lng, lat] of ring) points.push({ lng, lat })
      closed = true
      refresh()
      reveal.showStatic()
      // Labels de segment posés d'emblée, sans animation.
      for (let i = 1; i < ring.length; i++) labels.addSegment(null, ring[i - 1], ring[i], { at: 0 })
      labels.addSegment(null, ring[ring.length - 1], ring[0], { at: 0 })
      opts?.onLastClick?.()
      opts?.onComplete?.()
    } else {
      tl = gsap.timeline()
      const cursor = createTourCursor(map)
      const click = createTourPulse(map, '#FFEB04')
      pulse = click
      const GLIDE = Math.min(0.4, stepSec * 0.5)
      ring.forEach(([lng, lat], i) => {
        const at = i * stepSec
        // Le faux curseur glisse vers le sommet…
        cursor.glideTo(tl!, [lng, lat], { at, duration: GLIDE })
        // …puis « clique » : point posé + pulse, juste après son arrivée.
        tl!.call(
          () => {
            points.push({ lng, lat })
            refresh()
            click.pulse([lng, lat])
          },
          [],
          at + GLIDE,
        )
        // Le segment fraîchement tracé (sommet précédent → courant) affiche sa
        // longueur en pop juste à côté de l'arête.
        if (i > 0) labels!.addSegment(tl, ring[i - 1], ring[i], { at: at + GLIDE })
      })
      // Beat A : le curseur revient au 1er point → la boucle se referme (trame invisible).
      cursor.glideTo(tl, ring[0], { at: '>', duration: GLIDE })
      tl.call(() => {
        closed = true
        refresh()
      })
      // Segment de fermeture (dernier sommet → 1er) : son label arrive avec la boucle.
      labels.addSegment(tl, ring[ring.length - 1], ring[0], { at: '<' })
      // Beat B : final — le curseur « presse » le coin de fermeture (onde), puis la
      // trame de points éclot en vague DEPUIS ce coin.
      const REVEAL = 'reveal'
      tl.addLabel(REVEAL)
      cursor.finishAt(tl, ring[0], { pulse: click, at: REVEAL })
      // Le dernier clic est posé : on cache le curseur dès maintenant (il s'efface
      // pendant que la trame se propage, au lieu d'attendre la fin).
      tl.call(() => opts?.onLastClick?.(), [], REVEAL)
      reveal.reveal(tl, REVEAL)
      // Beat C : déverrouille la suite une fois le final joué.
      tl.call(() => opts?.onComplete?.())
    }
  }

  return {
    detach() {
      tl?.kill()
      tl = null
      pulse?.remove()
      pulse = null
      labels?.remove()
      labels = null
      if (interactive) {
        map.off('click', onClick)
        map.off('dblclick', onDblClick)
        map.doubleClickZoom.enable()
        map.getCanvas().style.cursor = ''
      }
      for (const id of [LYR_PTS, LYR_LINE, LYR_DOTS, LYR_FILL])
        if (map.getLayer(id)) map.removeLayer(id)
      for (const id of [SRC_PTS, SRC_LINE, SRC_DOTS, SRC_FILL])
        if (map.getSource(id)) map.removeSource(id)
      points.length = 0
      onChange([], 0)
    },
  }
}
