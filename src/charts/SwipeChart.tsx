import { ChevronsLeftRight } from 'lucide-react'

export function SwipeChart() {
  return (
    <div>
      <div className="text-sm font-medium text-foreground">Avant / Après</div>
      <p className="mt-1 text-xs text-muted-foreground">
        Glissez le curseur pour comparer deux états d’un même territoire, parfaitement synchronisés
        au déplacement et au zoom.
      </p>

      {/* Aperçu du geste : un split avant/après avec poignée, plutôt que deux pastilles. */}
      <div className="relative mt-3 h-20 overflow-hidden rounded-md ring-1 ring-border/60">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-700/45 to-emerald-500/20" />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-600/55 to-slate-400/30 [clip-path:inset(0_50%_0_0)]" />
        <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white/85" />
        <div className="absolute top-1/2 left-1/2 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-slate-800 shadow-md">
          <ChevronsLeftRight className="size-3.5" />
        </div>
        <span className="absolute top-1.5 left-1.5 font-mono text-[9px] tracking-wide text-white/90 uppercase">
          1950–1965
        </span>
        <span className="absolute top-1.5 right-1.5 font-mono text-[9px] tracking-wide text-white/90 uppercase">
          Actuel
        </span>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Cas d’usage : suivi de l’urbanisation, évolution du littoral, comparaison dans le temps.
      </p>
    </div>
  )
}
