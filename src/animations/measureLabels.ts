import type { Map as MLMap } from 'maplibre-gl'
import gsap from 'gsap'
import * as turf from '@turf/turf'

// Overlays DOM (badges) posés sur la carte pour le step « Mesure interactive » :
// la longueur de chaque segment, affichée à côté de son arête. Piloté en GSAP
// (pop staggered) → DOM plutôt que symbol layer pour un contrôle fin de l'anim.
// Positionné via map.project() dans un conteneur ajouté à map.getContainer().

type Pt = [number, number]

type Entry = { el: HTMLElement; anchor: Pt }

export type MeasureLabels = {
  // tl === null → état final immédiat (prefers-reduced-motion).
  addSegment: (tl: gsap.core.Timeline | null, a: Pt, b: Pt, opts: { at: number | string }) => void
  remove: () => void
}

// Décalage des labels vers l'extérieur du polygone (px écran) pour qu'ils soient
// « à côté » de l'arête et pas dessus.
const SEG_OFFSET_PX = 18

export function createMeasureLabels(map: MLMap, ring: Pt[]): MeasureLabels {
  // Idempotent : retire un overlay resté d'une visite précédente du step. Le DOM,
  // contrairement aux couches MapLibre (id fixe + garde getLayer), peut coexister
  // en double et donc s'accumuler au fil des Précédent/Suivant (notamment sous
  // StrictMode en dev, qui double-invoque les effets).
  map
    .getContainer()
    .querySelectorAll('.gp-measure-labels')
    .forEach((stale) => stale.remove())

  const container = document.createElement('div')
  container.className = 'gp-measure-labels'
  map.getContainer().appendChild(container)

  // Centroïde du polygone : référence pour pousser les labels vers l'extérieur.
  const centroid = turf.centerOfMass(turf.polygon([[...ring, ring[0]]])).geometry.coordinates as Pt

  const entries: Entry[] = []

  const reposition = () => {
    // Overlay retiré (dedup ci-dessus / changement de style) sans que remove() ait
    // tourné : on se détache pour ne pas fuiter le listener ni positionner du vide.
    if (!container.isConnected) {
      map.off('move', reposition)
      return
    }
    const c = map.project(centroid)
    for (const e of entries) {
      const p = map.project(e.anchor)
      const dx = p.x - c.x
      const dy = p.y - c.y
      const len = Math.hypot(dx, dy) || 1
      e.el.style.left = `${p.x + (dx / len) * SEG_OFFSET_PX}px`
      e.el.style.top = `${p.y + (dy / len) * SEG_OFFSET_PX}px`
    }
  }

  map.on('move', reposition)

  const addSegment: MeasureLabels['addSegment'] = (tl, a, b, { at }) => {
    const meters = Math.round(turf.distance(a, b, { units: 'kilometers' }) * 1000)
    const mid = turf.midpoint(a, b).geometry.coordinates as Pt

    const el = document.createElement('div')
    el.className = 'gp-measure-seg'
    el.textContent = `${meters} m`
    container.appendChild(el)
    entries.push({ el, anchor: mid })
    reposition()

    // xPercent/yPercent : centrage géré par GSAP (pas de transform CSS qui
    // entrerait en conflit avec le scale/y de l'animation).
    gsap.set(el, { xPercent: -50, yPercent: -50 })
    if (tl) {
      tl.fromTo(
        el,
        { autoAlpha: 0, scale: 0.6, y: 6 },
        { autoAlpha: 1, scale: 1, y: 0, duration: 0.45, ease: 'back.out(1.7)' },
        at,
      )
    } else {
      gsap.set(el, { autoAlpha: 1, scale: 1, y: 0 })
    }
  }

  return {
    addSegment,
    remove() {
      map.off('move', reposition)
      for (const e of entries) gsap.killTweensOf(e.el)
      container.remove()
      entries.length = 0
    },
  }
}
