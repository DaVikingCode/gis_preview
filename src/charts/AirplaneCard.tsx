import { useMapDataStore } from '@/store/map-data-store'

// Panneau « Survol 3D » : télémétrie de vol fictive (altitude, vitesse, cap) lue
// depuis le store, alimentée par la boucle GSAP de airplane3d.ts. Le cap pilote
// une petite rose des vents qui pivote en direct.
export function AirplaneCard() {
  const stats = useMapDataStore((s) => s.flightStats)
  const heading = stats?.headingDeg ?? 0

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-semibold tabular-nums text-foreground">
              {stats ? Math.round(stats.altitudeM) : '—'}
            </span>
            <span className="text-sm font-medium text-muted-foreground">m</span>
          </div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Altitude de croisière
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-1">
          <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-300">
            En vol
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <Compass heading={heading} />
        <div className="grid flex-1 grid-cols-1 gap-2">
          <Stat label="Vitesse" value={stats ? `${stats.speedKmh} km/h` : '—'} />
          <Stat label="Cap" value={stats ? `${heading}°` : '—'} />
        </div>
      </div>

      <p className="mt-3 hidden text-[11px] text-muted-foreground sm:block">
        Modèle 3D glTF rendu via three.js dans le contexte WebGL de la carte. Trajectoire suivie en
        direct.
      </p>
    </div>
  )
}

// Rose des vents : l'aiguille pointe le cap courant (degrés, sens horaire / nord).
function Compass({ heading }: { heading: number }) {
  return (
    <div className="relative h-16 w-16 shrink-0 rounded-full border border-border/60 bg-muted/30">
      <span className="absolute left-1/2 top-1 -translate-x-1/2 text-[9px] font-semibold text-muted-foreground">
        N
      </span>
      <div
        className="absolute left-1/2 top-1/2 h-6 w-0.5 rounded-full bg-sky-400 transition-transform duration-500"
        style={{
          transform: `translate(-50%, -100%) rotate(${heading}deg)`,
          transformOrigin: 'bottom center',
        }}
      />
      <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-300" />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 px-2 py-2 text-center">
      <div className="text-sm font-semibold tabular-nums text-foreground">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  )
}
