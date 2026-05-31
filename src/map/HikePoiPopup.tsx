import { useRef } from 'react'
import { Mountain, Route } from 'lucide-react'
import { usePoiPopupReveal } from '@/hooks/animations/usePoiPopupReveal'
import type { HikePoiResolved } from '@/data/sample-hike-pois'

// Popup « point d'intérêt » du sentier d'altitude (step « Terrain 3D · randonnée »).
// Thème alpin (glacier cyan + sentier ambre) cohérent avec le tracé et le randonneur —
// volontairement distinct du POIPopup électrique (rouge). Auto-piloté par la boucle GSAP :
// pas de bouton de fermeture ni de stepper. L'entrée (pop + halo respirant) réutilise
// usePoiPopupReveal ; le halo prend une teinte cyan via le gradient inline ci-dessous.
export function HikePoiPopup({ poi }: { poi: HikePoiResolved }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const haloRef = useRef<HTMLDivElement>(null)

  usePoiPopupReveal(rootRef, haloRef)

  return (
    <div ref={rootRef} className="relative w-80" style={{ transformOrigin: 'center bottom' }}>
      <div
        ref={haloRef}
        aria-hidden
        className="pointer-events-none absolute -inset-1 rounded-2xl"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(34,211,238,0.32), rgba(34,211,238,0) 70%)',
          filter: 'blur(6px)',
        }}
      />
      <div
        className="relative overflow-hidden rounded-xl border-2 bg-card text-card-foreground"
        style={{
          borderColor: 'color-mix(in oklab, #22d3ee 42%, transparent)',
          boxShadow:
            '0 0 0 1px rgba(34,211,238,0.18), 0 20px 50px -15px rgba(34,211,238,0.4), 0 8px 24px -10px rgba(0,0,0,0.45)',
        }}
      >
        {/* Liseré sentier (cyan → ambre), évoque la transition glacier → altitude. */}
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 z-10 h-[3px]"
          style={{ background: 'linear-gradient(90deg, #22d3ee 0%, #67e8f9 45%, #fbbf24 100%)' }}
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
          {/* Lecture d'altitude — chip en verre, chiffre tabulaire. */}
          <div
            className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full px-2.5 py-1 backdrop-blur-md"
            style={{
              background: 'rgba(8,12,16,0.55)',
              border: '1px solid rgba(251,191,36,0.5)',
            }}
          >
            <Mountain className="size-3 text-amber-300" />
            <span className="text-[13px] font-semibold tabular-nums text-amber-200">
              {poi.alt.toLocaleString('fr-FR')}
              <span className="ml-0.5 text-[10px] font-medium text-amber-200/70">m</span>
            </span>
          </div>
          <span className="absolute bottom-2.5 left-3 z-10 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
            Point d’intérêt
          </span>
        </div>

        <div className="px-4 pb-3.5 pt-3">
          <h3 className="text-lg font-semibold leading-tight">{poi.name}</h3>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{poi.description}</p>

          <div className="mt-3 flex items-center justify-between border-t border-cyan-500/15 pt-2.5">
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Route className="size-3 text-amber-400" />
              Sentier · km {poi.dist.toFixed(1)}
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
              <span className="text-[9px] font-semibold uppercase tracking-wider text-cyan-300">
                En vue
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
