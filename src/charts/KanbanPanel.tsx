import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LayoutGroup, motion } from 'motion/react'
import { KanbanSquare, CalendarRange, ChevronUp } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { SmoothCursor } from '@/components/ui/smooth-cursor'
import {
  SAMPLE_TASKS,
  KANBAN_COLUMNS,
  KANBAN_DEMO_CARD_ID,
  WEEK_DAYS,
  type Task,
  type TaskStatus,
  type TaskPriority,
} from '@/data/sample-tasks'
import type { TableUser } from '@/data/sample-table'
import { useTourStore } from '@/store/tour-store'
import { STEPS } from '@/tour/steps'
import { useKanbanCursor } from '@/hooks/animations/useKanbanCursor'

// Sémantique de statut alignée sur le reste de l'app (cf. DataTablePanel : amber =
// en attente, emerald = actif) + cyan de marque DVC pour « en revue » — pas d'arc-en-ciel.
const STATUS_COLOR: Record<TaskStatus, string> = {
  a_faire: 'oklch(0.708 0 0)', // muted-foreground (neutre)
  en_cours: '#f59e0b', // amber
  en_revue: '#00b5e1', // cyan de marque
  termine: '#22c55e', // emerald
}

// Spring physique calqué sur SmoothCursor : les cartes glissent (FLIP) au lieu de sauter.
const LAYOUT_SPRING = { type: 'spring', stiffness: 380, damping: 34 } as const

function Avatar({ user, size = 24 }: { user: TableUser; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-1 ring-inset ring-white/15"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `linear-gradient(135deg, hsl(${user.hue} 70% 55%), hsl(${(user.hue + 40) % 360} 65% 42%))`,
      }}
    >
      {user.initials}
    </span>
  )
}

// Indicateur de priorité minimal et typographique (pas de pastille colorée criarde).
function Priority({ priority }: { priority: TaskPriority }) {
  if (priority === 'haute')
    return <ChevronUp className="size-3.5 text-amber-400" strokeWidth={2.5} aria-label="Haute" />
  if (priority === 'moyenne')
    return <ChevronUp className="size-3.5 text-muted-foreground/70" aria-label="Moyenne" />
  return <span className="block h-px w-2.5 bg-muted-foreground/50" aria-label="Basse" />
}

function Card({ task }: { task: Task }) {
  const color = STATUS_COLOR[task.status]
  // La carte démo est déplacée par le fantôme scripté (curseur) : on désactive SON propre
  // FLIP pour qu'elle ne « revienne » pas depuis la 1re colonne à la dépose. Les voisines
  // gardent leur FLIP (reflux des colonnes).
  const isDemoCard = task.id === KANBAN_DEMO_CARD_ID
  return (
    <motion.div layout={!isDemoCard} transition={LAYOUT_SPRING} data-task-id={task.id}>
      <div
        data-task-card
        className="group/card cursor-default rounded-[11px] border border-border/60 bg-card/60 p-3 ring-1 ring-transparent backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:ring-foreground/10"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground/80 uppercase">
            {task.id}
          </span>
          <span
            className="size-1.5 rounded-full"
            style={{ background: color, boxShadow: `0 0 0 3px ${color}1f` }}
          />
        </div>
        <p className="mt-2 text-[13px] leading-snug font-medium text-foreground">{task.title}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <Avatar user={task.owner} size={22} />
            <span className="truncate text-[11px] text-muted-foreground">{task.owner.name}</span>
          </div>
          <Priority priority={task.priority} />
        </div>
      </div>
    </motion.div>
  )
}

function KanbanBoard({ tasks }: { tasks: Task[] }) {
  return (
    <LayoutGroup>
      <div className="grid h-full grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {KANBAN_COLUMNS.map((col) => {
          const items = tasks.filter((t) => t.status === col.id)
          const color = STATUS_COLOR[col.id]
          return (
            <div key={col.id} data-col-id={col.id} className="flex min-w-0 flex-col">
              {/* Filet d'accent en tête de colonne (statut) — pas de barre sur chaque carte. */}
              <span className="h-[3px] w-full rounded-full" style={{ background: color }} />
              <div className="mt-2.5 mb-3 flex items-center justify-between px-0.5">
                <div className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full" style={{ background: color }} />
                  <span className="text-[11px] font-semibold tracking-[0.12em] text-foreground/90 uppercase">
                    {col.label}
                  </span>
                </div>
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full border border-border/60 px-1.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                  {items.length}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2.5">
                {items.map((t) => (
                  <Card key={t.id} task={t} />
                ))}
                {items.length === 0 && (
                  <div className="rounded-[11px] border border-dashed border-border/40 py-6" />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </LayoutGroup>
  )
}

function Planning({ tasks }: { tasks: Task[] }) {
  return (
    <div className="flex h-full flex-col">
      {/* En-tête semaine (Lun–Ven), aligné sur le rail des tâches. */}
      <div className="grid grid-cols-[150px_repeat(5,1fr)] border-b border-border/50 pb-2 sm:grid-cols-[230px_repeat(5,1fr)]">
        <span className="px-1 text-[10px] tracking-[0.14em] text-muted-foreground/70 uppercase">
          Tâche
        </span>
        {WEEK_DAYS.map((d) => (
          <span
            key={d}
            className="px-2 text-center text-[10px] font-medium tracking-[0.1em] text-muted-foreground uppercase"
          >
            {d}
          </span>
        ))}
      </div>
      <div className="relative flex flex-col">
        {/* Lignes de grille verticales (5 jours) sur toute la hauteur du planning. */}
        <div className="pointer-events-none absolute inset-0 grid grid-cols-[150px_repeat(5,1fr)] sm:grid-cols-[230px_repeat(5,1fr)]">
          <span />
          {WEEK_DAYS.map((d, i) => (
            <span key={d} className={i === 0 ? '' : 'border-l border-border/40'} />
          ))}
        </div>
        {/* Repère « aujourd'hui » (mercredi midi) — discret, en cyan de marque. */}
        <div
          className="pointer-events-none absolute inset-y-0"
          style={{
            left: 'calc(150px + (100% - 150px) * 0.5)',
            width: 1,
            background: 'linear-gradient(180deg, transparent, #00b5e155, transparent)',
          }}
        />
        {tasks.map((task) => {
          const color = STATUS_COLOR[task.status]
          return (
            <div
              key={task.id}
              className="relative grid grid-cols-[150px_repeat(5,1fr)] items-center py-2 sm:grid-cols-[230px_repeat(5,1fr)]"
            >
              <div className="flex min-w-0 items-center gap-2 pr-3">
                <Avatar user={task.owner} size={20} />
                <span className="truncate text-[11px] text-foreground/90">{task.title}</span>
              </div>
              <div className="col-span-5 grid grid-cols-5 px-1">
                <motion.div
                  layout
                  transition={LAYOUT_SPRING}
                  data-plan-bar={task.id}
                  className="relative flex h-6 items-center gap-1.5 rounded-full px-2"
                  style={{
                    gridColumn: `${task.day + 1} / span ${task.span}`,
                    background: `linear-gradient(180deg, ${color}3a, ${color}24)`,
                    boxShadow: `inset 0 0 0 1px ${color}66, inset 0 1px 0 rgba(255,255,255,0.14)`,
                  }}
                >
                  <span className="size-1.5 shrink-0 rounded-full" style={{ background: color }} />
                  <span className="truncate text-[10px] font-medium text-foreground/80">
                    {task.span}j
                  </span>
                  {/* Poignée de redimensionnement (bord droit) sur la barre démo. */}
                  {task.id === KANBAN_DEMO_CARD_ID && (
                    <span
                      data-plan-handle={task.id}
                      className="absolute inset-y-1 right-0.5 w-1 rounded-full bg-white/40"
                    />
                  )}
                </motion.div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function KanbanPanel() {
  const rootRef = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState('kanban')
  // Override de statut posé par la démo scriptée (carte glissée vers « En cours »).
  const [override, setOverride] = useState<Record<string, TaskStatus>>({})
  // Override de durée posé par l'édition scriptée du planning (étirement de barre).
  const [planOverride, setPlanOverride] = useState<Record<string, number>>({})
  const stepId = useTourStore((s) => STEPS[s.currentStep]?.id)
  const flying = useTourStore((s) => s.flying)
  const kanbanDone = useTourStore((s) => s.kanbanDone)
  const active = stepId === 'kanban' && !flying && !kanbanDone

  const tasks = SAMPLE_TASKS.map((t) => {
    const status = override[t.id] ?? t.status
    const span = planOverride[t.id] ?? t.span
    return status !== t.status || span !== t.span ? { ...t, status, span } : t
  })

  useKanbanCursor({
    rootRef,
    active,
    onDrop: (id, status) => setOverride((o) => ({ ...o, [id]: status })),
    onTab: setTab,
    // Étire la durée (jours) en clampant pour rester dans la semaine (Lun–Ven).
    onExtend: (id, span) => {
      const t = SAMPLE_TASKS.find((x) => x.id === id)
      const max = t ? 5 - t.day : 5
      setPlanOverride((o) => ({ ...o, [id]: Math.min(span, max) }))
    },
  })

  return (
    <div
      ref={rootRef}
      id="kanban-panel"
      className="pointer-events-auto absolute inset-x-3 bottom-4 flex h-[44vh] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-2xl ring-1 ring-foreground/10 backdrop-blur-md animate-in fade-in slide-in-from-bottom-8 duration-500 sm:inset-x-4 sm:h-[52vh]"
      style={{ zIndex: 100100 }}
    >
      <Tabs
        value={tab}
        onValueChange={setTab}
        className="flex h-full flex-col gap-0 data-horizontal:flex-col"
      >
        <header className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3 sm:gap-4 sm:px-5 sm:py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#00b5e1]/12 text-[#00b5e1] ring-1 ring-inset ring-[#00b5e1]/25">
              <KanbanSquare className="size-4.5" />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <h2 className="font-heading text-base leading-none font-semibold tracking-tight">
                Planning &amp; suivi d'équipe
              </h2>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Tâches, statuts et échéances de l'équipe — vue tableau ou planning.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground tabular-nums sm:inline-flex">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              {SAMPLE_TASKS.length} tâches
            </span>
            <TabsList variant="line">
              <TabsTrigger value="kanban" data-value="kanban">
                <KanbanSquare /> Kanban
              </TabsTrigger>
              <TabsTrigger value="planning" data-value="planning">
                <CalendarRange /> Planning
              </TabsTrigger>
            </TabsList>
          </div>
        </header>

        <ScrollArea className="flex-1">
          <div className="min-w-[700px] p-4 sm:min-w-0 sm:p-5">
            <TabsContent value="kanban">
              <KanbanBoard tasks={tasks} />
            </TabsContent>
            <TabsContent value="planning">
              <Planning tasks={tasks} />
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>

      {/* Faux curseur scripté : portalé à <body>, au-dessus de l'overlay driver. */}
      {active &&
        createPortal(
          <SmoothCursor
            scripted
            hideSystemCursor={false}
            rotate={false}
            restAngle={-35}
            zIndex={1000000100}
            // Suivi rigide : le curseur colle pile à sa cible scriptée → la carte glissée
            // (fantôme calé sur la même cible) le suit franchement, sans traîner derrière.
            tightTracking
          />,
          document.body,
        )}
    </div>
  )
}
