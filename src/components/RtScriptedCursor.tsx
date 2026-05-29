import { useEffect, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { useMap } from '@/map/MapContext'
import { SmoothCursor } from '@/components/ui/smooth-cursor'
import { useTourStore } from '@/store/tour-store'
import { useMapDataStore } from '@/store/map-data-store'
import { createTourCursor, createTourPulse } from '@/animations/tourCursor'
import { STEPS, getRealtimeHandle, HTA_INCIDENT_ID, HTA_HOVER_IDS } from '@/tour/steps'

// Anneau « clic » sonar rouge (même teinte CRIT que la couche realtime).
const CLICK_PULSE = '#d06b63'

// Faux curseur de la séquence HTA. Deux gestes scriptés, pilotés par GSAP et
// synchronisés avec la couche temps réel (tooltips + fiche) :
//  · `rt-supervision` : balaye 2 postes en affichant leur tooltip live.
//  · `rt-todo` : glisse sur le poste en surcharge, « clique », ouvre la fiche et
//    déverrouille « Suivant » (gate incidentClicked).
// Curseur non intrusif (hideSystemCursor=false) : le vrai curseur reste visible.
export function RtScriptedCursor() {
  const map = useMap()
  const id = useTourStore((s) => STEPS[s.currentStep]?.id)
  const flying = useTourStore((s) => s.flying)
  // Re-déclenche les gestes une fois la couche live prête (1er tick).
  const feedReady = useMapDataStore((s) => s.realtime !== null)
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [hidden, setHidden] = useState(false)

  // Curseur ré-affiché à chaque changement d'étape (avant de rejouer le geste).
  useEffect(() => setHidden(false), [id])

  // ── S1 : balayage de survol (tooltips) sur quelques postes.
  useGSAP(
    () => {
      if (id !== 'rt-supervision' || flying || reduced) return
      const rt = getRealtimeHandle()
      if (!rt) return
      const cursor = createTourCursor(map)
      const tl = gsap.timeline({ delay: 0.5, defaults: { ease: 'power2.inOut' } })
      for (const pid of HTA_HOVER_IDS) {
        const ll = rt.getPostLngLat(pid)
        if (!ll) continue
        cursor.glideTo(tl, ll, { at: '>', duration: 0.9 })
        tl.call(() => rt.showTooltip(pid), [], '>')
        tl.to({}, { duration: 1.15 })
        tl.call(() => rt.hideTooltip(), [], '>')
      }
      tl.call(() => setHidden(true))
      return () => rt.hideTooltip()
    },
    { dependencies: [id, flying, feedReady], revertOnUpdate: true },
  )

  // ── S3 : glisse sur le poste en surcharge, clique → ouvre la fiche + gate.
  useGSAP(
    () => {
      if (id !== 'rt-todo' || flying) return
      const rt = getRealtimeHandle()
      if (!rt) return
      const ll = rt.getPostLngLat(HTA_INCIDENT_ID)
      if (!ll) return
      const commit = () => {
        rt.openPost(HTA_INCIDENT_ID)
        useMapDataStore.getState().setPOIStatus(String(HTA_INCIDENT_ID), 'todo')
        useTourStore.getState().setIncidentClicked(true)
      }
      if (reduced) {
        commit()
        return
      }
      const cursor = createTourCursor(map)
      const pulse = createTourPulse(map, CLICK_PULSE, 'rt-click-pulse')
      const tl = gsap.timeline({ delay: 0.5, defaults: { ease: 'power2.inOut' } })
      cursor.glideTo(tl, ll, { at: 0, duration: 0.85 })
      tl.addLabel('press', '>')
      cursor.finishAt(tl, ll, { pulse, at: 'press' })
      tl.call(commit, [], 'press+=0.18')
      tl.call(() => setHidden(true), [], 'press+=0.7')
      return () => pulse.remove()
    },
    { dependencies: [id, flying, feedReady], revertOnUpdate: true },
  )

  if (id !== 'rt-supervision' && id !== 'rt-todo') return null
  return (
    <SmoothCursor
      key={id}
      scripted
      hideSystemCursor={false}
      rotate={false}
      restAngle={-35}
      hidden={hidden}
      zIndex={100120}
    />
  )
}
