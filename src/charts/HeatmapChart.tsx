import { Bar, BarChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { useMapDataStore } from '@/store/map-data-store'

const config: ChartConfig = {
  value: { label: 'Points', color: 'var(--chart-1)' },
}

export function HeatmapChart() {
  const zones = useMapDataStore((s) => s.heatmapTopZones)
  return (
    <div className="space-y-2">
      <ChartContainer config={config} className="h-48 w-full">
        <BarChart data={zones} layout="vertical" margin={{ left: 8, right: 8, top: 4, bottom: 0 }}>
          <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} />
          <YAxis
            dataKey="name"
            type="category"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={70}
          />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartContainer>
      {/* Échelle de densité — même gradient que le swatch « Raster » de la légende d'accueil. */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>moins dense</span>
        <span
          className="h-1.5 flex-1 rounded-full"
          style={{ background: 'linear-gradient(90deg, #00b5e1, #ffeb04)' }}
        />
        <span>plus dense</span>
      </div>
    </div>
  )
}
