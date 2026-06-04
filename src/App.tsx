import { MapCanvas } from '@/map/MapCanvas'
import { LayersButton } from '@/map/LayersButton'
import { CinematicCamera } from '@/map/CinematicCamera'
import { SwipeCompare } from '@/map/SwipeCompare'
import { PointCloudDirector } from '@/map/PointCloudDirector'
import { PointCloudDangerPois } from '@/map/PointCloudDangerPois'
import { TourController } from '@/tour/TourController'
import { RtScriptedCursor } from '@/components/RtScriptedCursor'
import { ThemeFlipCursor } from '@/components/ThemeFlipCursor'
import { TourThemeSync } from '@/components/TourThemeSync'
import { DebugPanel } from '@/tour/DebugPanel'
import { TrafficFlowDebugPanel } from '@/tour/TrafficFlowDebugPanel'
import { AirplaneDebugPanel } from '@/tour/AirplaneDebugPanel'
import { PointCloudDebugPanel } from '@/tour/PointCloudDebugPanel'
import { ChartsPanel } from '@/charts/ChartsPanel'
import { StartScreen } from '@/tour/StartScreen'
import { AppSidebar } from '@/components/AppSidebar'
import { MobileSidebarTourSync } from '@/components/MobileSidebarTourSync'
import { useTourStore } from '@/store/tour-store'
import { STEPS } from '@/tour/steps'
import { SmoothCursor } from '@/components/ui/smooth-cursor'
import { Toaster } from '@/components/ui/sonner'
import { Button } from '@/components/ui/button'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { ArrowLeft } from 'lucide-react'

// Faux curseur décoratif qui « clique » la carte pendant le tracé auto (Mesure).
// Mode non intrusif (hideSystemCursor=false) : le vrai curseur reste visible.
function TourTraceCursor() {
  const id = useTourStore((s) => STEPS[s.currentStep]?.id)
  const hidden = useTourStore((s) => s.traceCursorHidden)
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced || id !== 'measure') return null
  // `key` par step : une instance neuve par tracé.
  return <SmoothCursor key={id} scripted hideSystemCursor={false} hidden={hidden} zIndex={100060} />
}

function Overlays() {
  const started = useTourStore((s) => s.started)
  const currentStep = useTourStore((s) => s.currentStep)
  const reset = useTourStore((s) => s.reset)
  const isSwipe = started && STEPS[currentStep]?.id === 'swipe'
  return (
    <>
      {/* Toasts d'incident (séquence HTA). z au-dessus de l'overlay driver.js
          (~100100) mais sous le faux curseur (100120). */}
      <Toaster position="bottom-right" style={{ zIndex: 100115 }} />
      <CinematicCamera />
      {isSwipe && <SwipeCompare />}
      {started && <PointCloudDirector />}
      {started && <PointCloudDangerPois />}
      {started && <LayersButton />}
      {started && <TourController />}
      {started && <TourTraceCursor />}
      {started && <RtScriptedCursor />}
      {started && <ThemeFlipCursor />}
      {started && <ChartsPanel />}
      {started && import.meta.env.DEV && <DebugPanel />}
      {started && import.meta.env.DEV && <TrafficFlowDebugPanel />}
      {started && import.meta.env.DEV && <AirplaneDebugPanel />}
      {started && import.meta.env.DEV && <PointCloudDebugPanel />}
      {!started && <StartScreen />}
      {started && (
        <div className="absolute bottom-4 left-4" style={{ zIndex: 100100 }}>
          <Button variant="outline" size="sm" onClick={reset}>
            <ArrowLeft /> Quitter la visite
          </Button>
        </div>
      )}
    </>
  )
}

function Shell() {
  const started = useTourStore((s) => s.started)
  return (
    <>
      {started && <AppSidebar />}
      {started && <MobileSidebarTourSync />}
      <SidebarInset className="relative overflow-hidden">
        <MapCanvas>
          <Overlays />
        </MapCanvas>
      </SidebarInset>
    </>
  )
}

function App() {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <SidebarProvider className="h-full min-h-0">
        <Shell />
      </SidebarProvider>
      <TourThemeSync />
    </div>
  )
}

export default App
