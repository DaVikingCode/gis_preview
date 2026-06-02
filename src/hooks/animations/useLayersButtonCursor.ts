import type { RefObject } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { dispatchCursor } from '@/animations/tourCursor'
import { useCursorAim } from '@/hooks/animations/useCursorAim'

// Geste scripté du step « Catalogue de couches » : le faux curseur glisse (arc Bézier,
// orienté le long de la courbe) jusqu'au bouton Couches et le « clique » → ouverture du
// panneau. Le clic n'anime que le bouton (pas de déplacement du curseur) → le curseur
// conserve son angle d'approche. En reduced-motion : ouverture directe sans geste.
export function useLayersButtonCursor(
  rootRef: RefObject<HTMLDivElement | null>,
  active: boolean,
  setLayersPanelOpen: (open: boolean) => void,
) {
  const aim = useCursorAim()
  useGSAP(
    () => {
      const root = rootRef.current
      if (!active || !root) return
      const btn = root.querySelector<HTMLElement>('#layers-open-button')
      if (!btn) return
      const ripple = root.querySelector<HTMLElement>('[data-ripple]')
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

      // Sans choreography : on ouvre directement après un court délai.
      if (reduced) {
        gsap.delayedCall(0.5, () => setLayersPanelOpen(true))
        return
      }

      const center = () => {
        const r = btn.getBoundingClientRect()
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
      }

      // Timeline construite synchrone (donc dans le contexte useGSAP → revert auto).
      // Léger délai pour laisser apparaître la popover driver.js avant le geste.
      const tl = gsap.timeline({ delay: 0.55 })

      // ── Glissement « main humaine » : courbe de Bézier quadratique de l'amorce
      // (bas-droite du bouton) jusqu'au centre, point de contrôle décalé
      // perpendiculairement à la corde → trajectoire arquée, pas une ligne droite.
      let sx = 0
      let sy = 0
      let ex = 0
      let ey = 0
      let cx = 0
      let cy = 0
      tl.call(() => {
        const c = center()
        ex = c.x
        ey = c.y
        sx = c.x + 124
        sy = c.y + 132
        const mx = (sx + ex) / 2
        const my = (sy + ey) / 2
        const dx = ex - sx
        const dy = ey - sy
        const len = Math.hypot(dx, dy) || 1
        const arc = 64 // amplitude de la courbe
        cx = mx + (-dy / len) * arc
        cy = my + (dx / len) * arc
        dispatchCursor(sx, sy)
      })
      const g = { t: 0 }
      tl.to(g, {
        t: 1,
        duration: 0.82,
        ease: 'power2.inOut',
        // Oriente la pointe le long de la courbe (tangente Bézier).
        onUpdate: () => aim.bezier(g.t, { x: sx, y: sy }, { x: cx, y: cy }, { x: ex, y: ey }),
      })

      // ── Clic visible : le bouton s'enfonce sèchement, une onde concentrique se
      // propage et un halo s'allume, puis le bouton rebondit. Le curseur ne bouge pas
      // (pas de déplacement vertical) → il conserve son angle d'approche.
      const CLICK = 'click'
      tl.addLabel(CLICK)
      tl.to(btn, { scale: 0.84, duration: 0.13, ease: 'power3.in' }, CLICK)
      tl.to(btn, { scale: 1, duration: 0.55, ease: 'back.out(3)' }, `${CLICK}+=0.13`)
      if (ripple) {
        tl.fromTo(
          ripple,
          { scale: 0.6, opacity: 0.9 },
          { scale: 2.8, opacity: 0, duration: 0.62, ease: 'power2.out' },
          CLICK,
        )
      }
      tl.fromTo(
        btn,
        { boxShadow: '0 0 0 0 rgba(255, 235, 4, 0)' },
        { boxShadow: '0 0 24px 5px rgba(255, 235, 4, 0.6)', duration: 0.13, ease: 'power2.out' },
        CLICK,
      )
      tl.to(
        btn,
        { boxShadow: '0 0 0 0 rgba(255, 235, 4, 0)', duration: 0.6, ease: 'power2.out' },
        `${CLICK}+=0.13`,
      )

      // Ouvre le panneau une fois le clic clairement perçu (onde bien propagée).
      tl.call(() => setLayersPanelOpen(true), undefined, `${CLICK}+=0.42`)
    },
    { dependencies: [active], scope: rootRef, revertOnUpdate: true },
  )
}
