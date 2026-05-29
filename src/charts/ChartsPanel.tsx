import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useTourStore } from '@/store/tour-store'
import { STEPS } from '@/tour/steps'
import { BuildingsHeightChart } from './BuildingsHeightChart'
import { MeasureChart } from './MeasureChart'
import { RasterOpacityChart } from './RasterOpacityChart'
import { HeatmapChart } from './HeatmapChart'
import { BasemapChart } from './BasemapChart'
import { HighlightChart } from './HighlightChart'
import { LayersPresentationModal } from './LayersPresentationModal'
import { LayersAppliedCard } from './LayersAppliedCard'
import { DataTablePanel } from './DataTablePanel'
import { DrawAnalysisChart } from './DrawAnalysisChart'
import { IsochroneChart } from './IsochroneChart'
import { SwipeChart } from './SwipeChart'
import { RealtimeChart } from './RealtimeChart'
import { EcosystemBridge } from './EcosystemBridge'
import { TechStackDiagram } from './TechStackDiagram'

const META: Record<string, { title: string; description: string }> = {
  buildings: { title: 'Hauteurs visibles', description: 'Échantillonnage des features 3D rendues' },
  measure: { title: 'Mesure courante', description: 'Calcul Turf.js, mise à jour en temps réel' },
  raster: { title: 'Overlay raster', description: 'WMTS IGN orthophoto, opacité interactive' },
  heatmap: { title: 'Top 5 densité', description: '~1 160 points pondérés' },
  basemap: { title: 'Fonds de plan', description: '4 styles disponibles' },
  highlight: { title: 'Bâtiment surligné', description: 'feature-state + paint case' },
  draw: { title: 'Analyse spatiale', description: 'Polygone à main levée, requête Turf' },
  isochrone: { title: 'Accessibilité', description: 'Isochrones 5 / 10 / 15 min' },
  swipe: { title: 'Comparaison ortho', description: 'Avant / après, deux millésimes IGN' },
  realtime: { title: 'Supervision réseau', description: 'Flux SCADA simulé · mise à jour live' },
}

export function ChartsPanel() {
  const started = useTourStore((s) => s.started)
  const currentStep = useTourStore((s) => s.currentStep)
  const layersPanelOpen = useTourStore((s) => s.layersPanelOpen)
  if (!started) return null
  const step = STEPS[currentStep]
  if (!step || step.chart === 'none') return null
  if (step.chart === 'layers-presentation') {
    // « Catalogue de couches » : la modale n'apparaît qu'une fois le bouton Couches
    // « cliqué » par le faux curseur (LayersButton). Les autres steps catalogue
    // (pick-cadastre, import…) la montent comme avant.
    if (step.id === 'layers-overview' && !layersPanelOpen) return null
    return <LayersPresentationModal />
  }
  if (step.chart === 'layers-applied') return <LayersAppliedCard key={step.id} />
  if (step.chart === 'table') return <DataTablePanel />
  if (step.chart === 'ecosystem') return <EcosystemBridge key={step.id} />
  if (step.chart === 'techstack') return <TechStackDiagram key={step.id} />
  const meta = META[step.chart]
  return (
    <div className="absolute top-4 right-16 w-80 pointer-events-auto" style={{ zIndex: 100100 }}>
      <Card className="bg-card/95 backdrop-blur-md">
        <CardHeader>
          <CardTitle>{meta.title}</CardTitle>
          <CardDescription>{meta.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {step.chart === 'buildings' && (
            <BuildingsHeightChart byHeight={step.id === 'layers-apply-buildings'} />
          )}
          {step.chart === 'measure' && <MeasureChart />}
          {step.chart === 'raster' && <RasterOpacityChart />}
          {step.chart === 'heatmap' && <HeatmapChart />}
          {step.chart === 'basemap' && <BasemapChart />}
          {step.chart === 'highlight' && <HighlightChart />}
          {step.chart === 'draw' && <DrawAnalysisChart />}
          {step.chart === 'isochrone' && <IsochroneChart />}
          {step.chart === 'swipe' && <SwipeChart />}
          {step.chart === 'realtime' && <RealtimeChart />}
        </CardContent>
      </Card>
    </div>
  )
}
