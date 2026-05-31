import maplibregl, { type Map as MLMap } from 'maplibre-gl'
import { createRoot, type Root } from 'react-dom/client'
import type { HikePoiResolved } from '@/data/sample-hike-pois'
import { HikePoiPopup } from '@/map/HikePoiPopup'

// Popup « point d'intérêt » du sentier (step « Terrain 3D · randonnée »). Singletons
// module — un seul popup à la fois, ouvert/fermé par la boucle GSAP de hikingTerrain.ts
// au passage du randonneur. Même infra que openPoiPopup.tsx (maplibregl.Popup `.gp-popup`
// + createRoot React), mais composant et état distincts (thème alpin, pas de clic).
let activePopup: maplibregl.Popup | null = null
let activeRoot: Root | null = null

export function closeHikePoiPopup() {
  activePopup?.remove()
  activePopup = null
  activeRoot?.unmount()
  activeRoot = null
}

export function openHikePoiPopup(map: MLMap, poi: HikePoiResolved, coords: [number, number]) {
  closeHikePoiPopup()
  const node = document.createElement('div')
  node.className = 'gp-popup-host'
  const root = createRoot(node)
  root.render(<HikePoiPopup poi={poi} />)

  const popup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    offset: 16,
    maxWidth: 'none',
    className: 'gp-popup',
  })
    .setLngLat(coords)
    .setDOMContent(node)
    .addTo(map)

  popup.on('close', () => {
    root.unmount()
    if (activePopup === popup) {
      activePopup = null
      activeRoot = null
    }
  })

  activePopup = popup
  activeRoot = root
  return popup
}
