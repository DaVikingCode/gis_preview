import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useIsMobile } from '@/hooks/use-mobile'
import { useTourStore } from '@/store/tour-store'
import { STEPS } from '@/tour/steps'
import { BuildingsHeightChart } from './BuildingsHeightChart'
import { MeasureChart } from './MeasureChart'
import { HeatmapChart } from './HeatmapChart'
import { BasemapChart } from './BasemapChart'
import { HighlightChart } from './HighlightChart'
import { LayersPresentationModal } from './LayersPresentationModal'
import { LayersAppliedCard } from './LayersAppliedCard'
import { DataTablePanel } from './DataTablePanel'
import { IsochroneChart } from './IsochroneChart'
import { SwipeChart } from './SwipeChart'
import { RealtimeChart } from './RealtimeChart'
import { HikingChart } from './HikingChart'
import { AirplaneCard } from './AirplaneCard'
import { PointCloudCard } from './PointCloudCard'
import { EcosystemBridge } from './EcosystemBridge'
import { TechStackDiagram } from './TechStackDiagram'

const META: Record<string, { title: string; description: string }> = {
  buildings: { title: 'Hauteurs visibles', description: 'Répartition des hauteurs de bâtiments' },
  measure: { title: 'Mesure courante', description: 'Mise à jour en temps réel' },
  heatmap: { title: 'Top 5 densité', description: 'Zones de plus forte densité' },
  basemap: { title: 'Fonds de plan', description: '4 styles disponibles' },
  highlight: { title: 'Bâtiment surligné', description: 'feature-state + paint case' },
  isochrone: { title: 'Accessibilité', description: 'Zones par temps de trajet' },
  swipe: { title: 'Avant / après', description: 'Comparer deux états d’un territoire' },
  realtime: { title: 'Supervision en direct', description: 'Mise à jour en continu' },
  hiking: { title: 'Profil d’élévation', description: 'Altitude et progression, en direct' },
  airplane: { title: 'Télémétrie de vol', description: 'Altitude, vitesse et cap, en direct' },
  pointcloud: {
    title: 'Nuage de points',
    description: 'Scan LiDAR · Auxonne · RGB + classification (ligne & urgence)',
  },
}

export function ChartsPanel() {
  const started = useTourStore((s) => s.started)
  const currentStep = useTourStore((s) => s.currentStep)
  const layersPanelOpen = useTourStore((s) => s.layersPanelOpen)
  const isMobile = useIsMobile()

  const step = started ? STEPS[currentStep] : undefined
  const chart = step?.chart

  // Quand on quitte un step catalogue (ex. pick-cadastre → apply-cadastre), on garde
  // la modale plein écran montée le temps de son fondu de sortie (collapse vers le
  // chip) pendant que la caméra vole déjà. On ajuste l'état pendant le rendu (pattern
  // React « valeur précédente ») pour que la modale ne disparaisse pas une seule frame
  // — sinon elle « pop » avant que l'animation de sortie ne puisse jouer.
  const [exiting, setExiting] = useState(false)
  const prevChartRef = useRef<string | undefined>(undefined)
  if (prevChartRef.current !== chart) {
    const prev = prevChartRef.current
    prevChartRef.current = chart
    if (chart === 'layers-presentation') {
      if (exiting) setExiting(false)
    } else if (prev === 'layers-presentation') {
      setExiting(true)
    }
  }

  if (!started || !step) return null

  // « Catalogue de couches » : sur layers-overview la modale n'apparaît qu'une fois le
  // bouton Couches « cliqué » par le faux curseur (LayersButton).
  const overviewGate = step.id === 'layers-overview' && !layersPanelOpen
  const showModal = (chart === 'layers-presentation' && !overviewGate) || exiting
  const modal = showModal ? (
    <LayersPresentationModal exiting={exiting} onExited={() => setExiting(false)} />
  ) : null

  // Sur mobile, la fiche d'anomalie (.gp-popup) s'ouvre sur le poste et le panneau
  // supervision en haut la recouvrirait : on masque le panneau le temps de l'incident.
  const realtimePopupSteps = new Set(['rt-surcharge', 'rt-todo', 'rt-in-progress', 'rt-done'])
  const hideForPopup = isMobile && chart === 'realtime' && realtimePopupSteps.has(step.id)

  let content: ReactNode = null
  if (chart && chart !== 'none' && chart !== 'layers-presentation' && !hideForPopup) {
    if (chart === 'layers-applied') content = <LayersAppliedCard key={step.id} />
    else if (chart === 'table') content = <DataTablePanel />
    else if (chart === 'ecosystem') content = <EcosystemBridge key={step.id} />
    else if (chart === 'techstack') content = <TechStackDiagram key={step.id} />
    else {
      const meta = META[chart]
      content = (
        <div
          className="absolute top-3 right-3 left-16 w-auto pointer-events-auto sm:top-4 sm:left-auto sm:w-80"
          style={{ zIndex: 100100 }}
        >
          <Card size={isMobile ? 'sm' : 'default'} className="bg-card/95 backdrop-blur-md">
            <CardHeader>
              <CardTitle>{meta.title}</CardTitle>
              <CardDescription className="hidden sm:block">{meta.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {chart === 'buildings' && (
                <BuildingsHeightChart byHeight={step.id === 'layers-apply-buildings'} />
              )}
              {chart === 'measure' && <MeasureChart />}
              {chart === 'heatmap' && <HeatmapChart />}
              {chart === 'basemap' && <BasemapChart />}
              {chart === 'highlight' && <HighlightChart />}
              {chart === 'isochrone' && <IsochroneChart />}
              {chart === 'swipe' && <SwipeChart />}
              {chart === 'realtime' && <RealtimeChart />}
              {chart === 'hiking' && <HikingChart />}
              {chart === 'airplane' && <AirplaneCard />}
              {chart === 'pointcloud' && <PointCloudCard />}
            </CardContent>
          </Card>
        </div>
      )
    }
  }

  return (
    <>
      {content}
      {modal}
    </>
  )
}
