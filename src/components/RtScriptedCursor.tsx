import { SmoothCursor } from '@/components/ui/smooth-cursor'
import { useTourStore } from '@/store/tour-store'
import { STEPS } from '@/tour/steps'
import { useRtScriptedCursor } from '@/hooks/animations/useRtScriptedCursor'

// Faux curseur de la séquence HTA (supervision + surcharge).
// `rotate={false}` : pas de rotation par vélocité — l'orientation vient de l'angle
// dispatché par la timeline (aim). `restAngle={-35}` = inclinaison initiale.
export function RtScriptedCursor() {
  const id = useTourStore((s) => STEPS[s.currentStep]?.id)
  const { hidden } = useRtScriptedCursor()

  if (id !== 'rt-supervision' && id !== 'rt-surcharge') return null
  return (
    <SmoothCursor
      key={id}
      scripted
      hideSystemCursor={false}
      rotate={false}
      restAngle={-35}
      hidden={hidden}
      zIndex={100120}
    />
  )
}
