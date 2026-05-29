import { Separator } from '@/components/ui/separator'

export function SwipeChart() {
  return (
    <div>
      <div className="text-sm font-medium text-foreground">Avant / Après</div>
      <p className="text-xs text-muted-foreground mt-1">
        Glisse le curseur vertical pour comparer deux millésimes d’orthophotos IGN sur la même
        emprise, parfaitement synchronisés au pan et au zoom.
      </p>
      <Separator className="my-3" />
      <ul className="text-xs space-y-1.5">
        <li className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-400" />
          <span className="text-muted-foreground">Gauche — ortho 1950–1965</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="text-muted-foreground">Droite — ortho actuelle</span>
        </li>
      </ul>
      <p className="text-[11px] text-muted-foreground mt-3">
        Cas d’usage : suivi de l’urbanisation, évolution du trait de côte, analyse diachronique.
      </p>
    </div>
  )
}
