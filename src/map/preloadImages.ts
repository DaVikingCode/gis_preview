import { usePreloadStore } from '@/store/preload-store'

// Vignettes de couches + photos (POI, rando) affichées pendant la visite. On
// récupère les URLs hashées par le bundler via import.meta.glob (eager → résolu au
// build, pas de fetch ici) pour ne pas maintenir une liste à la main. Les SVG
// `?inline` (logos, wordmark) sont déjà des data-URI inlinés dans le JS → aucun
// réseau, donc volontairement exclus.
const IMAGE_URLS: string[] = Object.values({
  ...import.meta.glob('@/assets/layer-previews/*.webp', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
  ...import.meta.glob('@/assets/photos/**/*.webp', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
}) as string[]

// Repli si le serveur n'expose pas Content-Length (les .webp font ~12-20 Ko).
const AVG_IMAGE_BYTES = 15_000

// Précharge toutes les images d'interface dès le splash : réchauffe le cache HTTP et
// alimente le loader. Best-effort — chaque image terminée (succès OU échec) crédite sa
// part pour que le gate ne reste jamais bloqué.
let imagesPreloaded = false
export function preloadImages(): void {
  if (imagesPreloaded) return
  imagesPreloaded = true
  const pl = usePreloadStore.getState()
  pl.addTotal(IMAGE_URLS.length * AVG_IMAGE_BYTES)
  pl.markReady()
  for (const url of IMAGE_URLS) {
    void fetch(url, { cache: 'force-cache' })
      .then((res) => res.arrayBuffer())
      .catch(() => {})
      .finally(() => pl.addLoaded(AVG_IMAGE_BYTES))
  }
}
