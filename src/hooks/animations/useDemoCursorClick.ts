import type { RefObject } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { useTourStore } from '@/store/tour-store'
import { dispatchCursor } from '@/animations/tourCursor'
import { useCursorAim } from '@/hooks/animations/useCursorAim'

// Faux curseur qui amène une carte du catalogue dans la vue puis la « clique »,
// juste avant que la couche correspondante soit appliquée sur la carte.
export function useDemoCursorClick(
  rootRef: RefObject<HTMLDivElement | null>,
  viewportRef: RefObject<HTMLDivElement | null>,
  clickLayer: string | undefined,
  isImport: boolean,
) {
  const aim = useCursorAim()
  useGSAP(
    () => {
      const root = rootRef.current
      if (!clickLayer || isImport || !root) return
      const card = root.querySelector<HTMLElement>(`[data-layer-id="${clickLayer}"]`)
      const vp = viewportRef.current
      if (!card || !vp) return
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

      const advance = () => {
        const s = useTourStore.getState()
        s.jumpToStep?.(s.currentStep + 1)
      }

      // Amène la carte cible dans la vue.
      const top =
        vp.scrollTop + (card.getBoundingClientRect().top - vp.getBoundingClientRect().top) - 48
      vp.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' })

      if (reduced) {
        gsap.delayedCall(0.6, advance)
        return
      }

      // GSAP pilote seul la carte : on neutralise sa transition CSS le temps du
      // geste (sinon GSAP + transition CSS = double animation → rendu saccadé).
      gsap.set(card, { transition: 'none' })

      // Délai : laisse le scroll lissé se stabiliser avant de viser la carte.
      const tl = gsap.timeline({ delay: 0.6 })

      // Glissement « main humaine » : Bézier quadratique arqué depuis le bas-droite
      // de la carte jusqu'à son centre (point de contrôle décalé perpendiculairement
      // à la corde, pour une trajectoire courbe et non une ligne droite).
      let sx = 0
      let sy = 0
      let ex = 0
      let ey = 0
      let cx = 0
      let cy = 0
      tl.call(() => {
        const r = card.getBoundingClientRect()
        ex = r.left + r.width / 2
        ey = r.top + r.height / 2
        sx = ex + 104
        sy = ey + 124
        const mx = (sx + ex) / 2
        const my = (sy + ey) / 2
        const dx = ex - sx
        const dy = ey - sy
        const len = Math.hypot(dx, dy) || 1
        const arc = 58 // amplitude de la courbe
        cx = mx + (-dy / len) * arc
        cy = my + (dx / len) * arc
        dispatchCursor(sx, sy)
      })
      // Laisse le ressort du curseur rejoindre l'amorce (+=0.3) avant de glisser.
      const g = { t: 0 }
      tl.to(
        g,
        {
          t: 1,
          duration: 0.8,
          ease: 'power3.inOut',
          // Oriente la pointe le long de la courbe (tangente Bézier).
          onUpdate: () => aim.bezier(g.t, { x: sx, y: sy }, { x: cx, y: cy }, { x: ex, y: ey }),
        },
        '+=0.3',
      )

      const CLICK = 'click'
      tl.addLabel(CLICK)
      const press = { y: 0 }
      tl.to(
        press,
        {
          y: 18,
          duration: 0.13,
          ease: 'power2.in',
          onUpdate: () => dispatchCursor(ex, ey + press.y),
        },
        CLICK,
      )
      tl.to(
        press,
        {
          y: 0,
          duration: 0.5,
          ease: 'back.out(2.4)',
          onUpdate: () => dispatchCursor(ex, ey + press.y),
        },
        `${CLICK}+=0.13`,
      )
      tl.to(card, { scale: 0.95, duration: 0.13, ease: 'power2.in' }, CLICK)
      tl.to(card, { scale: 1, duration: 0.5, ease: 'back.out(2.6)' }, `${CLICK}+=0.13`)
      tl.fromTo(
        card,
        { boxShadow: '0 0 0 0 rgba(245,158,11,0.55)' },
        { boxShadow: '0 0 0 12px rgba(245,158,11,0)', duration: 0.66, ease: 'power2.out' },
        CLICK,
      )

      // Clic perçu → on avance vers le step « appliqué sur la carte » (la modale se
      // démonte à l'avance, donc pas besoin d'animation de relâchement).
      tl.call(advance, undefined, `${CLICK}+=0.4`)
    },
    { scope: rootRef, dependencies: [clickLayer, isImport], revertOnUpdate: true },
  )
}
