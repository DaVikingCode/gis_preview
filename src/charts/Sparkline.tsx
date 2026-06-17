import { Line, LineChart, ResponsiveContainer } from 'recharts'
import { TrendingDown, TrendingUp } from 'lucide-react'

// Mini-courbe de tendance (Recharts). Isolée dans son propre module pour que Recharts
// reste un chunk lazy séparé : DataTablePanel (qui pilote une chorégraphie de faux
// curseur sensible au timing) est chargé en EAGER, mais ne tire pas Recharts dans le
// bundle d'entrée — la Sparkline est chargée à la demande au step Table.
export function Sparkline({ trend }: { trend: number[] }) {
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
