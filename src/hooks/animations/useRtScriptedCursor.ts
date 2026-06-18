import { useEffect, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { useMap } from '@/map/MapContext'
import { useTourStore } from '@/store/tour-store'
import { useMapDataStore } from '@/store/map-data-store'
import { createTourCursor, projectClient } from '@/animations/tourCursor'
import { showSurchargeToast, dismissSurchargeToast } from '@/components/IncidentToast'
import { STEPS, getRealtimeHandle, HTA_INCIDENT_ID, HTA_HOVER_IDS } from '@/tour/steps'

// Cadrage du poste incident pendant le climax — DOIT matcher la caméra du step
// rt-todo pour que l'avancée vers « À faire » soit instantanée (aucun saut).
const SURCHARGE_ZOOM = 15.2
// Temps d'observation de la surcharge + lecture du toast avant que le curseur bouge.
const SURCHARGE_HOLD_SEC = 1.1
// Durée du vol overview → poste (déclenché par le clic « Localiser »).
const SURCHARGE_FLY_MS = 2800
// Filet de sécurité : si le geste/vol est interrompu, on lève QUAND MÊME la gate
// (« Suivant » ne doit jamais rester coincée). > durée totale du geste + vol.
const SURCHARGE_SAFETY_SEC = 8

// Faux curseur de la séquence HTA, synchronisé avec la couche temps réel :
//  · `rt-supervision` : balaie plusieurs postes et affiche leur fiche express.
//  · `rt-surcharge` (climax) : le curseur glisse du poste rouge jusqu'au bouton
//    « Localiser » du toast et le clique → vol sur le poste + fiche + gate.
export function useRtScriptedCursor() {
  const map = useMap()
  const id = useTourStore((s) => STEPS[s.currentStep]?.id)
  const flying = useTourStore((s) => s.flying)
  // Sur saut (clic stepper), l'état est posé en snapshot par onEnter : on ne rejoue
  // pas la chorégraphie du curseur (balayage / vol+clic).
  const navMode = useTourStore((s) => s.navMode)
  // Re-déclenche les gestes une fois la couche live prête (1er tick).
  const feedReady = useMapDataStore((s) => s.realtime !== null)
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [hidden, setHidden] = useState(false)

  // Curseur ré-affiché à chaque changement d'étape (avant de rejouer le geste).
  // Note : le SmoothCursor reste invisible tant qu'aucun pointermove scripté n'a
  // été émis — pas de curseur fantôme pendant l'observation/vol de la surcharge.
  useEffect(() => setHidden(false), [id])

  // Supervision : balayage de plusieurs postes (fiche express), puis on cache.
  useGSAP(
    () => {
      if (id !== 'rt-supervision' || flying || reduced || navMode === 'jump') return
      const rt = getRealtimeHandle()
      if (!rt) return
      const cursor = createTourCursor(map, { aim: true })
      const tl = gsap.timeline({ delay: 0.6, defaults: { ease: 'power2.inOut' } })
      for (const pid of HTA_HOVER_IDS) {
        const ll = rt.getPostLngLat(pid)
        if (!ll) continue
        cursor.glideTo(tl, ll, { at: '>', duration: 0.7 })
        tl.call(() => rt.showTooltip(pid), [], '>')
        tl.to({}, { duration: 0.85 })
        tl.call(() => rt.hideTooltip(), [], '>')
      }
      tl.call(() => setHidden(true))
      return () => rt.hideTooltip()
    },
    { dependencies: [id, flying, feedReady, navMode], revertOnUpdate: true },
  )

  // Surcharge : la gate ne se lève qu'à l'atterrissage du vol (moveend).
  useGSAP(
    () => {
      if (id !== 'rt-surcharge' || flying || navMode === 'jump') return
      const rt = getRealtimeHandle()
      if (!rt) return
      const ll = rt.getPostLngLat(HTA_INCIDENT_ID)
      if (!ll) return

      let cancelled = false
      let committed = false
      let localized = false

      // Fiche ouverte + statut + gate levée — idempotent (moveend ET filet y mènent).
      const commitOnce = () => {
        if (committed) return
        committed = true
        rt.openPost(HTA_INCIDENT_ID)
        useMapDataStore.getState().setPOIStatus(String(HTA_INCIDENT_ID), 'todo')
        // Déverrouille « Suivant » (gate du step rt-surcharge).
        useTourStore.getState().setIncidentClicked(true)
      }

      // « Localiser » : vol overview → poste. La gate ne se lève qu'à l'atterrissage
      // (moveend) — « Suivant » reste verrouillé pendant tout le vol.
      const localize = () => {
        if (localized) return
        localized = true
        dismissSurchargeToast()
        if (reduced) {
          map.jumpTo({ center: ll, zoom: SURCHARGE_ZOOM })
          commitOnce()
          return
        }
        map.flyTo({
          center: ll,
          zoom: SURCHARGE_ZOOM,
          duration: SURCHARGE_FLY_MS,
          curve: 1.42,
          essential: true,
        })
        map.once('moveend', () => {
          if (!cancelled) commitOnce()
        })
      }

      // Toast d'alerte persistant : son bouton « Localiser » appelle localize().
      showSurchargeToast(localize)

      // Filet de sécurité : la gate se lève même si le geste/vol est coupé.
      const safety = gsap.delayedCall(SURCHARGE_SAFETY_SEC, () => {
        dismissSurchargeToast()
        commitOnce()
      })

      if (reduced) {
        // Pas de curseur : on laisse voir le toast un instant puis on localise.
        const auto = gsap.delayedCall(SURCHARGE_HOLD_SEC, localize)
        return () => {
          cancelled = true
          auto.kill()
          safety.kill()
          dismissSurchargeToast()
        }
      }

      const cursor = createTourCursor(map, { aim: true })
      let glideTl: gsap.core.Timeline | null = null

      // 1) surcharge observée + toast affiché, 2) le curseur part du poste rouge et
      // glisse jusqu'au bouton « Localiser », 3) clic réel → vol + fiche.
      const gesture = gsap.delayedCall(SURCHARGE_HOLD_SEC, () => {
        if (cancelled) return
        const btn = document.querySelector<HTMLButtonElement>('[data-rt-localize]')
        if (!btn) {
          // Toast/bouton absent (cas limite) : on localise directement.
          localize()
          return
        }
        const r = btn.getBoundingClientRect()
        const target = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
        const from = projectClient(map, ll) // départ : le poste rouge (centre carte)
        const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } })
        glideTl = tl
        cursor.glideToPoint(tl, target, { at: 0, duration: 1, from })
        tl.addLabel('press', '>')
        cursor.pressAtPoint(tl, target, { at: 'press' })
        // Retour tactile sur le bouton (enfoncement) + clic réel synchronisé.
        tl.to(
          btn,
          { scale: 0.94, duration: 0.1, ease: 'power2.in', transformOrigin: '50% 50%' },
          'press',
        )
        tl.to(btn, { scale: 1, duration: 0.24, ease: 'back.out(2.4)' }, 'press+=0.1')
        tl.call(
          () => {
            // Clic réel (un humain cliquerait pareil) + appel direct garanti :
            // selon le portage du toast, le clic synthétique peut ne pas atteindre
            // le délégué React — localize() (idempotent) sécurise le déclenchement.
            btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
            localize()
          },
          [],
          'press+=0.12',
        )
        tl.call(() => setHidden(true), [], 'press+=0.7')
      })

      return () => {
        cancelled = true
        gesture.kill()
        safety.kill()
        glideTl?.kill()
        dismissSurchargeToast()
      }
    },
    { dependencies: [id, flying, feedReady, navMode], revertOnUpdate: true },
  )

  return { hidden }
}
