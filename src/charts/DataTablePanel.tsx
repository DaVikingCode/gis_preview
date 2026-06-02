import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Line, LineChart, ResponsiveContainer } from 'recharts'
import { TrendingDown, TrendingUp, Map as MapIcon, Table2 } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SmoothCursor } from '@/components/ui/smooth-cursor'
import { SAMPLE_TABLE, type DataRow, type RowStatus } from '@/data/sample-table'
import { CATEGORY_COLORS, setVectorHover } from '@/map/layers/vectorStyled'
import type { VectorCategory } from '@/data/sample-vectors'
import { useMapMaybe } from '@/map/MapContext'
import { useTourStore } from '@/store/tour-store'
import { STEPS } from '@/tour/steps'
import { useDataTableCursor } from '@/hooks/animations/useDataTableCursor'

const STATUS: Record<RowStatus, { label: string; dot: string; className: string }> = {
  actif: {
    label: 'Actif',
    dot: '#22c55e',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
  en_attente: {
    label: 'En attente',
    dot: '#f59e0b',
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  },
  anomalie: {
    label: 'Anomalie',
    dot: '#ef4444',
    className: 'border-red-500/30 bg-red-500/10 text-red-300',
  },
  archive: {
    label: 'Archivé',
    dot: '#94a3b8',
    className: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
  },
}

function Avatar({ initials, hue }: { initials: string; hue: number }) {
  return (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white ring-1 ring-inset ring-white/15"
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 40) % 360} 65% 42%))`,
      }}
    >
      {initials}
    </span>
  )
}

// Tiny thumbnail of the zone's real polygon — same color as its map fill.
// Exported so the import-simulation preview can reuse the exact same thumbnail.
export function ZonePreview({
  ring,
  category,
}: {
  ring: [number, number][]
  category: VectorCategory
}) {
  const color = CATEGORY_COLORS[category]
  const xs = ring.map((p) => p[0])
  const ys = ring.map((p) => p[1])
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const spanX = Math.max(...xs) - minX || 1
  const spanY = Math.max(...ys) - minY || 1
  const span = Math.max(spanX, spanY)
  const SIZE = 36
  const PAD = 4
  const inner = SIZE - PAD * 2
  const points = ring
    .map(([lng, lat]) => {
      const x = PAD + ((lng - minX + (span - spanX) / 2) / span) * inner
      const y = PAD + (1 - (lat - minY + (span - spanY) / 2) / span) * inner
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="rounded-md border border-border/60 bg-background/40"
      aria-hidden
    >
      <polygon
        points={points}
        fill={color}
        fillOpacity={0.35}
        stroke={color}
        strokeWidth={1.25}
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Sparkline({ trend }: { trend: number[] }) {
  const delta = trend[trend.length - 1] - trend[0]
  const up = delta >= 0
  const color = up ? '#22c55e' : '#ef4444'
  const data = trend.map((value, i) => ({ i, value }))
  const pct = trend[0] === 0 ? 0 : Math.round((delta / trend[0]) * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="h-9 w-24">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, bottom: 4, left: 2, right: 2 }}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={1.75}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <span
        className="inline-flex items-center gap-0.5 text-xs font-medium tabular-nums"
        style={{ color }}
      >
        {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
        {up ? '+' : ''}
        {pct}%
      </span>
    </div>
  )
}

function Row({
  row,
  index,
  active,
  interactive,
  onHover,
}: {
  row: DataRow
  index: number
  active: boolean
  // Survol réel autorisé (une fois la démo scriptée terminée) → la ligne pilote elle
  // aussi le spotlight de la zone sur la carte.
  interactive: boolean
  onHover: (id: string | null) => void
}) {
  const status = STATUS[row.status]
  const accent = CATEGORY_COLORS[row.category]
  return (
    <TableRow
      data-row-id={row.id}
      data-category={row.category}
      onMouseEnter={interactive ? () => onHover(row.id) : undefined}
      onMouseLeave={interactive ? () => onHover(null) : undefined}
      className={`fade-in slide-in-from-bottom-2 fill-mode-both animate-in border-border/60 transition-colors duration-200${
        interactive ? ' cursor-pointer' : ''
      }`}
      style={{
        animationDelay: `${index * 55 + 120}ms`,
        animationDuration: '420ms',
        // Survol piloté par le faux curseur (pas de :hover CSS) : fond teinté + barre
        // d'accent gauche dans la couleur de catégorie, en synchro avec la zone carte.
        background: active ? `${accent}1f` : undefined,
        boxShadow: active ? `inset 3px 0 0 0 ${accent}` : undefined,
      }}
    >
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{row.name}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {row.id} · {row.code}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2.5">
          <Avatar initials={row.user.initials} hue={row.user.hue} />
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{row.user.name}</span>
            <span className="text-xs text-muted-foreground">{row.user.role}</span>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={`gap-1.5 font-medium ${status.className}`}>
          <span className="size-1.5 rounded-full" style={{ background: status.dot }} />
          {status.label}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex w-28 flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Couverture</span>
            <span className="font-semibold tabular-nums text-foreground">{row.coverage}%</span>
          </div>
          <Progress value={row.coverage} className="h-1" />
        </div>
      </TableCell>
      <TableCell>
        <Sparkline trend={row.trend} />
      </TableCell>
      <TableCell>
        <ZonePreview ring={row.ring} category={row.category} />
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums">
        {row.objects.toLocaleString('fr-FR')}
      </TableCell>
      <TableCell className="text-right text-xs text-muted-foreground">{row.updatedAt}</TableCell>
    </TableRow>
  )
}

export function DataTablePanel() {
  const total = SAMPLE_TABLE.reduce((sum, r) => sum + r.objects, 0)
  const rootRef = useRef<HTMLDivElement>(null)
  const map = useMapMaybe()
  const [activeRowId, setActiveRowId] = useState<string | null>(null)
  const stepId = useTourStore((s) => STEPS[s.currentStep]?.id)
  const tableLinkDone = useTourStore((s) => s.tableLinkDone)
  // Le vol caméra du step est en cours : on attend qu'il se pose (moveend →
  // setFlying(false)) avant de lancer le balayage du curseur.
  const flying = useTourStore((s) => s.flying)
  // Le balayage ne joue qu'à l'entrée du step, une fois le vol posé et tant que la
  // gate n'est pas levée.
  const active = stepId === 'data-table' && !flying && !tableLinkDone
  // Une fois la démo scriptée finie (gate levée), le survol réel des lignes prend le
  // relais : hover une ligne → spotlight la zone liée sur la carte.
  const interactive = stepId === 'data-table' && tableLinkDone

  useDataTableCursor(rootRef, active, map, setActiveRowId)

  const handleHover = (id: string | null) => {
    setActiveRowId(id)
    if (map) setVectorHover(map, id)
  }

  return (
    <div
      ref={rootRef}
      id="data-table-panel"
      className="pointer-events-auto absolute inset-x-3 bottom-4 flex h-[44vh] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-2xl ring-1 ring-foreground/10 backdrop-blur-md animate-in fade-in slide-in-from-bottom-8 duration-500 sm:inset-x-4 sm:h-[52vh]"
      style={{ zIndex: 100100 }}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3 sm:gap-4 sm:px-5 sm:py-3.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <Table2 className="size-4 shrink-0 text-[oklch(0.7_0.16_300)]" />
            <h2 className="font-heading text-base font-semibold leading-none">Vue tabulaire</h2>
          </div>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Les mêmes objets qu'à la carte, en tableau — tri, statuts, indicateurs et tendances.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Badge variant="secondary" className="tabular-nums">
            {SAMPLE_TABLE.length} zones · {total.toLocaleString('fr-FR')} objets
          </Badge>
          <div className="hidden items-center rounded-lg border border-border/70 bg-background/60 p-0.5 text-xs sm:flex">
            <span className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-muted-foreground">
              <MapIcon className="size-3.5" /> Carte
            </span>
            <span className="flex items-center gap-1.5 rounded-md bg-[oklch(0.7_0.16_300/0.18)] px-2.5 py-1 font-medium text-foreground ring-1 ring-inset ring-[oklch(0.7_0.16_300/0.4)]">
              <Table2 className="size-3.5" /> Tableau
            </span>
          </div>
        </div>
      </header>

      <ScrollArea className="flex-1">
        {/* Sous ~640px les 8 colonnes ne tiennent pas : scroll horizontal natif
            (le balayage vertical du faux curseur reste aligné sur les lignes). */}
        <Table className="min-w-[680px] sm:min-w-0">
          <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur-md">
            <TableRow className="border-border/60 hover:bg-transparent">
              <TableHead>Zone</TableHead>
              <TableHead>Responsable</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Couverture</TableHead>
              <TableHead>Tendance 7j</TableHead>
              <TableHead className="w-12">Aperçu</TableHead>
              <TableHead className="text-right">Objets</TableHead>
              <TableHead className="text-right">Maj</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SAMPLE_TABLE.map((row, i) => (
              <Row
                key={row.id}
                row={row}
                index={i}
                active={row.id === activeRowId}
                interactive={interactive}
                onHover={handleHover}
              />
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
      {/* Faux curseur scripté : portalé à <body>, z au-dessus de l'overlay driver pour
          rester visible le long du balayage. rotate=false comme les autres curseurs de
          démo ; l'orientation vient de l'angle dispatché par useDataTableCursor. */}
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
    </div>
  )
}
