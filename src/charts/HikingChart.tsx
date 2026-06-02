import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { Area, AreaChart, ReferenceDot, XAxis, YAxis } from 'recharts'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { useMapDataStore } from '@/store/map-data-store'
import {
  altAtFraction,
  TRAIL_DISTANCE_KM,
  TRAIL_DPLUS_M,
  TRAIL_MIN_M,
  TRAIL_PROFILE,
  TRAIL_SUMMIT_M,
} from '@/data/sample-trail'
import { HIKE_POIS } from '@/data/sample-hike-pois'

const chartConfig: ChartConfig = { alt: { label: 'Altitude', color: '#22d3ee' } }
const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const ALT_MIN = Math.floor((TRAIL_MIN_M - 80) / 100) * 100
const ALT_MAX = Math.ceil((TRAIL_SUMMIT_M + 80) / 100) * 100

// Profil d'élévation du sentier (statique) + point qui suit la progression live du
// randonneur (hikeProgress, poussé par la boucle GSAP de hikingTerrain.ts).
export function HikingChart() {
  const progress = useMapDataStore((s) => s.hikeProgress)
  const activePoi = useMapDataStore((s) => s.activeHikePoi)
  const root = useRef<HTMLDivElement>(null)
  const reduced = prefersReduced()

  const curDist = progress * TRAIL_DISTANCE_KM
  const curAlt = altAtFraction(progress)

  useGSAP(
    () => {
      if (reduced) return
      gsap.from('[data-hk-section]', {
        autoAlpha: 0,
        y: 8,
        duration: 0.4,
        stagger: 0.08,
        ease: 'power2.out',
      })
    },
    { scope: root },
  )

  return (
    <div ref={root}>
      <div data-hk-section className="flex items-end justify-between">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-semibold tabular-nums text-foreground">
              {Math.round(curAlt)}
            </span>
            <span className="text-sm font-medium text-muted-foreground">m</span>
          </div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Altitude · {curDist.toFixed(1)} / {TRAIL_DISTANCE_KM.toFixed(1)} km
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-1">
          <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
            En course
          </span>
        </div>
      </div>

      <div data-hk-section className="mt-3">
        <ChartContainer config={chartConfig} className="h-24 w-full sm:h-40">
          <AreaChart data={TRAIL_PROFILE} margin={{ top: 6, right: 8, bottom: 0, left: -14 }}>
            <defs>
              <linearGradient id="hk-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="dist"
              type="number"
              domain={[0, TRAIL_DISTANCE_KM]}
              tickLine={false}
              axisLine={false}
              fontSize={10}
              tickFormatter={(v: number) => `${v.toFixed(1)}`}
            />
            <YAxis
              domain={[ALT_MIN, ALT_MAX]}
              tickLine={false}
              axisLine={false}
              fontSize={10}
              width={42}
            />
            <Area
              type="monotone"
              dataKey="alt"
              stroke="#22d3ee"
              strokeWidth={2}
              fill="url(#hk-grad)"
              isAnimationActive={false}
              dot={false}
            />
            {HIKE_POIS.map((poi, i) => {
              const active = activePoi === i
              return (
                <ReferenceDot
                  key={poi.id}
                  x={poi.dist}
                  y={poi.alt}
                  r={active ? 7 : 4}
                  fill={active ? '#fbbf24' : '#0c1a1f'}
                  stroke="#fbbf24"
                  strokeWidth={active ? 2.5 : 1.5}
                  label={
                    active
                      ? { value: poi.name, position: 'top', fill: '#fbbf24', fontSize: 10 }
                      : undefined
                  }
                />
              )
            })}
            <ReferenceDot
              x={curDist}
              y={curAlt}
              r={5}
              fill="#ecfeff"
              stroke="#22d3ee"
              strokeWidth={2.5}
            />
          </AreaChart>
        </ChartContainer>
      </div>

      <div data-hk-section className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="Distance" value={`${TRAIL_DISTANCE_KM.toFixed(1)} km`} />
        <Stat label="Dénivelé +" value={`${TRAIL_DPLUS_M} m`} />
        <Stat label="Sommet" value={`${TRAIL_SUMMIT_M} m`} />
      </div>

      <p data-hk-section className="mt-3 hidden text-[11px] text-muted-foreground sm:block">
        Relief 3D à partir d’un modèle d’élévation. Position suivie en direct.
      </p>
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
