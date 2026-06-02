import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SmoothCursor } from '@/components/ui/smooth-cursor'
import { useTourStore } from '@/store/tour-store'
import { STEPS } from '@/tour/steps'
import { useLayersButtonCursor } from '@/hooks/animations/useLayersButtonCursor'

// Au step « Catalogue de couches », un faux curseur scripté « clique » ce bouton
// pour ouvrir la modale, au lieu qu'elle s'affiche d'elle-même.
export function LayersButton() {
  const rootRef = useRef<HTMLDivElement>(null)
  const id = useTourStore((s) => STEPS[s.currentStep]?.id)
  const layersPanelOpen = useTourStore((s) => s.layersPanelOpen)
  const setLayersPanelOpen = useTourStore((s) => s.setLayersPanelOpen)

  const active = id === 'layers-overview' && !layersPanelOpen

  useLayersButtonCursor(rootRef, active, setLayersPanelOpen)

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
            className="pointer-events-none absolute inset-0 rounded-lg border-2 border-[#FFEB04] bg-[#FFEB04]/15 opacity-0"
          />
        </div>
      </div>
      {/* Portalé à <body>, z au-dessus de l'overlay driver. rotate=false : l'orientation
          vient de l'angle dispatché par la timeline (useLayersButtonCursor), pas de la
          vélocité. restAngle=-35 = inclinaison initiale avant le geste. */}
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
