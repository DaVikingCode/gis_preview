import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { useMapDataStore } from '@/store/map-data-store'

const BUCKETS = [
  { label: '0-10m', min: 0, max: 10 },
  { label: '10-25m', min: 10, max: 25 },
  { label: '25-50m', min: 25, max: 50 },
  { label: '50-100m', min: 50, max: 100 },
  { label: '100m+', min: 100, max: Infinity },
]

// Plus c'est haut, plus le bleu est foncé.
const BUCKET_BLUES = ['#bfdbfe', '#7eb3fb', '#4f8ff7', '#2563eb', '#1e3a8a']

export function BuildingsHeightChart({ byHeight }: { byHeight?: boolean }) {
  const config: ChartConfig = {
    count: { label: 'Bâtiments', color: byHeight ? '#2563eb' : 'var(--chart-1)' },
  }
  const heights = useMapDataStore((s) => s.buildingHeights)
  const data = BUCKETS.map((b) => ({
    label: b.label,
    count: heights.filter((h) => h >= b.min && h < b.max).length,
  }))
  const avg = heights.length ? Math.round(heights.reduce((a, h) => a + h, 0) / heights.length) : 0
  return (
    <div>
      <ChartContainer config={config} className="h-28 w-full sm:h-48">
        <BarChart data={data} margin={{ left: -16, right: 8, top: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} className="stroke-border" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
          <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]}>
            {byHeight && data.map((_, i) => <Cell key={i} fill={BUCKET_BLUES[i]} />)}
          </Bar>
        </BarChart>
      </ChartContainer>
      {byHeight ? (
        <p className="text-xs text-muted-foreground mt-2">
          Hauteur moyenne : <span className="text-foreground font-semibold">{avg} m</span> sur{' '}
          <span className="text-foreground font-semibold">{heights.length}</span> bâtiments
        </p>
      ) : (
        <p className="text-xs text-muted-foreground mt-2">
          Échantillon : <span className="text-foreground font-semibold">{heights.length}</span>{' '}
          bâtiments
        </p>
      )}
    </div>
  )
}
