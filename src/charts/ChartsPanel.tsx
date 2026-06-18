import { lazy, Suspense, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { SurveyCard } from './SurveyCard'
import { useIsMobile } from '@/hooks/use-mobile'
import { useTourStore } from '@/store/tour-store'
import { STEPS } from '@/tour/steps'
// EAGER (pas de lazy) : cette modale est montée tôt dans le tour ET pilote une
// chorégraphie GSAP de faux curseur sensible au timing. En lazy, le Suspense (fallback
// null) démonte/remonte la modale au 1er affichage (« flash ») et casse la choré du
// curseur (qui ne déclenche alors plus l'avancée d'étape → le curseur reste). Elle
// n'importe pas Recharts : la charger en statique ne touche pas au split Recharts.
import { LayersPresentationModal } from './LayersPresentationModal'

// Charts chargés à la demande (exports nommés → mappés vers `default`). Recharts et les
// gros composants partent ainsi dans des chunks séparés, hors du bundle d'entrée : ils
// ne sont téléchargés qu'à la première étape du tour qui les affiche.
const BuildingsHeightChart = lazy(() =>
  import('./BuildingsHeightChart').then((m) => ({ default: m.BuildingsHeightChart })),
)
const MeasureChart = lazy(() => import('./MeasureChart').then((m) => ({ default: m.MeasureChart })))
const HeatmapChart = lazy(() => import('./HeatmapChart').then((m) => ({ default: m.HeatmapChart })))
const BasemapChart = lazy(() => import('./BasemapChart').then((m) => ({ default: m.BasemapChart })))
const LayersAppliedCard = lazy(() =>
  import('./LayersAppliedCard').then((m) => ({ default: m.LayersAppliedCard })),
)
// Charts à faux curseur scripté MAIS sans modale sœur à leur étape (table / kanban) :
// avec les boundaries Suspense séparées, leur suspension lazy est isolée (pas de
// teardown d'un voisin) → lazy sans risque, et hors du bundle d'entrée.
const DataTablePanel = lazy(() =>
  import('./DataTablePanel').then((m) => ({ default: m.DataTablePanel })),
)
const KanbanPanel = lazy(() => import('./KanbanPanel').then((m) => ({ default: m.KanbanPanel })))
const IsochroneChart = lazy(() =>
  import('./IsochroneChart').then((m) => ({ default: m.IsochroneChart })),
)
const SwipeChart = lazy(() => import('./SwipeChart').then((m) => ({ default: m.SwipeChart })))
const RealtimeChart = lazy(() =>
  import('./RealtimeChart').then((m) => ({ default: m.RealtimeChart })),
)
const HikingChart = lazy(() => import('./HikingChart').then((m) => ({ default: m.HikingChart })))
const AirplaneCard = lazy(() => import('./AirplaneCard').then((m) => ({ default: m.AirplaneCard })))
const PointCloudCard = lazy(() =>
  import('./PointCloudCard').then((m) => ({ default: m.PointCloudCard })),
)
const EcosystemBridge = lazy(() =>
  import('./EcosystemBridge').then((m) => ({ default: m.EcosystemBridge })),
)
const TechStackDiagram = lazy(() =>
  import('./TechStackDiagram').then((m) => ({ default: m.TechStackDiagram })),
)
const OutroScreen = lazy(() => import('./OutroScreen').then((m) => ({ default: m.OutroScreen })))

const META: Record<string, { title: string; description: string }> = {
  buildings: { title: 'Hauteurs visibles', description: 'Répartition des hauteurs de bâtiments' },
  measure: { title: 'Mesure courante', description: 'Mise à jour en temps réel' },
  heatmap: { title: 'Top 5 densité', description: 'Zones de plus forte densité' },
  basemap: { title: 'Fonds de plan', description: '4 styles disponibles' },
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
    else if (chart === 'kanban') content = <KanbanPanel />
    else if (chart === 'ecosystem') content = <EcosystemBridge key={step.id} />
    else if (chart === 'techstack') content = <TechStackDiagram key={step.id} />
    else if (chart === 'outro') content = <OutroScreen key={step.id} />
    else {
      const meta = META[chart]
      const [lon, lat] = step.camera.center
      content = (
        <SurveyCard
          title={meta.title}
          description={meta.description}
          lat={lat}
          lon={lon}
          stepIndex={currentStep + 1}
          total={STEPS.length}
          compact={isMobile}
        >
          {/* Boundary serrée : seule la zone de chart suspend pendant le chargement
              du chunk — l'enveloppe Card (titre/description) reste stable, pas de CLS. */}
          <Suspense fallback={null}>
            {chart === 'buildings' && (
              <BuildingsHeightChart byHeight={step.id === 'layers-apply-buildings'} />
            )}
            {chart === 'measure' && <MeasureChart />}
            {chart === 'heatmap' && <HeatmapChart />}
            {chart === 'basemap' && <BasemapChart />}
            {chart === 'isochrone' && <IsochroneChart />}
            {chart === 'swipe' && <SwipeChart />}
            {chart === 'realtime' && <RealtimeChart />}
            {chart === 'hiking' && <HikingChart />}
            {chart === 'airplane' && <AirplaneCard />}
            {chart === 'pointcloud' && <PointCloudCard />}
          </Suspense>
        </SurveyCard>
      )
    }
  }

  // Boundaries SÉPARÉES pour `content` et `modal` : un chart lazy de `content` qui
  // suspend (ex. LayersAppliedCard au passage pick-cadastre → apply-cadastre, 1er
  // chargement) ne doit PAS faire tomber la modale dans le même fallback. Sinon la
  // modale (encore montée en sortie `exiting`) est arrachée avant la fin de son
  // animation → `onExited` ne se déclenche jamais → `exiting` reste true → la modale et
  // son faux curseur se re-montent et restent bloqués (bug « le curseur ne part plus »,
  // visible seulement au 1er passage, le chunk étant ensuite en cache).
  return (
    <>
      <Suspense fallback={null}>{content}</Suspense>
      <Suspense fallback={null}>{modal}</Suspense>
    </>
  )
}
