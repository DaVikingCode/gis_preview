import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { Area, AreaChart, YAxis } from 'recharts'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useMapDataStore } from '@/store/map-data-store'
import { RT_TOTAL_CAP_MVA } from '@/data/sample-realtime'
import type { RealtimeStatus } from '@/map/layers/realtime'

const STATUS_COLOR: Record<RealtimeStatus, string> = {
  ok: '#34d399',
  warn: '#fbbf24',
  crit: '#f87171',
}
const CEILING = Math.ceil(RT_TOTAL_CAP_MVA)
const chartConfig: ChartConfig = { mw: { label: 'Charge', color: '#34d399' } }
const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Nom court : on retire le code « P-xxxx » pour ne garder que le lieu.
const shortName = (name: string) => name.replace(/^P-\d+\s*/, '')

export function RealtimeChart() {
  const rt = useMapDataStore((s) => s.realtime)
  const root = useRef<HTMLDivElement>(null)
  const mwRef = useRef<HTMLSpanElement>(null)
  const dotRef = useRef<HTMLSpanElement>(null)

  const reduced = prefersReduced()
  const totalMw = rt?.totalMw ?? 0
  const critKey =
    rt?.postes
      .filter((p) => p.status === 'crit')
      .map((p) => p.id)
      .join(',') ?? ''

  // Révélation à l'entrée + pouls du badge « En direct ».
  useGSAP(
    () => {
      if (reduced || !rt) return
      gsap.from('[data-rt-section]', {
        autoAlpha: 0,
        y: 8,
        duration: 0.4,
        stagger: 0.08,
        ease: 'power2.out',
      })
      gsap.from('[data-rt-row]', {
        autoAlpha: 0,
        x: 10,
        duration: 0.3,
        stagger: 0.03,
        delay: 0.15,
        ease: 'power2.out',
      })
      if (dotRef.current) {
        gsap.to(dotRef.current, {
          scale: 1.6,
          opacity: 0.35,
          duration: 0.85,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        })
      }
    },
    { scope: root, dependencies: [!!rt] },
  )

  // Flash du chiffre de charge à chaque mise à jour.
  useGSAP(
    () => {
      if (reduced || !mwRef.current) return
      gsap.fromTo(
        mwRef.current,
        { scale: 1.08, color: '#34d399' },
        { scale: 1, color: '', duration: 0.5, ease: 'power2.out', clearProps: 'color,scale' },
      )
    },
    { scope: root, dependencies: [Math.round(totalMw * 10)] },
  )

  // Clignotement doux des postes en surcharge + entrée du bandeau d'alerte.
  useGSAP(
    () => {
      if (reduced) return
      if (root.current?.querySelector('[data-rt-crit]')) {
        gsap.to('[data-rt-crit]', {
          opacity: 0.4,
          duration: 0.6,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        })
      }
      if (root.current?.querySelector('[data-rt-alert]')) {
        gsap.from('[data-rt-alert]', { autoAlpha: 0, y: 6, duration: 0.35, ease: 'back.out(1.6)' })
      }
    },
    // revertOnUpdate : tue le clignotement précédent avant d'en recréer un quand
    // l'ensemble des postes critiques change (sinon les tweens infinis s'empilent).
    { scope: root, dependencies: [critKey], revertOnUpdate: true },
  )

  if (!rt) {
    return (
      <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
        Connexion au flux temps réel…
      </div>
    )
  }

  const counts = { ok: 0, warn: 0, crit: 0 }
  for (const p of rt.postes) counts[p.status] += 1

  return (
    <div ref={root}>
      <div data-rt-section className="flex items-start justify-between">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span
              ref={mwRef}
              className="origin-left text-2xl font-semibold tabular-nums text-foreground sm:text-3xl"
            >
              {totalMw.toFixed(1)}
            </span>
            <span className="text-sm font-medium text-muted-foreground">MW</span>
          </div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Charge réseau · {rt.postes.length} postes
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-2 py-1">
          <span ref={dotRef} className="h-2 w-2 rounded-full bg-red-500" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-red-400">
            En direct
          </span>
        </div>
      </div>

      <div data-rt-section className="mt-2 sm:mt-3">
        <ChartContainer config={chartConfig} className="h-16 w-full sm:h-24">
          <AreaChart data={rt.history} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="rt-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis hide domain={[0, CEILING]} />
            <Area
              type="monotone"
              dataKey="mw"
              stroke="#34d399"
              strokeWidth={2}
              fill="url(#rt-grad)"
              isAnimationActive={false}
              dot={false}
            />
          </AreaChart>
        </ChartContainer>
      </div>

      <div
        data-rt-section
        className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground"
      >
        <Legend color={STATUS_COLOR.ok} label="nominaux" n={counts.ok} />
        <Legend color={STATUS_COLOR.warn} label="surveillés" n={counts.warn} />
        <Legend color={STATUS_COLOR.crit} label="alertes" n={counts.crit} />
      </div>

      <Separator className="my-2 sm:my-3" />

      <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        Charge par poste
      </div>
      <ScrollArea className="h-20 pr-2 sm:h-32">
        <div className="space-y-1.5">
          {rt.postes.map((p) => (
            <div key={p.id} data-rt-row className="flex items-center gap-2">
              <span
                {...(p.status === 'crit' ? { 'data-rt-crit': true } : {})}
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: STATUS_COLOR[p.status] }}
              />
              <span className="w-24 shrink-0 truncate text-xs text-muted-foreground">
                {shortName(p.name)}
              </span>
              <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted/40">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out"
                  style={{
                    width: `${Math.min(100, p.loadPct * 100)}%`,
                    backgroundColor: STATUS_COLOR[p.status],
                  }}
                />
              </div>
              <span className="w-9 shrink-0 text-right text-xs tabular-nums">
                {Math.round(p.loadPct * 100)}%
              </span>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground sm:mt-3">
        <span style={{ color: '#22d3ee' }}>▰</span>
        {rt.vehicles} équipes en intervention
      </div>

      {rt.alert && (
        <div
          data-rt-alert
          className="mt-2 flex items-center gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-300"
        >
          <span aria-hidden>⚠</span>
          <span className="flex-1 truncate">{shortName(rt.alert.name)} en surcharge</span>
          <span className="font-semibold tabular-nums">{Math.round(rt.alert.loadPct * 100)}%</span>
        </div>
      )}

      <p className="mt-3 hidden text-[11px] text-muted-foreground sm:block">
        Supervision en temps réel, mise à jour en continu.
      </p>
    </div>
  )
}

function Legend({ color, label, n }: { color: string; label: string; n: number }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="tabular-nums font-medium text-foreground">{n}</span>
      {label}
    </span>
  )
}
