// Pin de carte partagé (étapes « Vue d'ensemble » et « Supervision temps réel »)
// pour un style cohérent. Le SVG importé (map-pin-simple.svg) sert de masque CSS,
// recoloré par `color` (cf. LogoMask). À monter dans un maplibregl.Marker.
import mapPinUrl from '@/assets/logos/map-pin-simple.svg?inline'

// Décalage vertical (fraction de la taille) entre le bas de la boîte et la pointe
// du pin dans le SVG (pointe ≈ 240/256 du viewBox). Sert d'offset au Marker
// (anchor:'bottom') pour ancrer la pointe pile sur le point.
export const PIN_TIP_GAP = 0.0625

export function createPinEl(size: number, color: string, interactive = false) {
  const el = document.createElement('div')
  // position:absolute requis par MapLibre Marker (sinon les marqueurs s'empilent
  // dans le flux et se retrouvent décalés). top/left:0 → la translation MapLibre place.
  el.style.cssText =
    `position:absolute;top:0;left:0;width:${size}px;height:${size}px;` +
    (interactive ? 'cursor:pointer' : 'pointer-events:none')

  const pin = document.createElement('div')
  pin.style.cssText =
    `width:100%;height:100%;background-color:${color};` +
    `-webkit-mask-image:url("${mapPinUrl}");mask-image:url("${mapPinUrl}");` +
    `-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;` +
    `-webkit-mask-position:center;mask-position:center;` +
    `-webkit-mask-size:contain;mask-size:contain;` +
    `filter:drop-shadow(0 1px 2px rgba(0,0,0,.5));transition:background-color .4s ease`
  el.append(pin)

  return { el, pin }
}
