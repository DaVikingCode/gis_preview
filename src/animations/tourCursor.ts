import type { Map as MLMap } from 'maplibre-gl'
import gsap from 'gsap'
import type { FeatureCollection, Point } from 'geojson'

// map.project() renvoie des px relatifs au conteneur #map-canvas ; on ajoute
// l'offset du canvas (sidebar…) pour obtenir des coordonnées viewport.
export function projectClient(map: MLMap, lngLat: [number, number]): { x: number; y: number } {
  const p = map.project(lngLat)
  const r = map.getCanvas().getBoundingClientRect()
  return { x: r.left + p.x, y: r.top + p.y }
}

// Angle (deg) orientant la pointe du SVG vers la direction (dx, dy). Le SVG pointe
// vers le haut au repos → +90.
export function cursorAngle(dx: number, dy: number): number {
  return Math.atan2(dy, dx) * (180 / Math.PI) + 90
}

// DOIT matcher `restAngle` des SmoothCursor scriptés (-35° = pointeur OS incliné
// haut-gauche). Le curseur y revient en arrivant.
export const CURSOR_REST_ANGLE = -35

// Fraction du trajet à partir de laquelle on commence à revenir vers la position
// naturelle (les ~30 derniers % du glissement).
const SETTLE_FROM = 0.7

// Angle dispatché pendant un glissement orienté : vise `aimDeg`, puis revient en douceur
// à CURSOR_REST_ANGLE sur la fin du trajet (t ≥ SETTLE_FROM) → le curseur « arrive »
// droit, dans sa position naturelle, juste avant le clic / la fin du geste.
export function settledAngle(aimDeg: number, t: number): number {
  if (t <= SETTLE_FROM) return aimDeg
  const k = (t - SETTLE_FROM) / (1 - SETTLE_FROM)
  const e = k * k * (3 - 2 * k) // smoothstep
  let d = CURSOR_REST_ANGLE - aimDeg
  while (d > 180) d -= 360
  while (d < -180) d += 360
  return aimDeg + d * e
}

// pointermove synthétique : seul le SmoothCursor `scripted` le suit (maplibre
// n'écoute pas pointermove → aucun effet de bord sur la carte). Sans `angleDeg`, le
// curseur conserve son dernier angle (voulu pendant une press / clic).
export function dispatchCursor(x: number, y: number, angleDeg?: number): void {
  const ev = new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true })
  if (angleDeg !== undefined) (ev as PointerEvent & { gpAngle?: number }).gpAngle = angleDeg
  window.dispatchEvent(ev)
}

// Pulse « clic » on-map : couche cercle animée (rayon + opacité) à chaque point posé.
// `pulse` = petit (par sommet), `burst` = grand (final).
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

// Pilote le faux curseur le long d'une timeline GSAP. `pos` est partagé entre les
// glissements pour un mouvement continu de sommet en sommet ; le premier glissement
// « sème » le curseur en léger décalage pour une entrée visible.
export type TourCursor = {
  glideTo: (
    tl: gsap.core.Timeline,
    lngLat: [number, number],
    opts: { at: number | string; duration: number },
  ) => void
  // Le curseur « presse » le point de fermeture (clic) en synchro avec une onde
  // forte. Ancré sur le label `at` pour se caler sur la propagation du remplissage.
  finishAt: (
    tl: gsap.core.Timeline,
    lngLat: [number, number],
    opts: { pulse: TourPulse; at: string },
  ) => void
  // Variantes « écran » : cible un point viewport fixe (ex. un bouton DOM) plutôt
  // qu'une coordonnée carte. `from` sème le curseur à un départ explicite.
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

export function createTourCursor(map: MLMap, opts?: { aim?: boolean }): TourCursor {
  const pos = { x: 0, y: 0 }
  let seeded = false
  // Mode `aim` : l'angle du segment (pos → cible) est dispatché pour orienter le
  // curseur. Les press dispatchent sans angle → le curseur conserve `aimDeg` (pas de
  // snap). En mode non-aim (Mesure/Dessin), aucun angle n'est émis.
  const aim = opts?.aim ?? false
  let aimDeg: number | undefined

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
      if (!aim) {
        // Chemin historique (Mesure/Dessin). function-based : reprojeté au démarrage
        // du tween (caméra figée → stable).
        tl.to(
          pos,
          {
            x: () => projectClient(map, lngLat).x,
            y: () => projectClient(map, lngLat).y,
            duration,
            ease: 'power2.inOut',
            onUpdate: () => dispatchCursor(pos.x, pos.y),
          },
          at,
        )
        return
      }
      // Chemin orienté : glissement en ligne droite (caméra figée → reprojetée une
      // fois au départ), retour à la position naturelle sur la fin (settledAngle).
      const start = { x: 0, y: 0 }
      const target = { x: 0, y: 0 }
      const prog = { t: 0 }
      tl.to(
        prog,
        {
          t: 1,
          duration,
          ease: 'power2.inOut',
          onStart: () => {
            start.x = pos.x
            start.y = pos.y
            const p = projectClient(map, lngLat)
            target.x = p.x
            target.y = p.y
            aimDeg = cursorAngle(target.x - start.x, target.y - start.y)
          },
          onUpdate: () => {
            pos.x = start.x + (target.x - start.x) * prog.t
            pos.y = start.y + (target.y - start.y) * prog.t
            dispatchCursor(pos.x, pos.y, settledAngle(aimDeg ?? CURSOR_REST_ANGLE, prog.t))
          },
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
      if (!aim) {
        // Chemin historique — INCHANGÉ.
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
        return
      }
      // Chemin orienté : progression + retour à la position naturelle sur la fin.
      const start = { x: 0, y: 0 }
      const prog = { t: 0 }
      tl.to(
        prog,
        {
          t: 1,
          duration,
          ease: 'power2.inOut',
          onStart: () => {
            start.x = pos.x
            start.y = pos.y
            aimDeg = cursorAngle(point.x - start.x, point.y - start.y)
          },
          onUpdate: () => {
            pos.x = start.x + (point.x - start.x) * prog.t
            pos.y = start.y + (point.y - start.y) * prog.t
            dispatchCursor(pos.x, pos.y, settledAngle(aimDeg ?? CURSOR_REST_ANGLE, prog.t))
          },
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
