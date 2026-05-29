import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

const FACTS = [
  { k: 'Architecte', v: 'I. M. Pei' },
  { k: 'Inauguration', v: '1989' },
  { k: 'Hauteur', v: '21,64 m' },
  { k: 'Panneaux de verre', v: '673' },
  { k: 'Base', v: '35 m × 35 m' },
]

export function HighlightChart() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div
          className="size-10 rounded-md flex items-center justify-center text-2xl"
          style={{ background: 'color-mix(in oklab, #fbbf24 30%, transparent)' }}
        >
          🔺
        </div>
        <div>
          <div className="font-semibold leading-tight">Pyramide du Louvre</div>
          <Badge variant="outline" className="mt-1 gap-1.5 font-normal">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#fbbf24' }} />
            feature-state · highlight
          </Badge>
        </div>
      </div>
      <Separator />
      <ul className="text-xs space-y-1.5">
        {FACTS.map((f) => (
          <li key={f.k} className="flex justify-between gap-2">
            <span className="text-muted-foreground">{f.k}</span>
            <span className="text-foreground tabular-nums">{f.v}</span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Le bâtiment est ciblé par <code className="text-foreground">setFeatureState</code> sur l’ID
        OpenMapTiles (<code>osm_id</code> promu en feature id). Le paint applique un{' '}
        <code>case</code> sur <code>feature-state.highlight</code>.
      </p>
    </div>
  )
}
