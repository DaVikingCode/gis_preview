import type { FeatureCollection } from 'geojson'
import type { GeoJSONSource, Map as MLMap } from 'maplibre-gl'
import gsap from 'gsap'
import * as turf from '@turf/turf'
import { createTourPulse, type TourPulse } from '@/animations/tourCursor'
import { CHAMONIX_TRAIL } from '@/data/sample-trail'
import { HIKE_POIS } from '@/data/sample-hike-pois'
import { closeHikePoiPopup, openHikePoiPopup } from '@/map/openHikePoiPopup'
import { useMapDataStore } from '@/store/map-data-store'
import { useTourStore } from '@/store/tour-store'

// Step « Terrain 3D · randonnée » : relief drapé (DEM Mapterhorn + ombrage + ciel) et un
// randonneur qui monte une seule fois de Chamonix vers le sommet, sa traînée se révélant
// derrière lui, avec un arrêt sur chaque point d'intérêt (fiche + pastille). La caméra SUIT
// le randonneur mais sur une ligne directrice fortement lissée (centre + cap), pour un
// panoramique posé plutôt qu'un suivi qui épouse chaque lacet. Module impératif (timeline
// GSAP jouée une fois, détachement gardé) avec une polyligne pré-calculée échantillonnée par
// math simple — pas d'allocation Turf par frame. `onProgress` remonte la fraction parcourue
// [0..1] au panneau (profil d'élévation) ; en fin de montée, déverrouille « Suivant » (cf.
// tour-store `hikeDone`).
export type HikingHandle = { detach: () => void }

const SRC_DEM = 'gp-dem'
const LYR_HILLSHADE = 'gp-hillshade'
const SRC_TRAIL = 'gp-hike-trail'
const LYR_TRAIL_CASING = 'gp-hike-trail-casing'
const LYR_TRAIL = 'gp-hike-trail-line'
const SRC_TRAVELED = 'gp-hike-traveled'
const LYR_TRAVELED = 'gp-hike-traveled-line'
const SRC_HIKER = 'gp-hiker'
const LYR_HIKER_GLOW = 'gp-hiker-glow'
const LYR_HIKER = 'gp-hiker-sym'
const HIKER_IMG = 'gp-hiker-icon'
const SRC_POIS = 'gp-hike-pois'
const LYR_POI_RING = 'gp-hike-poi-ring'
const LYR_POI_DOT = 'gp-hike-poi-dot'

// TileJSON Mapterhorn (encoding terrarium, tileSize 512) — lu par MapLibre via `url`,
// exactement comme l'exemple officiel 3d-terrain.
const DEM_URL = 'https://tiles.mapterhorn.com/tilejson.json'
const TRAIL_COLOR = '#fbbf24' // sentier prévu (ambre, pointillé)
const TRAVELED_COLOR = '#22d3ee' // chemin parcouru + randonneur (cyan)
const HIKE_CLIMB_SEC = 20 // durée de marche (hors arrêts) — montée jouée une seule fois
const POI_HOLD_SEC = 3 // arrêt à chaque point d'intérêt (popup lisible) avant de repartir
// Caméra de SUIVI : centre + cap pris sur une LIGNE LISSÉE (camLine), pas sur le tracé brut —
// la courbe directrice est fortement adoucie (ré-échantillonnage + moyenne glissante large)
// et le cap/centre rattrapent leur cible par un lissage léger par frame. Objectif : suivre le
// trajet (le randonneur reste cadré) SANS épouser chaque lacet ni faire balayer le cap, ce
// qui donnait la nausée. Repères exprimés en fraction [0..1] du parcours.
const CAM_LEAD_FRAC = 0.02 // avance de la caméra sur la ligne lissée (randonneur dans le bas)
const CAM_LOOK_FRAC = 0.09 // large fenêtre amont/aval → cap « macro », pas le lacet local
const CAM_BEARING_LERP = 0.025 // lissage du cap (0 = figé) — très lent → rotation douce
const CAM_CENTER_LERP = 0.1 // lissage du centre

// Plus court écart angulaire signé entre deux caps (deg), dans [-180, 180].
function shortestDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180
}

// Randonneur stylisé (badge cyan + silhouette + bâton), rasterisé sans réseau.
const HIKER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="21" fill="#0c2a30" stroke="#22d3ee" stroke-width="3"/>
  <circle cx="29" cy="19.5" r="3.2" fill="#ecfeff"/>
  <g fill="none" stroke="#ecfeff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M30 24 L32 33"/>
    <path d="M32 33 L27 44"/>
    <path d="M32 33 L38 43"/>
    <path d="M30.5 27 L24.5 30"/>
    <path d="M30.5 27 L39 25"/>
  </g>
  <path d="M41 21 L37 46" fill="none" stroke="#ecfeff" stroke-width="2" stroke-linecap="round"/>
</svg>`

export function addHikingTerrain(map: MLMap, onProgress: (frac: number) => void): HikingHandle {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let disposed = false
  const empty: FeatureCollection = { type: 'FeatureCollection', features: [] }
  const setData = (id: string, data: FeatureCollection) =>
    (map.getSource(id) as GeoJSONSource | undefined)?.setData(data)

  // ── Relief 3D : DEM (terrain) + DEM (ombrage, source distincte) + ciel alpin.
  // Une SEULE source DEM, partagée par le relief 3D et l'ombrage : une 2e source (même URL)
  // doublait les tuiles DEM à charger/décoder. La caméra balayant vite, moins de tuiles à
  // streamer = moins de saccades.
  if (!map.getSource(SRC_DEM)) map.addSource(SRC_DEM, { type: 'raster-dem', url: DEM_URL })
  map.setTerrain({ source: SRC_DEM, exaggeration: 1.15 })
  if (!map.getLayer(LYR_HILLSHADE)) {
    map.addLayer({
      id: LYR_HILLSHADE,
      type: 'hillshade',
      source: SRC_DEM,
      paint: { 'hillshade-shadow-color': '#3a2f1c', 'hillshade-exaggeration': 0.55 },
    })
  }
  map.setSky({
    'sky-color': '#3d6fb0',
    'horizon-color': '#cfe0f0',
    'fog-color': '#e9eef3',
    'sky-horizon-blend': 0.6,
    'horizon-fog-blend': 0.5,
    'fog-ground-blend': 0.4,
    'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 12, 0.2, 16, 0],
  })

  // ── Sentier prévu : casing sombre (lisibilité sur l'imagerie) + trait pointillé.
  if (!map.getSource(SRC_TRAIL)) map.addSource(SRC_TRAIL, { type: 'geojson', data: CHAMONIX_TRAIL })
  if (!map.getLayer(LYR_TRAIL_CASING)) {
    map.addLayer({
      id: LYR_TRAIL_CASING,
      type: 'line',
      source: SRC_TRAIL,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#1a1206', 'line-width': 5, 'line-opacity': 0.45, 'line-blur': 0.5 },
    })
  }
  if (!map.getLayer(LYR_TRAIL)) {
    map.addLayer({
      id: LYR_TRAIL,
      type: 'line',
      source: SRC_TRAIL,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': TRAIL_COLOR,
        'line-width': 2.4,
        'line-opacity': 0.85,
        'line-dasharray': [2, 1.6],
      },
    })
  }

  // ── Chemin parcouru (plein, lumineux), mis à jour à chaque frame.
  if (!map.getSource(SRC_TRAVELED)) map.addSource(SRC_TRAVELED, { type: 'geojson', data: empty })
  if (!map.getLayer(LYR_TRAVELED)) {
    map.addLayer({
      id: LYR_TRAVELED,
      type: 'line',
      source: SRC_TRAVELED,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': TRAVELED_COLOR, 'line-width': 4, 'line-blur': 0.4 },
    })
  }

  // ── Points d'intérêt : pastilles « dormantes » (ambre, accrochées au tracé) qui
  // s'allument au passage du randonneur (feature-state `active` → transitions de paint).
  const poiFC: FeatureCollection = {
    type: 'FeatureCollection',
    features: HIKE_POIS.map((p, i) => ({
      type: 'Feature',
      id: i,
      geometry: { type: 'Point', coordinates: p.snapped },
      properties: { idx: i },
    })),
  }
  if (!map.getSource(SRC_POIS)) map.addSource(SRC_POIS, { type: 'geojson', data: poiFC })
  if (!map.getLayer(LYR_POI_RING)) {
    map.addLayer({
      id: LYR_POI_RING,
      type: 'circle',
      source: SRC_POIS,
      paint: {
        'circle-radius': ['case', ['boolean', ['feature-state', 'active'], false], 13, 8],
        'circle-radius-transition': { duration: 320, delay: 0 },
        'circle-color': 'rgba(0,0,0,0)',
        'circle-stroke-color': TRAIL_COLOR,
        'circle-stroke-width': 2,
        'circle-stroke-opacity': [
          'case',
          ['boolean', ['feature-state', 'active'], false],
          0.95,
          0.5,
        ],
        'circle-stroke-opacity-transition': { duration: 320, delay: 0 },
      },
    })
  }
  if (!map.getLayer(LYR_POI_DOT)) {
    map.addLayer({
      id: LYR_POI_DOT,
      type: 'circle',
      source: SRC_POIS,
      paint: {
        'circle-radius': ['case', ['boolean', ['feature-state', 'active'], false], 5, 3.2],
        'circle-radius-transition': { duration: 320, delay: 0 },
        'circle-color': TRAIL_COLOR,
        'circle-opacity': ['case', ['boolean', ['feature-state', 'active'], false], 1, 0.7],
        'circle-stroke-color': '#1a1206',
        'circle-stroke-width': 1,
      },
    })
  }

  // ── Randonneur : halo cyan (glow) toujours présent + icône (chargée async) +
  // anneau pulsant. L'icône est ajoutée à l'onload pour éviter les warnings
  // « image not found » ; le glow marque la position même si l'icône tarde.
  if (!map.getSource(SRC_HIKER)) map.addSource(SRC_HIKER, { type: 'geojson', data: empty })
  if (!map.getLayer(LYR_HIKER_GLOW)) {
    map.addLayer({
      id: LYR_HIKER_GLOW,
      type: 'circle',
      source: SRC_HIKER,
      paint: {
        'circle-radius': 11,
        'circle-color': TRAVELED_COLOR,
        'circle-opacity': 0.3,
        'circle-blur': 0.85,
      },
    })
  }
  if (!map.hasImage(HIKER_IMG)) {
    const img = new Image(64, 64)
    img.onload = () => {
      if (disposed) return
      if (!map.hasImage(HIKER_IMG)) map.addImage(HIKER_IMG, img, { pixelRatio: 2 })
      if (map.getSource(SRC_HIKER) && !map.getLayer(LYR_HIKER)) {
        map.addLayer({
          id: LYR_HIKER,
          type: 'symbol',
          source: SRC_HIKER,
          layout: {
            'icon-image': HIKER_IMG,
            'icon-size': 0.62,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
        })
      }
    }
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(HIKER_SVG)
  }

  const pulse: TourPulse = createTourPulse(map, TRAVELED_COLOR, 'gp-hike-pulse')
  const poiPulse: TourPulse = createTourPulse(map, TRAIL_COLOR, 'gp-hike-poi-pulse')
  const summit = CHAMONIX_TRAIL.geometry.coordinates.at(-1) as [number, number]

  // Polyligne pré-calculée (coords + distance cumulée) → échantillonnage par math
  // simple, SANS allocation Turf par frame (la pression GC saccadait le suivi).
  const coords = CHAMONIX_TRAIL.geometry.coordinates as [number, number][]
  const cum: number[] = [0]
  for (let i = 1; i < coords.length; i++) {
    cum[i] = cum[i - 1] + turf.distance(coords[i - 1], coords[i], { units: 'kilometers' })
  }
  const lengthKm = cum[cum.length - 1]

  // Index du segment contenant la distance d (recherche depuis le dernier — la
  // distance ne fait qu'avancer, sauf au rebouclage où l'on repart de 0).
  let segHint = 0
  const posAt = (km: number): [number, number] => {
    const d = Math.max(0, Math.min(lengthKm, km))
    if (d < cum[segHint]) segHint = 0
    while (segHint < coords.length - 1 && cum[segHint + 1] < d) segHint++
    const a = coords[segHint]
    const b = coords[Math.min(segHint + 1, coords.length - 1)]
    const span = cum[segHint + 1] - cum[segHint] || 1
    const f = Math.max(0, Math.min(1, (d - cum[segHint]) / span))
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
  }
  // Cap planaire (deg, depuis le nord, sens horaire) entre deux [lng,lat] proches.
  const bearingTo = (a: [number, number], b: [number, number]): number => {
    const dx = (b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180)
    const dy = b[1] - a[1]
    return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360
  }
  // Traînée parcourue construite à la main (pas de turf.lineSliceAlong par frame).
  const traveledFC = (d: number): FeatureCollection => {
    const line: [number, number][] = []
    for (let i = 0; i < coords.length && cum[i] < d; i++) line.push(coords[i])
    line.push(posAt(d))
    return {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'LineString', coordinates: line }, properties: {} },
      ],
    }
  }

  // ── Ligne directrice LISSÉE pour la CAMÉRA (le randonneur, lui, suit le tracé exact). On
  // ré-échantillonne le sentier à pas constant puis on applique une moyenne glissante LARGE :
  // les lacets sont gommés, seule la forme générale (donc la direction de marche) subsiste —
  // la caméra glisse sur cette courbe douce au lieu d'épouser chaque segment (anti nausée).
  const SMOOTH_STEP_KM = 0.05
  const SMOOTH_WIN = 13 // ± échantillons (~±0.65 km) — lissage fort de la courbe caméra
  const sampleCount = Math.max(2, Math.ceil(lengthKm / SMOOTH_STEP_KM))
  const rawSamples: [number, number][] = []
  for (let i = 0; i <= sampleCount; i++) rawSamples.push(posAt((i / sampleCount) * lengthKm))
  const camLine: [number, number][] = rawSamples.map((_, i) => {
    let sx = 0
    let sy = 0
    let n = 0
    const lo = Math.max(0, i - SMOOTH_WIN)
    const hi = Math.min(rawSamples.length - 1, i + SMOOTH_WIN)
    for (let j = lo; j <= hi; j++) {
      sx += rawSamples[j][0]
      sy += rawSamples[j][1]
      n++
    }
    return [sx / n, sy / n]
  })
  // Position sur la ligne lissée à une fraction [0..1] du parcours.
  const camAtFrac = (f: number): [number, number] => {
    const x = Math.max(0, Math.min(1, f)) * (camLine.length - 1)
    const i = Math.floor(x)
    const j = Math.min(camLine.length - 1, i + 1)
    const u = x - i
    const a = camLine[i]
    const b = camLine[j]
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]
  }

  // Une frame = repositionne le randonneur + suit la caméra (60 fps) ; la traînée
  // (~20 fps), les pings du halo (~3/s) et le panneau (~6 fps) sont sous-échantillonnés.
  let frame = 0
  let camBearing = NaN // cap courant lissé (NaN au 1er rendu → recalé sur la pente)
  let camCenter: [number, number] | null = null // centre courant lissé (null → recalé)
  let snapBearing = true // recale cap + centre sans lissage au 1er rendu
  let holding = false // arrêt sur un point d'intérêt : la caméra est figée

  const render = (t: number) => {
    const dist = t * lengthKm
    const headPos = posAt(dist)
    setData(SRC_HIKER, {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: headPos }, properties: {} },
      ],
    })

    // Caméra de suivi : centre + cap pris sur la LIGNE LISSÉE (camAtFrac), un peu en avant du
    // randonneur. La courbe étant fortement adoucie et le cap très lentement lissé, le
    // panoramique reste posé — pas de balayage à chaque lacet (anti nausée) — tout en suivant
    // le trajet. (Figée pendant un arrêt sur POI.)
    if (!reduced && !holding) {
      const snap = snapBearing || Number.isNaN(camBearing) || !camCenter
      const camF = Math.min(1, t + CAM_LEAD_FRAC)
      const target = camAtFrac(camF)
      const heading = bearingTo(
        camAtFrac(Math.max(0, camF - CAM_LOOK_FRAC)),
        camAtFrac(Math.min(1, camF + CAM_LOOK_FRAC)),
      )
      if (snap) {
        camBearing = heading
        camCenter = target
        snapBearing = false
      } else {
        camBearing += shortestDelta(camBearing, heading) * CAM_BEARING_LERP
        camCenter = [
          camCenter![0] + (target[0] - camCenter![0]) * CAM_CENTER_LERP,
          camCenter![1] + (target[1] - camCenter![1]) * CAM_CENTER_LERP,
        ]
      }
      map.jumpTo({ center: camCenter, bearing: camBearing })
    }

    // Sous-échantillonné pour soulager le thread principal — le suivi caméra reste à 60 fps,
    // mais le re-drapage de la traînée sur le relief, les pings et le re-rendu Recharts du
    // panneau (coûteux) tournent plus lentement, ce qui réduit les saccades.
    if (frame % 4 === 0) setData(SRC_TRAVELED, dist > 0.01 ? traveledFC(dist) : empty)
    if (!reduced && frame % 32 === 0) pulse.pulse(headPos)
    if (frame % 16 === 0) onProgress(t)
    frame++
  }

  // Allume une pastille au passage du randonneur : onde ambre + fiche du lieu. La caméra
  // est simplement figée (holding) le temps de l'arrêt — pas de recadrage, pour limiter
  // les mouvements ; le randonneur (et donc le POI) est déjà cadré par le suivi.
  const activate = (i: number) => {
    const poi = HIKE_POIS[i]
    holding = true
    useMapDataStore.getState().setActiveHikePoi(i)
    if (map.getSource(SRC_POIS)) map.setFeatureState({ source: SRC_POIS, id: i }, { active: true })
    poiPulse.burst(poi.snapped)
    openHikePoiPopup(map, poi, poi.snapped)
  }
  const deactivate = (i: number) => {
    holding = false
    closeHikePoiPopup()
    if (map.getSource(SRC_POIS)) map.setFeatureState({ source: SRC_POIS, id: i }, { active: false })
    useMapDataStore.getState().setActiveHikePoi(null)
  }

  let hikeTl: gsap.core.Timeline | null = null
  if (reduced) {
    render(0)
    onProgress(0)
    // Pas d'animation : pastilles déjà allumées, aucun popup automatique. On débloque
    // « Suivant » d'emblée (sinon l'utilisateur resterait coincé sur l'étape).
    for (let i = 0; i < HIKE_POIS.length; i++) {
      if (map.getSource(SRC_POIS))
        map.setFeatureState({ source: SRC_POIS, id: i }, { active: true })
    }
    useTourStore.getState().setHikeDone(true)
  } else {
    // Montée jouée UNE SEULE FOIS (pas de boucle) : segments de marche (durées ∝ fractions
    // de tracé, ~20 s au total) entrecoupés d'un arrêt à chaque point d'intérêt. À la fin
    // (sommet atteint), on déverrouille « Suivant ».
    const proxy = { t: 0 }
    const tl = gsap.timeline({
      onComplete: () => {
        pulse.burst(summit) // onde d'arrivée au sommet
        useTourStore.getState().setHikeDone(true) // rando terminée → « Suivant » déverrouillé
      },
    })
    let prevFrac = 0
    HIKE_POIS.forEach((poi, i) => {
      tl.to(proxy, {
        t: poi.frac,
        duration: Math.max(0.001, (poi.frac - prevFrac) * HIKE_CLIMB_SEC),
        ease: 'none',
        onUpdate: () => render(proxy.t),
      })
      tl.call(() => activate(i))
      // Maintien : t constant, mais render continue (pings du halo, panneau) — caméra figée.
      tl.to(proxy, { t: poi.frac, duration: POI_HOLD_SEC, onUpdate: () => render(proxy.t) })
      tl.call(() => deactivate(i))
      prevFrac = poi.frac
    })
    if (prevFrac < 1) {
      tl.to(proxy, {
        t: 1,
        duration: Math.max(0.001, (1 - prevFrac) * HIKE_CLIMB_SEC),
        ease: 'none',
        onUpdate: () => render(proxy.t),
      })
    }
    hikeTl = tl
  }

  return {
    detach() {
      disposed = true
      hikeTl?.kill()
      closeHikePoiPopup()
      useMapDataStore.getState().setActiveHikePoi(null)
      pulse.remove()
      poiPulse.remove()
      map.setTerrain(null)
      // Le ciel n'est pas réinitialisé explicitement : la sortie de ce step bascule
      // toujours de basemap (setStyle), ce qui efface ciel/terrain/sources.
      if (map.hasImage(HIKER_IMG)) map.removeImage(HIKER_IMG)
      for (const id of [
        LYR_HIKER,
        LYR_HIKER_GLOW,
        LYR_POI_DOT,
        LYR_POI_RING,
        LYR_TRAVELED,
        LYR_TRAIL,
        LYR_TRAIL_CASING,
        LYR_HILLSHADE,
      ]) {
        if (map.getLayer(id)) map.removeLayer(id)
      }
      // DEM retiré en dernier — impérativement après setTerrain(null).
      for (const id of [SRC_HIKER, SRC_TRAVELED, SRC_POIS, SRC_TRAIL, SRC_DEM]) {
        if (map.getSource(id)) map.removeSource(id)
      }
    },
  }
}
