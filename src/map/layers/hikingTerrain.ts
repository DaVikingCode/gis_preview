import type { FeatureCollection } from 'geojson'
import maplibregl, {
  type GeoJSONSource,
  type Map as MLMap,
  type MapSourceDataEvent,
  type SkySpecification,
} from 'maplibre-gl'
import gsap from 'gsap'
import * as turf from '@turf/turf'
import { createTourPulse, type TourPulse } from '@/animations/tourCursor'
import { CHAMONIX_TRAIL } from '@/data/sample-trail'
import { HIKE_POIS } from '@/data/sample-hike-pois'
import { closeHikePoiPopup, openHikePoiPopup } from '@/map/openHikePoiPopup'
import { useMapDataStore } from '@/store/map-data-store'

// Step « Terrain 3D · randonnée ». Caméra FIXE (cadrage défini par le step) : aucun mouvement
// par frame, donc pas de re-rendu terrain forcé → bien meilleurs fps. Polyligne pré-calculée
// échantillonnée par math simple, sans allocation Turf par frame. `onProgress` remonte la
// fraction parcourue [0..1] au panneau (profil d'élévation).
export type HikingHandle = { detach: () => void }

const SRC_DEM = 'gp-dem'
const SRC_TRAIL = 'gp-hike-trail'
const LYR_TRAIL_CASING = 'gp-hike-trail-casing'
const LYR_TRAIL = 'gp-hike-trail-line'
const SRC_TRAVELED = 'gp-hike-traveled'
const LYR_TRAVELED = 'gp-hike-traveled-line'
const SRC_HIKER = 'gp-hiker'
const LYR_HIKER_GLOW = 'gp-hiker-glow'
const SRC_POIS = 'gp-hike-pois'
const LYR_POI_RING = 'gp-hike-poi-ring'
const LYR_POI_DOT = 'gp-hike-poi-dot'

// TileJSON Mapterhorn (encoding terrarium, tileSize 512) — lu par MapLibre via `url`,
// exactement comme l'exemple officiel 3d-terrain.
const DEM_URL = 'https://tiles.mapterhorn.com/tilejson.json'
// Randonneur stylisé (badge cyan + silhouette + bâton), rasterisé sans réseau.
const HIKER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="21" fill="#0c2a30" stroke="#00b5e1" stroke-width="3"/>
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

const TRAIL_COLOR = '#fbbf24' // sentier prévu (ambre, pointillé)
const TRAVELED_COLOR = '#00b5e1' // chemin parcouru + randonneur (cyan DVC, accent de marque)
const HIKE_CLIMB_SEC = 10 // durée de la montée continue (0→1) — jouée une seule fois
const POI_CARD_SEC = 2.5 // durée d'affichage d'une fiche POI (sans figer la caméra)
const SUMMIT_HOLD_SEC = 2 // beat d'arrivée au sommet (pulse + fiche finale)

export function addHikingTerrain(map: MLMap, onProgress: (frac: number) => void): HikingHandle {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // Le relief 3D (DEM + ombrage + imagerie drapée) est borné par le fragment shading : sur écran
  // HiDPI, rendre en pleine résolution native quadruple les pixels à ombrer. On force un rendu à
  // 1× le temps du step (image un peu plus douce, fps bien meilleurs), restauré dans `detach`.
  const prevPixelRatio = map.getPixelRatio()
  map.setPixelRatio(1)
  const empty: FeatureCollection = { type: 'FeatureCollection', features: [] }
  const setData = (id: string, data: FeatureCollection) =>
    (map.getSource(id) as GeoJSONSource | undefined)?.setData(data)

  // PAS de couche hillshade : la scène 3D est re-rendue à chaque frame tant que la traînée et
  // le randonneur bougent, or un hillshade est une 2e passe DEM plein écran par frame — trop
  // coûteux ici. Le relief reste lisible via la géométrie 3D et les ombres de l'imagerie.
  if (!map.getSource(SRC_DEM)) map.addSource(SRC_DEM, { type: 'raster-dem', url: DEM_URL })
  map.setTerrain({ source: SRC_DEM, exaggeration: 1.15 })
  map.setSky({
    'sky-color': '#3d6fb0',
    'horizon-color': '#cfe0f0',
    'fog-color': '#e9eef3',
    'sky-horizon-blend': 0.6,
    'horizon-fog-blend': 0.5,
    'fog-ground-blend': 0.4,
    'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 12, 0.2, 16, 0],
  })

  // Sentier prévu : casing sombre (lisibilité sur l'imagerie) + trait pointillé.
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

  // Pastilles « dormantes » qui s'allument au passage du randonneur (feature-state `active`
  // → transitions de paint).
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

  // Randonneur : halo cyan + icône SVG.
  // Le halo reste une couche `circle` (reprojetée à chaque frame = fluide). L'icône, elle, est
  // un Marker DOM et NON une couche `symbol` : MapLibre throttle le placement des symboles, si
  // bien qu'une icône symbol « traînait » derrière son halo (effet laggy) ; un Marker est
  // repositionné à chaque frame de rendu (relief compris), donc le déplacement est fluide.
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
  const hikerEl = document.createElement('div')
  hikerEl.style.width = '40px'
  hikerEl.style.height = '40px'
  hikerEl.style.pointerEvents = 'none'
  // SVG en data-URI (même source que l'ancienne icône rasterisée) → pas d'innerHTML.
  hikerEl.style.backgroundImage = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(HIKER_SVG)}")`
  hikerEl.style.backgroundSize = 'contain'
  hikerEl.style.backgroundRepeat = 'no-repeat'
  const hikerMarker = new maplibregl.Marker({ element: hikerEl, anchor: 'center' })
    .setLngLat(CHAMONIX_TRAIL.geometry.coordinates[0] as [number, number])
    .addTo(map)

  // Locator « Chamonix ». Marker DOM ancré au sol (anchor 'bottom') : une tige verticale pousse
  // le badge vers le haut (décalage écran), lecture « altitude » sans vraie 3D — MapLibre ne
  // place pas de marker en altitude. Suffisant pour ce cadrage fixe.
  const PIN_RISE_PX = 56 // hauteur de la tige (px écran) : pin classique posé au sol, badge au-dessus
  // (un grand décalage chevaucherait le relief — ce cadrage n'a pas de ciel au-dessus des crêtes).
  const pinEl = document.createElement('div')
  Object.assign(pinEl.style, {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    pointerEvents: 'none',
  })
  const pinBadge = document.createElement('div')
  pinBadge.textContent = 'Chamonix'
  Object.assign(pinBadge.style, {
    background: '#FFEB04',
    color: '#232323',
    font: '600 13px/1 system-ui, sans-serif',
    letterSpacing: '.02em',
    padding: '6px 10px',
    borderRadius: '7px',
    whiteSpace: 'nowrap',
    boxShadow: '0 4px 14px rgba(0,0,0,.45)',
  })
  const pinStem = document.createElement('div')
  Object.assign(pinStem.style, {
    width: '2px',
    height: '0px',
    background: 'linear-gradient(to bottom, #FFEB04, rgba(255,235,4,.12))',
  })
  const pinDot = document.createElement('div')
  Object.assign(pinDot.style, {
    width: '11px',
    height: '11px',
    borderRadius: '50%',
    background: '#FFEB04',
    boxShadow: '0 0 0 3px rgba(255,235,4,.25)',
  })
  pinEl.append(pinBadge, pinStem, pinDot)
  // Masquage PENDANT le chargement via `visibility` (pas `opacity`) : MapLibre pilote lui-même
  // element.style.opacity pour l'occlusion par le relief (opacityWhenCovered) — les deux propriétés
  // sont indépendantes, donc elles ne se marchent pas dessus.
  pinEl.style.visibility = 'hidden'
  const pinStart = CHAMONIX_TRAIL.geometry.coordinates[0] as [number, number]
  // opacityWhenCovered: 0 → le pin disparaît quand sa BASE (point au sol) passe derrière le relief.
  const pinMarker = new maplibregl.Marker({
    element: pinEl,
    anchor: 'bottom',
    opacityWhenCovered: 0,
  })
    .setLngLat(pinStart)
    .addTo(map)

  // Pin affiché directement à sa position finale (sans animation) : tige à pleine hauteur, badge
  // au-dessus. L'ancre 'bottom' garde le point au sol via un translate(-50%,-100%) relatif à
  // l'élément.
  const playPin = () => {
    pinStem.style.height = `${PIN_RISE_PX}px`
    pinEl.style.visibility = 'visible'
  }
  // Caméra FIXE : un Marker MapLibre ne recalcule son élévation terrain QUE sur un 'move' de la
  // carte. Tant que le DEM charge, le pin est posé sur le terrain plat (élévation 0) ; une fois les
  // tuiles arrivées, RIEN ne le repositionne (pas de mouvement caméra) → il reste planté dans la
  // montagne jusqu'à ce qu'on bouge la caméra. On écoute donc le chargement du DEM : à chaque mise
  // à jour de la source, on ré-ancre le pin (setLngLat force le recalcul d'élévation), et on ne joue
  // sa montée qu'une seule fois. (Pas d'event 'idle' : la timeline rando rafraîchit des sources à
  // chaque frame.)
  let pinPlayed = false
  const anchorPin = () => {
    pinMarker.setLngLat(pinStart) // ré-ancre sur le relief désormais chargé (recalcul d'élévation)
    if (!pinPlayed) {
      pinPlayed = true
      playPin()
    }
  }
  const onDemData = (e: MapSourceDataEvent) => {
    if (e.sourceId === SRC_DEM && e.isSourceLoaded) anchorPin()
  }
  map.on('sourcedata', onDemData)
  if (map.isSourceLoaded(SRC_DEM)) anchorPin() // déjà chargé (retour arrière sur le step)

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

  // Une frame = repositionne le randonneur ; la traînée, les pings du halo et le panneau sont
  // sous-échantillonnés. La CAMÉRA ne bouge JAMAIS (cadrage fixe défini par le step) : aucun
  // jumpTo/setBearing par frame → pas de re-rendu terrain forcé, donc bien meilleurs fps.
  let frame = 0

  const render = (t: number) => {
    const dist = t * lengthKm
    const headPos = posAt(dist)
    setData(SRC_HIKER, {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: headPos }, properties: {} },
      ],
    })
    hikerMarker.setLngLat(headPos)

    // Traînée mise à jour À CHAQUE frame : sa pointe reste collée au randonneur (reconstruction
    // d'un simple tableau, peu coûteuse). Pings et re-rendu Recharts du panneau (coûteux) restent
    // sous-échantillonnés.
    setData(SRC_TRAVELED, dist > 0.01 ? traveledFC(dist) : empty)
    if (!reduced && frame % 32 === 0) pulse.pulse(headPos)
    if (frame % 16 === 0) onProgress(t)
    frame++
  }

  // Allume une pastille au passage du randonneur : onde ambre + fiche du lieu, SANS figer la
  // caméra (le randonneur continue d'avancer ; le POI est déjà cadré par le suivi). Mono-carte :
  // une nouvelle fiche éteint la précédente, et le `deactivate` retardé d'un POI déjà remplacé
  // est ignoré (garde `currentPoi`), pour ne pas fermer la fiche suivante quand 2 POI sont proches.
  let currentPoi = -1
  const activate = (i: number) => {
    const poi = HIKE_POIS[i]
    if (currentPoi >= 0 && currentPoi !== i && map.getSource(SRC_POIS))
      map.setFeatureState({ source: SRC_POIS, id: currentPoi }, { active: false })
    currentPoi = i
    useMapDataStore.getState().setActiveHikePoi(i)
    if (map.getSource(SRC_POIS)) map.setFeatureState({ source: SRC_POIS, id: i }, { active: true })
    poiPulse.burst(poi.snapped)
    openHikePoiPopup(map, poi, poi.snapped)
  }
  const deactivate = (i: number) => {
    if (currentPoi !== i) return // une fiche plus récente a pris la main
    currentPoi = -1
    closeHikePoiPopup()
    if (map.getSource(SRC_POIS)) map.setFeatureState({ source: SRC_POIS, id: i }, { active: false })
    useMapDataStore.getState().setActiveHikePoi(null)
  }

  let hikeTl: gsap.core.Timeline | null = null
  if (reduced) {
    render(0)
    onProgress(0)
    // Pas d'animation : pastilles déjà allumées, aucun popup automatique.
    for (let i = 0; i < HIKE_POIS.length; i++) {
      if (map.getSource(SRC_POIS))
        map.setFeatureState({ source: SRC_POIS, id: i }, { active: true })
    }
  } else {
    // Montée CONTINUE jouée une seule fois (ease:none ⇒ temps ∝ fraction). Les fiches des POI
    // de mi-parcours s'ouvrent à leur fraction et se referment POI_CARD_SEC plus tard, sans
    // figer la caméra. Le sommet (frac 1.0) est traité à part : beat d'arrivée (la caméra se
    // pose, onde d'arrivée, fiche laissée affichée → on finit sur le payoff).
    const proxy = { t: 0 }
    const summitIdx = HIKE_POIS.findIndex((p) => p.frac >= 1)
    const tl = gsap.timeline()
    tl.to(proxy, { t: 1, duration: HIKE_CLIMB_SEC, ease: 'none', onUpdate: () => render(proxy.t) })
    // Positions absolues (s) : indépendantes des callbacks insérés, qui rallongent la timeline.
    HIKE_POIS.forEach((poi, i) => {
      if (i === summitIdx) return
      const at = poi.frac * HIKE_CLIMB_SEC
      tl.call(() => activate(i), undefined, at)
      tl.call(() => deactivate(i), undefined, at + POI_CARD_SEC)
    })
    tl.call(
      () => {
        pulse.burst(summit) // onde d'arrivée au sommet
        if (summitIdx >= 0) activate(summitIdx)
      },
      undefined,
      HIKE_CLIMB_SEC,
    )
    tl.to(
      proxy,
      { t: 1, duration: SUMMIT_HOLD_SEC, onUpdate: () => render(proxy.t) },
      HIKE_CLIMB_SEC,
    )
    hikeTl = tl
  }

  return {
    detach() {
      hikerMarker.remove()
      map.off('sourcedata', onDemData)
      pinMarker.remove()
      // Restaurer la résolution native : le pixelRatio persiste à travers le setStyle de
      // changement de basemap, donc sans ça tout le reste du tour resterait en 1×.
      map.setPixelRatio(prevPixelRatio)
      hikeTl?.kill()
      closeHikePoiPopup()
      useMapDataStore.getState().setActiveHikePoi(null)
      pulse.remove()
      poiPulse.remove()
      map.setTerrain(null)
      // Ciel réinitialisé explicitement : `detach` doit être auto-suffisant et ne pas dépendre du
      // setStyle de changement de basemap (qui pourrait ne pas avoir lieu si un step voisin passait
      // un jour aussi en satellite) — sinon le ciel alpin resterait affiché. setSky(undefined)
      // supprime le ciel au runtime ; on cast vers la surcharge à argument optionnel.
      ;(map.setSky as (sky?: SkySpecification) => void)()
      for (const id of [
        LYR_HIKER_GLOW,
        LYR_POI_DOT,
        LYR_POI_RING,
        LYR_TRAVELED,
        LYR_TRAIL,
        LYR_TRAIL_CASING,
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
