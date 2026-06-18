// Aperçus du tour : une capture d'écran par étape, nommée `step-NN.webp` où NN est
// l'index de l'étape dans STEPS (pas l'ordre de capture). Le mapping a été établi
// en lisant le n° d'étape inscrit dans la popover de chaque capture, car l'ordre
// chronologique des captures ne collait PAS à l'ordre des étapes :
//   - l'étape 18 (`rt-surcharge`) avait été capturée deux fois (doublon écarté).
// Les vignettes sont des webp redimensionnés (~560px). Une étape sans vignette
// renvoie undefined → la carte affiche un placeholder.
const modules = import.meta.glob<string>('../assets/stepper_preview/step-*.webp', {
  eager: true,
  import: 'default',
})

export function previewForStep(index: number): string | undefined {
  const key = `../assets/stepper_preview/step-${String(index).padStart(2, '0')}.webp`
  return modules[key]
}

// Toutes les URLs de vignettes, pour préchauffage (cf. prewarm.ts) afin que la
// carte de survol s'affiche instantanément au premier hover.
export const STEP_PREVIEW_URLS: string[] = Object.values(modules)
