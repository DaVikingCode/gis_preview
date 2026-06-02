import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { useMap } from '@/map/MapContext'
import { useTourStore } from '@/store/tour-store'
import { createTourCursor } from '@/animations/tourCursor'
import { applyBasemap } from '@/tour/TourController'
import { STEPS, THEME_FLIP_STEP_ID } from '@/tour/steps'

// Durée du reveal View Transition de l'AnimatedThemeToggler (doit matcher son
// prop `duration` côté sidebar). On enchaîne le swap de fond de plan juste après,
// caché sous le voile, pour une lecture « un seul changement de thème ».
const VT_MS = 650

// Step « Thème » : le curseur clique le toggle (reveal radial light→dark), un voile
// couvre la carte le temps du wipe, puis on bascule le fond vers Carto dark-matter sous
// le voile avant de le retirer en fondu. La gate `themeFlipDone` se lève à ce moment.
export function useThemeFlipCursor() {
  const map = useMap()
  const id = useTourStore((s) => STEPS[s.currentStep]?.id)
  const flying = useTourStore((s) => s.flying)
  const done = useTourStore((s) => s.themeFlipDone)
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [hidden, setHidden] = useState(false)
  const scrimRef = useRef<HTMLDivElement>(null)

  useEffect(() => setHidden(false), [id])

  useGSAP(
    () => {
      if (id !== THEME_FLIP_STEP_ID || flying || done) return
      const btn = document.querySelector<HTMLButtonElement>('#gp-theme-toggle')
      if (!btn) return

      let cancelled = false
      let committed = false
      let basemapDelay: gsap.core.Tween | null = null

      // Bascule réelle : clic sur le toggle (reveal radial + .dark via le composant),
      // puis swap du fond de plan vers dark-matter sous le voile, enfin fondu du voile.
      const flip = () => {
        if (committed || cancelled) return
        committed = true
        // Déclenche l'onClick de l'AnimatedThemeToggler (un humain cliquerait pareil).
        btn.click()

        // Une fois le fond dark prêt, on retire le voile en fondu pour le révéler.
        const revealMap = () => {
          if (cancelled) return
          void applyBasemap(map, 'darkmatter').then(() => {
            if (cancelled) return
            useTourStore.getState().setBasemap('darkmatter')
            const scrim = scrimRef.current
            if (!scrim) return
            if (reduced) scrim.style.opacity = '0'
            else gsap.to(scrim, { opacity: 0, duration: 0.45, ease: 'power1.out' })
          })
        }

        // On laisse le reveal radial se terminer avant de toucher au fond de plan.
        if (reduced) revealMap()
        else basemapDelay = gsap.delayedCall(VT_MS / 1000, revealMap)

        // Déverrouille « Suivant ».
        useTourStore.getState().setThemeFlipDone(true)
      }

      if (reduced) {
        const auto = gsap.delayedCall(0.6, flip)
        return () => {
          cancelled = true
          auto.kill()
        }
      }

      const cursor = createTourCursor(map, { aim: true })
      const r = btn.getBoundingClientRect()
      const target = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
      // Départ depuis le centre de l'écran : le curseur traverse vers la sidebar.
      const from = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
      const tl = gsap.timeline({ delay: 0.7, defaults: { ease: 'power2.inOut' } })
      cursor.glideToPoint(tl, target, { at: 0, duration: 1.1, from })
      tl.addLabel('press', '>')
      cursor.pressAtPoint(tl, target, { at: 'press' })
      // Retour tactile sur le bouton (enfoncement) synchronisé avec le clic.
      tl.to(
        btn,
        { scale: 0.92, duration: 0.1, ease: 'power2.in', transformOrigin: '50% 50%' },
        'press',
      )
      tl.to(btn, { scale: 1, duration: 0.24, ease: 'back.out(2.4)' }, 'press+=0.1')
      tl.call(flip, [], 'press+=0.12')
      tl.call(() => setHidden(true), [], 'press+=0.8')

      return () => {
        cancelled = true
        tl.kill()
        basemapDelay?.kill()
        if (scrimRef.current) gsap.killTweensOf(scrimRef.current)
      }
    },
    // `done` n'est PAS une dépendance : le passer à true (fin du flip) ne doit pas
    // re-jouer/réinitialiser l'effet et tuer la séquence en cours. Le garde en tête
    // de callback suffit à ne pas rejouer le geste. `id` couvre l'aller/retour.
    { dependencies: [id, flying], revertOnUpdate: true },
  )

  return { hidden, scrimRef }
}
