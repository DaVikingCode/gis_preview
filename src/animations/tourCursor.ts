import type { Map as MLMap } from 'maplibre-gl'
import gsap from 'gsap'
import * as turf from '@turf/turf'
import type { Feature, FeatureCollection, MultiPolygon, Point, Polygon } from 'geojson'

// Helpers partagés par les tracés auto (Mesure, Dessin) pour piloter le faux
// curseur de démo (SmoothCursor scripté) et marquer chaque « clic » sur la carte.

// lngLat → coordonnées viewport (clientX/clientY). map.project() renvoie des px
// relatifs au conteneur #map-canvas ; on ajoute l'offset du canvas (sidebar…).
export function projectClient(map: MLMap, lngLat: [number, number]): { x: number; y: number } {
  const p = map.project(lngLat)
  const r = map.getCanvas().getBoundingClientRect()
  return { x: r.left + p.x, y: r.top + p.y }
}

// Dispatch d'un pointermove synthétique : seul le SmoothCursor `scripted` le suit
// (maplibre n'écoute pas pointermove → aucun effet de bord sur la carte).
export function dispatchCursor(x: number, y: number): void {
  window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true }))
}

// Pulse « clic » on-map : une couche cercle 1-feature qu'on anime (rayon + opacité)
// à chaque point posé. `pulse` = petit (par sommet), `burst` = grand (final).
// Partagée par les deux steps (jamais simultanés).
export type TourPulse = {
  pulse: (lngLat: [number, number]) => void
  burst: (lngLat: [number, number]) => void
  remove: () => void
}

export function createTourPulse(map: MLMap, color: string, id = 'gp-tour-pulse'): TourPulse {
  const empty: FeatureCollection<Point> = { type: 'FeatureCollection', features: [] }
  if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: empty })
  if (!map.getLayer(id)) {
    map.addLayer({
      id,
      type: 'circle',
      source: id,
      paint: {
        'circle-radius': 0,
        'circle-color': color,
        'circle-opacity': 0,
        'circle-stroke-width': 0,
      },
    })
  }

  const tweens: gsap.core.Tween[] = []

  const setPoint = (lngLat: [number, number]) =>
    (map.getSource(id) as maplibregl.GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: lngLat }, properties: {} },
      ],
    })

  const ring = (
    lngLat: [number, number],
    fromR: number,
    toR: number,
    fromO: number,
    dur: number,
  ) => {
    setPoint(lngLat)
    const s = { r: fromR, o: fromO }
    tweens.push(
      gsap.to(s, {
        r: toR,
        o: 0,
        duration: dur,
        ease: 'power2.out',
        onUpdate: () => {
          // La couche peut être retirée pendant une frame résiduelle.
          if (!map.getLayer(id)) return
          map.setPaintProperty(id, 'circle-radius', s.r)
          map.setPaintProperty(id, 'circle-opacity', s.o)
        },
      }),
    )
  }

  return {
    pulse: (lngLat) => ring(lngLat, 6, 26, 0.5, 0.5),
    burst: (lngLat) => ring(lngLat, 10, 52, 0.65, 0.75),
    remove() {
      for (const tw of tweens) tw.kill()
      tweens.length = 0
      if (map.getLayer(id)) map.removeLayer(id)
      if (map.getSource(id)) map.removeSource(id)
    },
  }
}

// Pilote le faux curseur le long d'une timeline GSAP. Une instance par tracé :
// `pos` est partagé entre les glissements pour un mouvement continu de sommet en
// sommet. Le tout premier glissement « sème » le curseur en léger décalage pour
// une entrée visible, puis glisse jusqu'à la cible.
export type TourCursor = {
  glideTo: (
    tl: gsap.core.Timeline,
    lngLat: [number, number],
    opts: { at: number | string; duration: number },
  ) => void
  // Petit final quand le polygone est terminé : le curseur « presse » le point de
  // fermeture (clic visible) en synchro avec une onde forte. Ancré sur un label
  // (`at`) pour se synchroniser avec la propagation du remplissage.
  finishAt: (
    tl: gsap.core.Timeline,
    lngLat: [number, number],
    opts: { pulse: TourPulse; at: string },
  ) => void
  // Variantes « écran » : cible un point viewport fixe (ex. un bouton DOM via
  // getBoundingClientRect) plutôt qu'une coordonnée carte. `from` sème le curseur
  // à un point de départ explicite (ex. le poste rouge) pour une entrée visible.
  glideToPoint: (
    tl: gsap.core.Timeline,
    point: { x: number; y: number },
    opts: { at: number | string; duration: number; from?: { x: number; y: number } },
  ) => void
  pressAtPoint: (
    tl: gsap.core.Timeline,
    point: { x: number; y: number },
    opts: { at: string },
  ) => void
}

const SEED_OFFSET = { dx: 48, dy: -44 }
const PRESS_PX = 8

export function createTourCursor(map: MLMap): TourCursor {
  const pos = { x: 0, y: 0 }
  let seeded = false

  return {
    glideTo(tl, lngLat, { at, duration }) {
      if (!seeded) {
        seeded = true
        tl.call(
          () => {
            const t = projectClient(map, lngLat)
            pos.x = t.x + SEED_OFFSET.dx
            pos.y = t.y + SEED_OFFSET.dy
            dispatchCursor(pos.x, pos.y)
          },
          [],
          at,
        )
      }
      tl.to(
        pos,
        {
          // function-based : reprojeté au démarrage du tween (caméra figée → stable).
          x: () => projectClient(map, lngLat).x,
          y: () => projectClient(map, lngLat).y,
          duration,
          ease: 'power2.inOut',
          onUpdate: () => dispatchCursor(pos.x, pos.y),
        },
        at,
      )
    },

    finishAt(tl, lngLat, { pulse, at }) {
      // Recale pile sur le point de fermeture.
      tl.call(
        () => {
          const b = projectClient(map, lngLat)
          pos.x = b.x
          pos.y = b.y
          dispatchCursor(pos.x, pos.y)
        },
        [],
        at,
      )
      // Le curseur s'enfonce (clic) — l'onde part au même instant (déclenche le flood).
      tl.to(
        pos,
        {
          y: `+=${PRESS_PX}`,
          duration: 0.1,
          ease: 'power2.in',
          onUpdate: () => dispatchCursor(pos.x, pos.y),
        },
        at,
      )
      tl.call(() => pulse.burst(lngLat), [], at)
      // …puis remonte avec un petit rebond.
      tl.to(
        pos,
        {
          y: `-=${PRESS_PX}`,
          duration: 0.26,
          ease: 'back.out(2.4)',
          onUpdate: () => dispatchCursor(pos.x, pos.y),
        },
        `${at}+=0.1`,
      )
    },

    glideToPoint(tl, point, { at, duration, from }) {
      if (!seeded) {
        seeded = true
        tl.call(
          () => {
            const s = from ?? { x: point.x + SEED_OFFSET.dx, y: point.y + SEED_OFFSET.dy }
            pos.x = s.x
            pos.y = s.y
            dispatchCursor(pos.x, pos.y)
          },
          [],
          at,
        )
      }
      tl.to(
        pos,
        {
          x: point.x,
          y: point.y,
          duration,
          ease: 'power2.inOut',
          onUpdate: () => dispatchCursor(pos.x, pos.y),
        },
        at,
      )
    },

    pressAtPoint(tl, point, { at }) {
      tl.call(
        () => {
          pos.x = point.x
          pos.y = point.y
          dispatchCursor(pos.x, pos.y)
        },
        [],
        at,
      )
      tl.to(
        pos,
        {
          y: `+=${PRESS_PX}`,
          duration: 0.1,
          ease: 'power2.in',
          onUpdate: () => dispatchCursor(pos.x, pos.y),
        },
        at,
      )
      tl.to(
        pos,
        {
          y: `-=${PRESS_PX}`,
          duration: 0.26,
          ease: 'back.out(2.4)',
          onUpdate: () => dispatchCursor(pos.x, pos.y),
        },
        `${at}+=0.1`,
      )
    },
  }
}

// Révélation du remplissage par PROPAGATION depuis le coin de fin de tracé : un
// cercle (Turf) grandit depuis `ring[0]` et est intersecté avec le polygone, si
// bien que la couleur « inonde » la zone depuis ce coin. Une fois propagée, on
// assombrit le remplissage d'un cran. Ajoute ses tweens à la timeline, ancrés au
// label `at` (synchro avec le clic final du curseur).
export function addFloodReveal(
  tl: gsap.core.Timeline,
  map: MLMap,
  opts: {
    ring: [number, number][]
    source: string
    layer: string
    base: number
    dark: number
    at: string
  },
): void {
  const origin = opts.ring[0]
  const closed: [number, number][] = [...opts.ring, opts.ring[0]]
  const polygon = turf.polygon([closed])
  const maxR =
    Math.max(...opts.ring.map((v) => turf.distance(origin, v, { units: 'kilometers' }))) * 1.18

  const empty: FeatureCollection = { type: 'FeatureCollection', features: [] }
  const setRegion = (t: number) => {
    if (!map.getLayer(opts.layer)) return
    const src = map.getSource(opts.source) as maplibregl.GeoJSONSource | undefined
    if (!src) return
    let feat: Feature<Polygon | MultiPolygon> | null = null
    if (t >= 1) feat = polygon
    else if (t > 0.001) {
      const circ = turf.circle(origin, maxR * t, { units: 'kilometers', steps: 56 })
      feat = turf.intersect(turf.featureCollection([polygon, circ]))
    }
    src.setData(feat ? { type: 'FeatureCollection', features: [feat] } : empty)
  }

  // 1) Opacité ON + géométrie vide : prêt à inonder depuis le coin.
  tl.call(
    () => {
      if (map.getLayer(opts.layer)) map.setPaintProperty(opts.layer, 'fill-opacity', opts.base)
      setRegion(0)
    },
    [],
    opts.at,
  )
  // 2) Propagation depuis le coin de fin de tracé.
  const prog = { v: 0 }
  tl.to(
    prog,
    { v: 1, duration: 0.8, ease: 'power2.out', onUpdate: () => setRegion(prog.v) },
    opts.at,
  )
  // 3) Une fois propagé, on assombrit la zone d'un cran.
  const dk = { v: opts.base }
  tl.to(
    dk,
    {
      v: opts.dark,
      duration: 0.42,
      ease: 'power2.inOut',
      onUpdate: () => {
        if (map.getLayer(opts.layer)) map.setPaintProperty(opts.layer, 'fill-opacity', dk.v)
      },
    },
    `${opts.at}+=0.85`,
  )
}
