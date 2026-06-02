import { useRef } from 'react'
import { Mountain } from 'lucide-react'
import { usePoiPopupReveal } from '@/hooks/animations/usePoiPopupReveal'
import type { HikePoiResolved } from '@/data/sample-hike-pois'

// Popup « point d'intérêt » du sentier d'altitude (step « Terrain 3D · randonnée »).
// Carte glanceable, brandée DVC (jaune #FFEB04) — distincte du POIPopup électrique (rouge).
// Auto-pilotée par la boucle GSAP : pas de bouton de fermeture ni de stepper. L'entrée
// (pop + halo respirant) réutilise usePoiPopupReveal ; le halo prend sa teinte jaune via
// le gradient inline ci-dessous.
export function HikePoiPopup({ poi }: { poi: HikePoiResolved }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const haloRef = useRef<HTMLDivElement>(null)

  usePoiPopupReveal(rootRef, haloRef)

  return (
    <div ref={rootRef} className="relative w-72" style={{ transformOrigin: 'center bottom' }}>
      <div
        ref={haloRef}
        aria-hidden
        className="pointer-events-none absolute -inset-1 rounded-2xl"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(255,235,4,0.28), rgba(255,235,4,0) 70%)',
          filter: 'blur(6px)',
        }}
      />
      <div
        className="relative overflow-hidden rounded-xl border-2 bg-card text-card-foreground"
        style={{
          borderColor: 'color-mix(in oklab, #ffeb04 42%, transparent)',
          boxShadow:
            '0 0 0 1px rgba(255,235,4,0.16), 0 20px 50px -15px rgba(0,0,0,0.55), 0 8px 24px -10px rgba(0,0,0,0.45)',
        }}
      >
        {/* Liseré marque DVC. */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 z-10 h-[3px]"
          style={{ background: '#ffeb04' }}
        />

        <div className="relative h-32 w-full">
          <img
            src={poi.photo}
            alt={poi.name}
            draggable={false}
            className="h-full w-full object-cover object-center"
          />
          {/* Dégradé bas pour la lisibilité du badge posé sur la photo. */}
          <span
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to top, rgba(8,12,16,0.85) 0%, rgba(8,12,16,0.12) 42%, transparent 70%)',
            }}
          />
          {/* Lecture d'altitude — chip en verre, chiffre tabulaire, accent jaune DVC. */}
          <div
            className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full px-2.5 py-1 backdrop-blur-md"
            style={{
              background: 'rgba(8,12,16,0.55)',
              border: '1px solid rgba(255,235,4,0.55)',
            }}
          >
            <Mountain className="size-3" style={{ color: '#ffeb04' }} />
            <span className="text-[13px] font-semibold tabular-nums text-white">
              {poi.alt.toLocaleString('fr-FR')}
              <span className="ml-0.5 text-[10px] font-medium text-white/70">m</span>
            </span>
          </div>
        </div>

        <div className="px-4 pb-3.5 pt-3">
          <h3 className="text-lg font-semibold leading-tight">{poi.name}</h3>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {poi.description}
          </p>
        </div>
      </div>
    </div>
  )
}
