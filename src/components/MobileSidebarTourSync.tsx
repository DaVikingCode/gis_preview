import { useEffect } from 'react'
import { useSidebar } from '@/components/ui/sidebar'
import { useTourStore } from '@/store/tour-store'
import { STEPS, THEME_FLIP_STEP_ID } from '@/tour/steps'

// Steps qui ciblent la sidebar (popover ancrée dedans / faux curseur cliquant un
// bouton de la sidebar). Sur mobile la sidebar est un tiroir Sheet fermé : on
// l'ouvre automatiquement le temps de ces steps puis on le referme, pour garder
// la carte plein écran partout ailleurs.
const SIDEBAR_STEP_IDS = new Set<string>(['workspace-sidebar', THEME_FLIP_STEP_ID])

export function MobileSidebarTourSync() {
  const { isMobile, setOpenMobile } = useSidebar()
  const stepId = useTourStore((s) => STEPS[s.currentStep]?.id)

  useEffect(() => {
    if (!isMobile) return
    setOpenMobile(stepId != null && SIDEBAR_STEP_IDS.has(stepId))
  }, [isMobile, stepId, setOpenMobile])

  return null
}
