import maplibregl, { type Map as MLMap, type Marker } from 'maplibre-gl'
import gsap from 'gsap'

// Markers DOM « hero » des postes HTA touchés dans le step Dessin & analyse spatiale.
// Chaque poste intérieur est un NŒUD CAPTEUR à plat (core dégradé + anneau net + halo
// ambiant + glyphe éclair) monté dans un maplibregl.Marker (anchor center), animé par
// GSAP. La vague de `measureReveal` appelle `hit(i)` pile quand son front atteint le
// poste → impact « wow » : flash → 2 ondes de choc → core en overshoot → glyphe qui
// snap → gerbe d'étincelles → settle vers le halo idle. `showStatic()` pose l'état
// final sans animation (prefers-reduced-motion). Couleur hero ambre/or unifiée.

const AMBER = '#f59e0b'
const GOLD = '#fde68a'
const GLOW_IDLE = 0.4 // opacité du halo une fois posé

// Glyphe éclair (silhouette) en mask CSS — recoloré, rendu identique sur tous les OS
// (contrairement à l'emoji ⚡). Path filled dans un viewBox 24×24, URL-encodé.
const BOLT =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M7 2v11h3v9l7-12h-4l4-8z'/%3E%3C/svg%3E\")"

const SPARKS = 7
const SPARK_DIST = 26 // px, portée nominale d'une étincelle

type Node = {
  el: HTMLDivElement
  glow: HTMLDivElement
  flash: HTMLDivElement
  ring1: HTMLDivElement
  ring2: HTMLDivElement
  core: HTMLDivElement
  icon: HTMLDivElement
  marker: Marker
  tl: gsap.core.Timeline | null
}

export type PostHitMarkers = {
  // Joue l'impact du poste i (déclenché par la vague au passage du front).
  hit: (i: number) => void
  // État final immédiat, sans animation (prefers-reduced-motion).
  showStatic: () => void
  detach: () => void
}

// Un enfant centré PILE sur l'origine (le point géo) via marges négatives — surtout
// PAS via transform, qu'on laisse 100 % à GSAP (scale / rotation / x / y).
function centered(w: number, h: number, css: string): HTMLDivElement {
  const d = document.createElement('div')
  d.style.cssText =
    `position:absolute;left:0;top:0;width:${w}px;height:${h}px;` +
    `margin-left:${-w / 2}px;margin-top:${-h / 2}px;pointer-events:none;` +
    css
  return d
}

function buildNode(map: MLMap, coord: [number, number]): Node {
  // Conteneur 0×0 : MapLibre le translate sur le point (anchor center) ; on ne touche
  // pas à SON transform. Les enfants se centrent par marges et s'animent librement.
  const el = document.createElement('div')
  el.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none'

  const glow = centered(
    44,
    44,
    'border-radius:50%;background:radial-gradient(circle,rgba(245,158,11,.6),rgba(245,158,11,0) 70%);filter:blur(2px)',
  )
  const flash = centered(
    30,
    30,
    'border-radius:50%;background:radial-gradient(circle,#fff,rgba(255,255,255,0) 65%)',
  )
  const mkRing = () =>
    centered(
      16,
      16,
      `border-radius:50%;border:2px solid ${GOLD};box-shadow:0 0 8px rgba(245,158,11,.6)`,
    )
  const ring1 = mkRing()
  const ring2 = mkRing()
  const core = centered(
    14,
    14,
    `border-radius:50%;background:radial-gradient(circle at 35% 30%,${GOLD},${AMBER} 58%,#d97706 100%);` +
      'box-shadow:0 0 0 1.5px rgba(253,230,138,.9),0 0 12px rgba(245,158,11,.75),0 1px 2px rgba(0,0,0,.5)',
  )
  const icon = centered(
    9,
    9,
    `background-color:#451a03;-webkit-mask:${BOLT} center/contain no-repeat;mask:${BOLT} center/contain no-repeat`,
  )

  // Empilement : halo < flash < ondes < core < glyphe.
  glow.style.zIndex = '0'
  flash.style.zIndex = '1'
  ring1.style.zIndex = '2'
  ring2.style.zIndex = '2'
  core.style.zIndex = '3'
  icon.style.zIndex = '4'

  el.append(glow, flash, ring1, ring2, core, icon)
  // Caché au repos : rien tant que la vague n'a pas atteint le poste.
  gsap.set([glow, flash, ring1, ring2, core, icon], { autoAlpha: 0, scale: 0 })

  const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
    .setLngLat(coord)
    .addTo(map)

  return { el, glow, flash, ring1, ring2, core, icon, marker, tl: null }
}

export function createPostHitMarkers(map: MLMap, coords: [number, number][]): PostHitMarkers {
  const nodes = coords.map((c) => buildNode(map, c))

  const hit = (i: number) => {
    const n = nodes[i]
    if (!n) return
    n.tl?.kill()
    const tl = gsap.timeline()
    n.tl = tl

    // Flash bloom blanc bref.
    tl.fromTo(
      n.flash,
      { scale: 0.3, autoAlpha: 0.95 },
      { scale: 1.7, autoAlpha: 0, duration: 0.42, ease: 'power2.out' },
      0,
    )
    // Deux ondes de choc concentriques qui se propagent et s'effacent.
    tl.fromTo(
      n.ring1,
      { scale: 0.3, autoAlpha: 0.95 },
      { scale: 3.4, autoAlpha: 0, duration: 0.7, ease: 'power2.out' },
      0,
    )
    tl.fromTo(
      n.ring2,
      { scale: 0.3, autoAlpha: 0.7 },
      { scale: 4.6, autoAlpha: 0, duration: 0.85, ease: 'power2.out' },
      0.09,
    )
    // Core qui éclot en overshoot (back.out).
    tl.fromTo(
      n.core,
      { scale: 0, autoAlpha: 0 },
      { scale: 1, autoAlpha: 1, duration: 0.5, ease: 'back.out(2.2)' },
      0.04,
    )
    // Halo ambiant qui s'installe et reste posé (idle).
    tl.fromTo(
      n.glow,
      { scale: 0.4, autoAlpha: 0 },
      { scale: 1, autoAlpha: GLOW_IDLE, duration: 0.6, ease: 'power2.out' },
      0.04,
    )
    // Glyphe éclair qui snap.
    tl.fromTo(
      n.icon,
      { scale: 0, autoAlpha: 0, rotation: -40 },
      { scale: 1, autoAlpha: 1, rotation: 0, duration: 0.4, ease: 'back.out(3)' },
      0.16,
    )
    // Gerbe d'étincelles radiales (créées à la volée, retirées en fin de course).
    for (let s = 0; s < SPARKS; s++) {
      const ang = (s / SPARKS) * Math.PI * 2 + (Math.random() - 0.5) * 0.6
      const dist = SPARK_DIST * (0.75 + Math.random() * 0.5)
      const deg = (ang * 180) / Math.PI
      const spark = centered(
        7,
        2,
        `border-radius:2px;background:linear-gradient(90deg,${GOLD},rgba(245,158,11,0))`,
      )
      spark.style.zIndex = '2'
      n.el.append(spark)
      tl.fromTo(
        spark,
        { x: 0, y: 0, scale: 1, autoAlpha: 1, rotation: deg },
        {
          x: Math.cos(ang) * dist,
          y: Math.sin(ang) * dist,
          scale: 0.3,
          autoAlpha: 0,
          rotation: deg,
          duration: 0.4 + Math.random() * 0.15,
          ease: 'power2.out',
          onComplete: () => spark.remove(),
        },
        0.1 + s * 0.012,
      )
    }
  }

  const showStatic = () => {
    for (const n of nodes) {
      n.tl?.kill()
      gsap.set(n.glow, { scale: 1, autoAlpha: GLOW_IDLE })
      gsap.set(n.core, { scale: 1, autoAlpha: 1 })
      gsap.set(n.icon, { scale: 1, autoAlpha: 1 })
    }
  }

  const detach = () => {
    for (const n of nodes) {
      n.tl?.kill()
      n.tl = null
      n.marker.remove()
    }
    nodes.length = 0
  }

  return { hit, showStatic, detach }
}
