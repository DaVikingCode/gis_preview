import { useRef } from 'react'
import { createPortal } from 'react-dom'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SmoothCursor } from '@/components/ui/smooth-cursor'
import { useTourStore } from '@/store/tour-store'
import { STEPS } from '@/tour/steps'
import { dispatchCursor } from '@/animations/tourCursor'

// Bouton icône « Couches » sur la carte (remplace l'ancien sélecteur de fonds).
// Ouvre le panneau catalogue (LayersPresentationModal) via le flag layersPanelOpen.
// Pendant le step « Catalogue de couches », un faux curseur scripté (même
// SmoothCursor que la Mesure) glisse jusqu'au bouton et le « clique » pour
// déclencher l'ouverture — au lieu que la modale s'affiche d'elle-même.
export function LayersButton() {
  const rootRef = useRef<HTMLDivElement>(null)
  const id = useTourStore((s) => STEPS[s.currentStep]?.id)
  const layersPanelOpen = useTourStore((s) => s.layersPanelOpen)
  const setLayersPanelOpen = useTourStore((s) => s.setLayersPanelOpen)

  const active = id === 'layers-overview' && !layersPanelOpen

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
        onUpdate: () => {
          const t = g.t
          const mt = 1 - t
          const x = mt * mt * sx + 2 * mt * t * cx + t * t * ex
          const y = mt * mt * sy + 2 * mt * t * cy + t * t * ey
          dispatchCursor(x, y)
        },
      })

      // ── Clic visible : le bouton s'enfonce sèchement, une onde concentrique se
      // propage et un halo s'allume, puis le bouton rebondit. Le curseur reste
      // immobile (pas de mouvement vertical) pour ne jamais pivoter.
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
        { boxShadow: '0 0 0 0 rgba(170,59,255,0)' },
        { boxShadow: '0 0 24px 5px rgba(170,59,255,0.6)', duration: 0.13, ease: 'power2.out' },
        CLICK,
      )
      tl.to(
        btn,
        { boxShadow: '0 0 0 0 rgba(170,59,255,0)', duration: 0.6, ease: 'power2.out' },
        `${CLICK}+=0.13`,
      )

      // Ouvre le panneau une fois le clic clairement perçu (onde bien propagée).
      tl.call(() => setLayersPanelOpen(true), undefined, `${CLICK}+=0.42`)
    },
    { dependencies: [active], scope: rootRef, revertOnUpdate: true },
  )

  return (
    <>
      <div ref={rootRef} className="absolute top-4 left-4" style={{ zIndex: 100100 }}>
        <div className="relative w-fit">
          {/* Clic réel désactivé (sans l'attribut `disabled` natif qui grise le
              bouton) : seul le faux curseur l'« ouvre ». L'apparence reste active. */}
          <Button
            id="layers-open-button"
            size="icon"
            variant="secondary"
            aria-label="Catalogue de couches"
            title="Couches"
            className="bg-card/90 backdrop-blur-md border shadow-lg"
          >
            <Layers />
          </Button>
          {/* Onde de clic (faux curseur). Repos : invisible ; animée en GSAP. */}
          <span
            data-ripple
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-lg border-2 border-[#aa3bff] bg-[#aa3bff]/15 opacity-0"
          />
        </div>
      </div>
      {/* Faux curseur scripté : portalé à <body>, z au-dessus de l'overlay driver
          pour rester visible le long du glissement. rotate=false → ne pivote pas. */}
      {active &&
        createPortal(
          <SmoothCursor
            scripted
            hideSystemCursor={false}
            rotate={false}
            restAngle={-35}
            zIndex={1000000100}
          />,
          document.body,
        )}
    </>
  )
}
