import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CalibrationCorners, CoordLabel } from '@/components/survey/Survey'

// Cadre « feuille de relevé » discret partagé par les petits charts du panneau droit :
// repères de calage aux coins + en-tête mono (coordonnées de l'étape + n° d'étape). Unifie
// ~10 charts sur ~15 étapes sans imposer la signature (courbes de niveau) à chacun.
export function SurveyCard({
  title,
  description,
  lat,
  lon,
  stepIndex,
  total,
  compact,
  children,
}: {
  title: string
  description: string
  lat: number
  lon: number
  stepIndex: number
  total: number
  compact?: boolean
  children: ReactNode
}) {
  return (
    <div
      className="pointer-events-auto absolute top-3 right-3 left-16 w-auto sm:top-4 sm:left-auto sm:w-80"
      style={{ zIndex: 100100 }}
    >
      <Card
        size={compact ? 'sm' : 'default'}
        className="relative overflow-hidden bg-card/95 backdrop-blur-md"
      >
        <CalibrationCorners offset={2} tone="bg-foreground/15" />
        <CardHeader>
          <div className="mb-1 flex items-center justify-between gap-2 font-mono text-[10px] tracking-[0.14em] text-muted-foreground/70 uppercase">
            <CoordLabel lat={lat} lon={lon} />
            <span className="tabular-nums">
              {String(stepIndex).padStart(2, '0')} / {String(total).padStart(2, '0')}
            </span>
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription className="hidden sm:block">{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  )
}
