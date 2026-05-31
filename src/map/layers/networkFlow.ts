import type { Map as MLMap } from 'maplibre-gl'
import gsap from 'gsap'
import { SAMPLE_HTA_LINES } from '@/data/sample-pois'

// Réseau HTA rendu en « courant qui circule » : trait de base discret + tirets
// animés (line-dasharray défilant). Partagé par la tournée HTA et la supervision
// temps réel pour un rendu strictement identique.

const SRC = 'rt-flow-src'
const LYR_BASE = 'rt-flow-base'
const LYR_DASH = 'rt-flow'
const FLOW = '#FFEB04'

// Séquence « fourmis qui marchent » officielle MapLibre (line-dasharray ne peut
// pas être animé en continu → on fait défiler une liste de motifs).
const DASH_SEQ: number[][] = [
  [0, 4, 3],
  [0.5, 4, 2.5],
  [1, 4, 2],
  [1.5, 4, 1.5],
  [2, 4, 1],
  [2.5, 4, 0.5],
  [3, 4, 0],
  [0, 0.5, 3, 3.5],
  [0, 1, 3, 3],
  [0, 1.5, 3, 2.5],
  [0, 2, 3, 2],
  [0, 2.5, 3, 1.5],
  [0, 3, 3, 1],
  [0, 3.5, 3, 0.5],
]

export type NetworkFlowHandle = { detach: () => void }

export function addNetworkFlow(map: MLMap): NetworkFlowHandle {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (!map.getSource(SRC)) map.addSource(SRC, { type: 'geojson', data: SAMPLE_HTA_LINES })
  if (!map.getLayer(LYR_BASE)) {
    map.addLayer({
      id: LYR_BASE,
      type: 'line',
      source: SRC,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': FLOW, 'line-width': 2, 'line-opacity': 0.1 },
    })
  }
  if (!map.getLayer(LYR_DASH)) {
    map.addLayer({
      id: LYR_DASH,
      type: 'line',
      source: SRC,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': FLOW,
        'line-width': 2,
        'line-opacity': 0.55,
        'line-blur': 0.6,
        'line-dasharray': [0, 4, 3],
      },
    })
  }

  let dashTl: gsap.core.Tween | null = null
  if (!reduced) {
    let lastDash = -1
    const dash = { i: 0 }
    dashTl = gsap.to(dash, {
      i: DASH_SEQ.length,
      duration: DASH_SEQ.length * 0.11,
      ease: 'none',
      repeat: -1,
      onUpdate: () => {
        const idx = Math.floor(dash.i) % DASH_SEQ.length
        if (idx !== lastDash) {
          lastDash = idx
          if (map.getLayer(LYR_DASH))
            map.setPaintProperty(LYR_DASH, 'line-dasharray', DASH_SEQ[idx])
        }
      },
    })
  }

  return {
    detach() {
      dashTl?.kill()
      for (const id of [LYR_DASH, LYR_BASE]) if (map.getLayer(id)) map.removeLayer(id)
      if (map.getSource(SRC)) map.removeSource(SRC)
    },
  }
}
