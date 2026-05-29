import type { Feature, FeatureCollection, LineString, Point } from 'geojson'
import maplibregl, { type GeoJSONSource, type Map as MLMap } from 'maplibre-gl'
import gsap from 'gsap'
import * as turf from '@turf/turf'
import { SAMPLE_POIS, type POIProps } from '@/data/sample-pois'
import {
  RT_CRIT,
  RT_POSTE_CONFIG,
  RT_ROUTES,
  RT_WARN,
  type FleetRoute,
} from '@/data/sample-realtime'
import { createTourPulse, type TourPulse } from '@/animations/tourCursor'
import { createPinEl, PIN_TIP_GAP } from '@/map/pinMarker'
import { addNetworkFlow } from '@/map/layers/networkFlow'
import { openPoiPopup, closePoiPopup, isPoiPopupOpen } from '@/map/openPoiPopup'
import { useMapDataStore } from '@/store/map-data-store'

export type RealtimeStatus = 'ok' | 'warn' | 'crit'
export type RealtimePoste = {
  id: number
  name: string
  loadPct: number
  mw: number
  status: RealtimeStatus
}
export type RealtimeFeed = {
  postes: RealtimePoste[]
  totalMw: number
  history: { t: number; mw: number }[]
  alert: { name: string; loadPct: number } | null
  vehicles: number
}

// Couche unifiée de la séquence HTA : flux SCADA live + survol (tooltip) + clic
// (fiche) + surcharge/rétablissement scriptés d'un poste incident.
export type RealtimeHandle = {
  detach: () => void
  getPostLngLat: (id: number) => [number, number] | null
  showTooltip: (id: number) => void
  hideTooltip: () => void
  triggerSurcharge: (id: number) => void
  resetIncident: () => void
  openPost: (id: number) => void
  popupOpen: () => boolean
  closePopup: () => void
}

type RealtimeOpts = {
  // Poste piloté par le scénario : surcharge sur cue puis rétablissement quand son
  // poiStatus passe à `done`. Sans incident, simple supervision (random-walk).
  incidentId?: number
}

const SRC_TRAIL = 'rt-trail-src'
const LYR_TRAIL = 'rt-trail'
const SRC_VEH = 'rt-veh-src'
const LYR_VEH_GLOW = 'rt-veh-glow'
const LYR_VEH = 'rt-veh'

// Palette sobre/désaturée (pas de néon) — bien lisible sur fond Positron clair.
const OK = '#3fa17d'
const WARN = '#cda14a'
const CRIT = '#d06b63'
const VEH = '#22d3ee'

const HISTORY_LEN = 30
const TRAIL_KM = 2.5
const FLEET_LOOP_SEC = 24
// Cible de charge forcée d'un poste en surcharge (> RT_CRIT) puis lissée par tick.
const SURGE_TARGET = 1.02
// Vitesse de rampe (lerp/tick) quand la charge incident est forcée (surcharge/repli).
const RAMP = 0.45

// Filtre de base (cf. pinMarker) vs halo rouge « en alerte » du poste incident.
const PIN_BASE_FILTER = 'drop-shadow(0 1px 2px rgba(0,0,0,.5))'
const PIN_GLOW_FILTER = 'drop-shadow(0 0 11px rgba(208,107,99,.92))'

const STATUS_WORD: Record<RealtimeStatus, string> = {
  ok: 'nominal',
  warn: 'surveillé',
  crit: 'surcharge',
}

export function statusFor(load: number): RealtimeStatus {
  return load >= RT_CRIT ? 'crit' : load >= RT_WARN ? 'warn' : 'ok'
}

export function colorFor(status: RealtimeStatus): string {
  return status === 'crit' ? CRIT : status === 'warn' ? WARN : OK
}

// Aller-retour dépôt → poste → dépôt : la boucle se referme sans téléportation.
function roundTrip(r: FleetRoute) {
  const full: [number, number][] = [...r.coords, ...r.coords.slice(0, -1).reverse()]
  const line = turf.lineString(full)
  return { ...r, line, lengthKm: turf.length(line, { units: 'kilometers' }) }
}

type PosteMarker = {
  el: HTMLDivElement
  pin: HTMLDivElement
  update: (load: number, status: RealtimeStatus) => void
  showTip: () => void
  hideTip: () => void
}

export function addRealtimeSupervision(
  map: MLMap,
  onTick: (feed: RealtimeFeed) => void,
  opts: RealtimeOpts = {},
): RealtimeHandle {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const incidentId = opts.incidentId ?? null
  const emptyFC: FeatureCollection = { type: 'FeatureCollection', features: [] }
  const setData = (id: string, data: FeatureCollection) =>
    (map.getSource(id) as GeoJSONSource | undefined)?.setData(data)

  // Marqueur DOM : pin partagé (createPinEl) recoloré par charge, % au-dessus, et
  // tooltip survol (vraie souris + scripté) avec données live du poste.
  function buildPosteMarker(size: number, props: POIProps): PosteMarker {
    const { el, pin } = createPinEl(size, OK, true)

    // % de charge, pastille sombre au-dessus de la tête du pin.
    const label = document.createElement('div')
    label.style.cssText =
      'position:absolute;left:50%;bottom:100%;transform:translate(-50%,-2px);padding:1px 4px;border-radius:6px;background:rgba(11,15,20,.82);font-size:9px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.35;white-space:nowrap'
    el.append(label)

    // Tooltip : wrapper (centrage, posé en CSS) + boîte animée par GSAP. Contenu
    // construit en nœuds DOM (textContent) — pas d'innerHTML.
    const tipWrap = document.createElement('div')
    tipWrap.style.cssText =
      'position:absolute;left:50%;bottom:100%;transform:translateX(-50%);margin-bottom:10px;display:none;pointer-events:none;z-index:6'
    const tip = document.createElement('div')
    tip.className = 'gp-rt-tooltip'
    const tipName = document.createElement('span')
    tipName.className = 'gp-rt-tip-name'
    tipName.textContent = props.name
    const tipMeta = document.createElement('span')
    tipMeta.className = 'gp-rt-tip-meta'
    tipMeta.textContent = `${props.commune} · ${props.voltage}`
    const tipLoad = document.createElement('span')
    tipLoad.className = 'gp-rt-tip-load'
    const tipDot = document.createElement('i')
    const tipPct = document.createElement('b')
    const tipWord = document.createElement('span')
    tipLoad.append(tipDot, tipPct, tipWord)
    tip.append(tipName, tipMeta, tipLoad)
    tipWrap.append(tip)
    el.append(tipWrap)

    let lastLoad = RT_POSTE_CONFIG[props.id].base
    let lastStatus: RealtimeStatus = statusFor(lastLoad)
    const renderTip = () => {
      const c = colorFor(lastStatus)
      tipDot.style.background = c
      tipPct.style.color = c
      tipPct.textContent = `${Math.round(lastLoad * 100)} %`
      tipWord.textContent = ` ${STATUS_WORD[lastStatus]}`
    }

    const update = (load: number, status: RealtimeStatus) => {
      lastLoad = load
      lastStatus = status
      const color = colorFor(status)
      pin.style.backgroundColor = color
      label.textContent = `${Math.round(load * 100)}%`
      label.style.color = color
      if (tipWrap.style.display !== 'none') renderTip()
    }

    const showTip = () => {
      renderTip()
      tipWrap.style.display = 'block'
      label.style.visibility = 'hidden' // évite le chevauchement avec le %
      if (reduced) return
      gsap.fromTo(
        tip,
        { autoAlpha: 0, y: 8, scale: 0.92 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.28,
          ease: 'back.out(1.6)',
          transformOrigin: '50% 100%',
        },
      )
    }
    const hideTip = () => {
      label.style.visibility = 'visible'
      if (reduced) {
        tipWrap.style.display = 'none'
        return
      }
      gsap.to(tip, {
        autoAlpha: 0,
        y: 6,
        scale: 0.96,
        duration: 0.18,
        ease: 'power2.in',
        transformOrigin: '50% 100%',
        onComplete: () => {
          tipWrap.style.display = 'none'
        },
      })
    }

    // Survol réel (n'importe quel visiteur) — le scénario appelle show/hideTip aussi.
    el.addEventListener('mouseenter', showTip)
    el.addEventListener('mouseleave', hideTip)

    return { el, pin, update, showTip, hideTip }
  }

  // ── Réseau : flux « courant qui circule » (module partagé avec la tournée HTA).
  const flowHandle = addNetworkFlow(map)

  // ── Flotte : traînée comète + véhicule (cœur lumineux sur halo cyan).
  if (!map.getSource(SRC_TRAIL)) map.addSource(SRC_TRAIL, { type: 'geojson', data: emptyFC })
  if (!map.getLayer(LYR_TRAIL)) {
    map.addLayer({
      id: LYR_TRAIL,
      type: 'line',
      source: SRC_TRAIL,
      layout: { 'line-cap': 'round' },
      paint: { 'line-color': VEH, 'line-width': 3, 'line-opacity': 0.5, 'line-blur': 0.4 },
    })
  }
  if (!map.getSource(SRC_VEH)) map.addSource(SRC_VEH, { type: 'geojson', data: emptyFC })
  if (!map.getLayer(LYR_VEH_GLOW)) {
    map.addLayer({
      id: LYR_VEH_GLOW,
      type: 'circle',
      source: SRC_VEH,
      paint: {
        'circle-radius': 10,
        'circle-color': VEH,
        'circle-opacity': 0.25,
        'circle-blur': 0.8,
      },
    })
  }
  if (!map.getLayer(LYR_VEH)) {
    map.addLayer({
      id: LYR_VEH,
      type: 'circle',
      source: SRC_VEH,
      paint: {
        'circle-radius': 4.5,
        'circle-color': '#ecfeff',
        'circle-stroke-color': VEH,
        'circle-stroke-width': 2,
      },
    })
  }

  // Anneau d'alerte « sonar » sur le poste en surcharge (ping à chaque tick crit).
  const pulse: TourPulse = createTourPulse(map, CRIT, 'rt-alert-pulse')
  // Onde verte « résolu » jouée une fois au rétablissement du poste incident.
  const resolvedPulse: TourPulse = createTourPulse(map, OK, 'rt-resolved-pulse')

  // ── Flotte : un seul ticker GSAP pilote tous les véhicules (1 render/frame).
  const routes = RT_ROUTES.map(roundTrip)
  const renderFleet = (t: number) => {
    const veh: Feature<Point>[] = []
    const trail: Feature<LineString>[] = []
    for (const r of routes) {
      const p = (((t * r.speed + r.phase) % 1) + 1) % 1
      const dist = p * r.lengthKm
      const head = turf.along(r.line, dist, { units: 'kilometers' })
      veh.push({ type: 'Feature', geometry: head.geometry, properties: { label: r.label } })
      const start = Math.max(0, dist - TRAIL_KM)
      if (dist - start > 0.01) {
        const tail = turf.lineSliceAlong(r.line, start, dist, { units: 'kilometers' })
        trail.push({ type: 'Feature', geometry: tail.geometry, properties: {} })
      }
    }
    setData(SRC_VEH, { type: 'FeatureCollection', features: veh })
    setData(SRC_TRAIL, { type: 'FeatureCollection', features: trail })
  }

  // ── Flux SCADA simulé : random-walk avec retour à la moyenne par poste.
  const states = SAMPLE_POIS.features.map((f) => ({
    id: f.properties.id,
    name: f.properties.name,
    coords: f.geometry.coordinates as [number, number],
    cfg: RT_POSTE_CONFIG[f.properties.id],
    load: RT_POSTE_CONFIG[f.properties.id].base,
  }))
  const baseTotal = states.reduce((a, s) => a + s.cfg.capMva * s.cfg.base, 0)
  // Préremplit l'historique pour que le graphe soit plein dès l'affichage.
  const history: { t: number; mw: number }[] = Array.from({ length: HISTORY_LEN }, (_, i) => ({
    t: i,
    mw: baseTotal,
  }))
  let counter = HISTORY_LEN

  // Marqueurs DOM (pins recolorés) — le poste source est plus grand (hub supervisé).
  const propsById = new Map(SAMPLE_POIS.features.map((f) => [f.properties.id, f.properties]))
  const postes = states.map((s) => {
    const size = s.id === 1 ? 46 : 34
    const props = propsById.get(s.id)!
    const g = buildPosteMarker(size, props)
    const marker = new maplibregl.Marker({
      element: g.el,
      anchor: 'bottom', // la pointe du pin pointe le poste
      offset: [0, Math.round(size * PIN_TIP_GAP)],
    })
      .setLngLat(s.coords)
      .addTo(map)
    // Clic réel utilisateur → ouvre la fiche (vol pour recentrer).
    g.el.addEventListener('click', () => openPoiPopup(map, props, s.coords, { fly: true }))
    return {
      id: s.id,
      coords: s.coords,
      pin: g.pin,
      update: g.update,
      showTip: g.showTip,
      hideTip: g.hideTip,
      marker,
    }
  })
  const posteById = new Map(postes.map((p) => [p.id, p]))

  // ── Scénario incident : surcharge forcée → rétablissement quand poiStatus=done.
  let surchargeActive = false
  let lastIncidentDone = false
  let glowTween: gsap.core.Tween | null = null

  const incidentPoste = () => (incidentId != null ? posteById.get(incidentId) : undefined)

  const fireRecovery = () => {
    const p = incidentPoste()
    if (!p || reduced) return
    glowTween?.kill()
    glowTween = gsap.to(p.pin, { filter: PIN_BASE_FILTER, duration: 0.7, ease: 'power2.inOut' })
    gsap.fromTo(
      p.pin,
      { scale: 1 },
      {
        scale: 1.14,
        duration: 0.3,
        ease: 'back.out(2)',
        transformOrigin: '50% 90%',
        yoyo: true,
        repeat: 1,
      },
    )
    resolvedPulse.burst(p.coords)
  }

  const tick = () => {
    const incidentDone =
      incidentId != null && useMapDataStore.getState().poiStatus[String(incidentId)] === 'done'

    let totalMw = 0
    for (const s of states) {
      const forced = incidentId != null && s.id === incidentId && (surchargeActive || incidentDone)
      if (forced) {
        const target = incidentDone ? s.cfg.base : SURGE_TARGET
        s.load += (target - s.load) * RAMP
      } else {
        s.load += (s.cfg.base - s.load) * 0.06 + (Math.random() - 0.5) * s.cfg.jitter * 2
      }
      s.load = Math.min(1.05, Math.max(0.3, s.load))
      totalMw += s.cfg.capMva * s.load
    }
    states.forEach((s, i) => postes[i].update(s.load, statusFor(s.load)))

    // Bascule incident → done : on joue le rétablissement (halo off + onde verte) une fois.
    if (incidentDone && !lastIncidentDone) fireRecovery()
    lastIncidentDone = incidentDone

    const crit = states.filter((s) => statusFor(s.load) === 'crit').sort((a, b) => b.load - a.load)
    const alert = crit.length ? { name: crit[0].name, loadPct: crit[0].load } : null
    if (alert && !reduced) pulse.pulse(crit[0].coords)

    counter += 1
    history.push({ t: counter, mw: totalMw })
    if (history.length > HISTORY_LEN) history.shift()

    onTick({
      postes: states
        .map((s) => ({
          id: s.id,
          name: s.name,
          loadPct: s.load,
          mw: s.cfg.capMva * s.load,
          status: statusFor(s.load),
        }))
        .sort((a, b) => b.loadPct - a.loadPct),
      totalMw,
      history: [...history],
      alert,
      vehicles: routes.length,
    })
  }

  let fleetTl: gsap.core.Tween | null = null

  if (reduced) {
    renderFleet(0)
  } else {
    const fleet = { t: 0 }
    fleetTl = gsap.to(fleet, {
      t: 1,
      duration: FLEET_LOOP_SEC,
      ease: 'none',
      repeat: -1,
      onUpdate: () => renderFleet(fleet.t),
    })
  }

  tick()
  const tickTimer = setInterval(tick, 1000)

  return {
    detach() {
      clearInterval(tickTimer)
      fleetTl?.kill()
      glowTween?.kill()
      gsap.killTweensOf(postes.map((p) => p.pin))
      pulse.remove()
      resolvedPulse.remove()
      flowHandle.detach()
      closePoiPopup()
      for (const p of postes) p.marker.remove()
      for (const id of [LYR_VEH, LYR_VEH_GLOW, LYR_TRAIL]) if (map.getLayer(id)) map.removeLayer(id)
      for (const id of [SRC_VEH, SRC_TRAIL]) if (map.getSource(id)) map.removeSource(id)
    },
    getPostLngLat(id) {
      return posteById.get(id)?.coords ?? null
    },
    showTooltip(id) {
      posteById.get(id)?.showTip()
    },
    hideTooltip() {
      for (const p of postes) p.hideTip()
    },
    triggerSurcharge(id) {
      if (incidentId == null || id !== incidentId) return
      if (surchargeActive) return // idempotent : pas de re-pop si déjà en surcharge
      surchargeActive = true
      const p = incidentPoste()
      if (!p || reduced) return
      // « Pop » d'alerte : le pin gonfle puis revient, + halo rouge persistant.
      gsap.fromTo(
        p.pin,
        { scale: 1 },
        {
          scale: 1.22,
          duration: 0.26,
          ease: 'back.out(2.2)',
          transformOrigin: '50% 90%',
          yoyo: true,
          repeat: 1,
        },
      )
      glowTween?.kill()
      glowTween = gsap.to(p.pin, { filter: PIN_GLOW_FILTER, duration: 0.5, ease: 'power2.out' })
    },
    resetIncident() {
      surchargeActive = false
      lastIncidentDone = false
      const p = incidentPoste()
      if (!p) return
      glowTween?.kill()
      if (!reduced) gsap.to(p.pin, { filter: PIN_BASE_FILTER, duration: 0.4, ease: 'power2.out' })
      else p.pin.style.filter = PIN_BASE_FILTER
    },
    openPost(id) {
      const p = posteById.get(id)
      const props = propsById.get(id)
      if (!p || !props) return
      openPoiPopup(map, props, p.coords, { fly: false })
    },
    popupOpen() {
      return isPoiPopupOpen()
    },
    closePopup() {
      closePoiPopup()
    },
  }
}
