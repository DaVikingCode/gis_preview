import { useEffect } from 'react'
import { useTheme } from '@/components/theme-provider'
import { useTourStore } from '@/store/tour-store'
import { THEME_FLIP_INDEX } from '@/tour/steps'

// Pont visite → ThemeProvider. Le thème suit l'avancement de la tournée :
//  · hors visite (StartScreen) et intro catalogue/import → light ;
//  · à partir du step suivant la « Personnalisation » → dark.
// Le flip light→dark du step de perso lui-même est joué par l'AnimatedThemeToggler
// (cliqué par le faux curseur, cf. ThemeFlipCursor) — ce pont resynchronise le
// provider à l'étape d'après (et restaure light en arrière / à la sortie).
export function TourThemeSync() {
  const { setTheme } = useTheme()
  const started = useTourStore((s) => s.started)
  const currentStep = useTourStore((s) => s.currentStep)

  useEffect(() => {
    if (!started) {
      setTheme('light')
      return
    }
    setTheme(currentStep > THEME_FLIP_INDEX ? 'dark' : 'light')
  }, [started, currentStep, setTheme])

  return null
}
