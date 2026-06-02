import { SmoothCursor } from '@/components/ui/smooth-cursor'
import { useTourStore } from '@/store/tour-store'
import { STEPS, THEME_FLIP_STEP_ID } from '@/tour/steps'
import { useThemeFlipCursor } from '@/hooks/animations/useThemeFlipCursor'

// Step « Thème & personnalisation » : rend le voile et le faux curseur.
// `rotate={false}` : pas de rotation par vélocité — l'orientation vient de l'angle
// dispatché par la timeline (aim). `restAngle={-35}` = inclinaison initiale.
export function ThemeFlipCursor() {
  const id = useTourStore((s) => STEPS[s.currentStep]?.id)
  const { hidden, scrimRef } = useThemeFlipCursor()

  if (id !== THEME_FLIP_STEP_ID) return null
  return (
    <>
      <div ref={scrimRef} className="gp-theme-flip-scrim" aria-hidden />
      <SmoothCursor
        key={id}
        scripted
        hideSystemCursor={false}
        rotate={false}
        restAngle={-35}
        hidden={hidden}
        zIndex={100120}
      />
    </>
  )
}
