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
  )
}
