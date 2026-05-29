import maplibregl, { type Map as MLMap } from 'maplibre-gl'
import { createRoot, type Root } from 'react-dom/client'
import type { POIProps } from '@/data/sample-pois'
import { POIPopup } from '@/map/POIPopup'

// Popup « fiche d'intervention » partagé. Un seul popup à la fois (singletons
// module) : monte <POIPopup> dans un maplibregl.Popup stylé `.gp-popup`
// (cf. index.css + ancre driver.js). Extrait de l'ancien markers.tsx pour être
// réutilisé par la couche de supervision temps réel.
let activePopup: maplibregl.Popup | null = null
let activeRoot: Root | null = null

export function isPoiPopupOpen() {
  return activePopup !== null
}

export function closePoiPopup() {
  activePopup?.remove()
  activePopup = null
  activeRoot?.unmount()
  activeRoot = null
}

export function openPoiPopup(
  map: MLMap,
  props: POIProps,
  coords: [number, number],
  opts: { fly?: boolean } = {},
) {
  closePoiPopup()
  const node = document.createElement('div')
  node.className = 'gp-popup-host'
  const root = createRoot(node)
  root.render(<POIPopup poi={props} onClose={() => activePopup?.remove()} />)

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

  if (opts.fly) map.flyTo({ center: coords, zoom: Math.max(map.getZoom(), 12), duration: 900 })
  return popup
}
