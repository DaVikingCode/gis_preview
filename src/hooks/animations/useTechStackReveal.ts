import { useRef } from 'react'
import type { RefObject } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

// Chorégraphie de la scène isométrique « de la donnée à l'écran ». Trois couches
// de transform imbriquées découplent les mouvements pour éviter tout conflit :
//   .float  → bob ambiant (translateY)
//   .tilt   → parallax souris (rotationX / rotationY) — desktop seulement
//   .stack  → angle isométrique de repos (rotationX / rotationZ) + settle d'entrée
//
// gsap.matchMedia branche trois régimes :
//   • reduced-motion → scène assemblée, statique, aucune boucle ;
//   • desktop        → entrée + flux + parallax souris + survol par couche ;
//   • mobile         → entrée + flux + mise en avant auto cyclique (pas de parallax).
//
// Les paquets montent le long de l'axe Z central ; quand un paquet franchit le Z
// d'une couche, celle-ci « pulse » (halo [data-glow]) — le récit du flux de données.
export function useTechStackReveal(
  rootRef: RefObject<HTMLDivElement | null>,
  // Remonté à React quand un tiroir s'ouvre/ferme : l'ordinal (data-flow) du
  // tiroir ouvert, ou null si tout est fermé. Pilote le panneau 2D du bas.
  onOpenChange?: (ordinal: number | null) => void,
) {
  // Ref pour toujours appeler le dernier callback (useGSAP ne re-exécute pas).
  const onOpenChangeRef = useRef(onOpenChange)
  onOpenChangeRef.current = onOpenChange

  // API impérative exposée à React : fermer le tiroir ouvert (ex. au survol du
  // logo DVC au dos). Renseignée dans le matchMedia (où vivent open[]/setDrawer).
  const apiRef = useRef<{ closeAll: () => void }>({ closeAll: () => {} })

  useGSAP(
    () => {
      const root = rootRef.current
      if (!root) return

      const q = <T extends Element>(sel: string) => Array.from(root.querySelectorAll<T>(sel))
      const stack = root.querySelector<HTMLElement>('[data-stack]')
      const tilt = root.querySelector<HTMLElement>('[data-tilt]')
      const float = root.querySelector<HTMLElement>('[data-float]')
      const scene = root.querySelector<HTMLElement>('[data-scene]')
      const graticule = root.querySelector<SVGSVGElement>('[data-graticule]')
      const docker = q<HTMLElement>('[data-docker]')
      // Couches triées dans l'ordre du flux (= Z croissant, bas → haut).
      const layers = q<HTMLElement>('[data-layer]').sort(
        (a, b) => Number(a.dataset.flow) - Number(b.dataset.flow),
      )
      const layerZ = layers.map((el) => Number(el.dataset.z))
      const glows = layers.map((el) => el.querySelector<HTMLElement>('[data-glow]'))
      if (!stack || !tilt || !float || layers.length === 0) return

      const mm = gsap.matchMedia()
      mm.add(
        {
          reduce: '(prefers-reduced-motion: reduce)',
          desktop: '(min-width: 640px) and (prefers-reduced-motion: no-preference)',
          mobile: '(max-width: 639px) and (prefers-reduced-motion: no-preference)',
        },
        (ctx) => {
          const { reduce, mobile } = ctx.conditions as {
            reduce: boolean
            desktop: boolean
            mobile: boolean
          }

          // Briques pleines : on regarde la pile plutôt DE FACE (les faces avant
          // porteuses des libellés deviennent dominantes et continues → caisse
          // « pleine »), avec un léger plongé + twist pour le volume. Pile plus
          // haute → scale de repos réduit.
          const rest = mobile ? { rx: 72, rz: -18, scale: 0.62 } : { rx: 74, rz: -20, scale: 0.9 }
          // Course du « tiroir » : la brique coulisse vers la face ouverte (+Y).
          const DRAWER = mobile ? 64 : 84

          // ── prefers-reduced-motion : tout assemblé, immobile ────────────────
          if (reduce) {
            gsap.set(float, { scale: rest.scale, y: 0 })
            gsap.set(stack, { rotationX: rest.rx, rotationZ: rest.rz })
            layers.forEach((el, i) => gsap.set(el, { z: layerZ[i], autoAlpha: 1 }))
            gsap.set([graticule, ...docker], { autoAlpha: 1 })
            gsap.set(glows.filter(Boolean), { autoAlpha: 0 })
            return
          }

          gsap.set(float, { scale: rest.scale })

          // ── Entrée : assemblage ascendant + settle de l'angle iso ───────────
          gsap.set(graticule, { autoAlpha: 0, scale: 0.8, transformOrigin: '50% 50%' })
          gsap.set(docker, { autoAlpha: 0 })
          gsap.set(glows.filter(Boolean), { autoAlpha: 0 })
          // Les briques entrent par translateZ + visibility (PAS d'opacité : animer
          // l'opacité du conteneur aplatirait sa 3D → murs/libellé écrasés).
          gsap.set(layers, { visibility: 'hidden' })

          // Interaction CLIC = ouvrir/fermer un tiroir. `open`/`toggle` sont prêts
          // dès le départ ; les listeners eux ne s'attachent qu'à la fin de l'intro
          // (cf. attachInteractions, appelée par onComplete) pour ne pas entrer en
          // conflit avec le spin d'entrée — « ensuite on peut interagir ».
          const offs: Array<() => void> = []
          const open = layers.map(() => false)
          // Coulisse un tiroir vers la face ouverte (+Y) ou le referme. PAS
          // d'opacité sur le conteneur (aplatirait sa 3D) — le glow marque l'état.
          const setDrawer = (i: number, willOpen: boolean) => {
            const el = layers[i]
            const g = glows[i]
            open[i] = willOpen
            gsap.to(el, {
              y: willOpen ? DRAWER : 0,
              duration: willOpen ? 0.5 : 0.6,
              ease: 'power3.out',
              overwrite: 'auto',
            })
            if (g) gsap.to(g, { autoAlpha: willOpen ? 0.85 : 0, duration: 0.35, overwrite: true })
          }
          // Accordéon : ouvrir un tiroir referme les autres ; un seul ouvert à la
          // fois → un seul panneau 2D. L'ordinal ouvert (ou null) est remonté à React.
          const toggle = (i: number) => {
            const willOpen = !open[i]
            if (willOpen) layers.forEach((_, j) => j !== i && open[j] && setDrawer(j, false))
            setDrawer(i, willOpen)
            onOpenChangeRef.current?.(willOpen ? Number(layers[i].dataset.flow) : null)
          }
          // Fermeture impérative depuis React (survol logo DVC) : referme tout
          // tiroir ouvert et remonte null si l'état a changé.
          apiRef.current.closeAll = () => {
            let changed = false
            layers.forEach((_, j) => {
              if (open[j]) {
                setDrawer(j, false)
                changed = true
              }
            })
            if (changed) onOpenChangeRef.current?.(null)
          }

          // `moved` distingue un clic (toggle) d'un glissé (orbite → le clic qui
          // suit est ignoré). Partagé entre le drag et le click ci-dessous.
          let dragging = false
          let moved = false

          // Attaché à la FIN de l'intro (onComplete) : DRAG = orbite (desktop) +
          // CLIC = ouvre/ferme un tiroir. Pendant l'intro, rien n'écoute.
          const attachInteractions = () => {
            if (!mobile && scene) {
              const rotX = gsap.quickTo(tilt, 'rotationX', { duration: 0.45, ease: 'power3' })
              const rotY = gsap.quickTo(tilt, 'rotationY', { duration: 0.45, ease: 'power3' })
              const clampX = gsap.utils.clamp(-34, 34)
              const rot = { x: 0, y: 0 }
              let lastX = 0
              let lastY = 0
              let startX = 0
              let startY = 0

              const onDown = (e: PointerEvent) => {
                dragging = true
                moved = false
                startX = lastX = e.clientX
                startY = lastY = e.clientY
                scene.style.cursor = 'grabbing'
              }
              const onMove = (e: PointerEvent) => {
                if (!dragging) return
                if (Math.hypot(e.clientX - startX, e.clientY - startY) > 5) moved = true
                rot.y += (e.clientX - lastX) * 0.4
                rot.x = clampX(rot.x - (e.clientY - lastY) * 0.4)
                lastX = e.clientX
                lastY = e.clientY
                rotX(rot.x)
                rotY(rot.y)
              }
              const onUp = () => {
                if (!dragging) return
                dragging = false
                scene.style.cursor = 'grab'
              }
              // Curseur grab : signale que l'on peut désormais manipuler la pile.
              scene.style.cursor = 'grab'
              scene.addEventListener('pointerdown', onDown)
              window.addEventListener('pointermove', onMove)
              window.addEventListener('pointerup', onUp)
              offs.push(() => {
                scene.removeEventListener('pointerdown', onDown)
                window.removeEventListener('pointermove', onMove)
                window.removeEventListener('pointerup', onUp)
                scene.style.cursor = ''
              })
            }

            // Clic sur un tiroir → toggle (ignoré si on vient de glisser/pivoter).
            layers.forEach((el, i) => {
              const onClick = () => {
                if (moved) return
                toggle(i)
              }
              el.addEventListener('click', onClick)
              offs.push(() => el.removeEventListener('click', onClick))
            })
          }

          // ── Timeline d'entrée : empilement → tour de table → settle iso ─────
          const tl = gsap.timeline({
            defaults: { ease: 'power3.out' },
            onComplete: attachInteractions,
          })
          tl.fromTo(
            stack,
            { rotationX: rest.rx + 20, rotationZ: rest.rz - 14 },
            { rotationX: rest.rx, rotationZ: rest.rz, duration: 1.5, ease: 'expo.out' },
            0,
          ).to(graticule, { autoAlpha: 1, scale: 1, duration: 1.1, ease: 'sine.out' }, 0.1)

          layers.forEach((el, i) => {
            const at = 0.4 + i * 0.12
            tl.set(el, { visibility: 'visible' }, at)
            tl.fromTo(
              el,
              { z: layerZ[i] - 150 },
              { z: layerZ[i], duration: 0.8, ease: 'back.out(1.3)' },
              at,
            )
          })
          // Le meuble (cadre + contours + logo dos) apparaît avant de tourner.
          tl.to(docker, { autoAlpha: 1, duration: 0.9, ease: 'power2.out' }, '>-0.35')

          // ── Rotation « planète » : le meuble tourne autour de l'axe VERTICAL de
          //    l'écran via rotationY sur [data-tilt] — qui se situe AU-DESSUS de
          //    l'inclinaison iso (rotateX) de [data-stack]. Résultat : un vrai tour
          //    type globe (planète inclinée sur son axe), PAS un flip. À mi-tour
          //    (−180°) le DOS (-Y, logo DaVikingCode) fait face à la caméra → hold
          //    lisible, puis fin du tour (−360 ≡ 0) pour retrouver l'angle de repos.
          //    Léger skew sur [data-stack] pour le dynamisme. On remet rotationY à 0
          //    à la fin pour que le drag (qui pilote aussi rotationY) reparte propre.
          const REVEAL_SKEW = mobile ? 4 : 6
          tl.addLabel('spin', '>-0.1')
          tl.to(tilt, { rotationY: -180, duration: 1.8, ease: 'power2.inOut' }, 'spin')
            .to(stack, { skewX: REVEAL_SKEW, duration: 1.8, ease: 'power2.inOut' }, 'spin')
            // Hold : dos face caméra, on laisse lire le logo.
            .to(tilt, { rotationY: -180, duration: 0.6 })
            .to(tilt, { rotationY: -360, duration: 1.8, ease: 'power2.inOut' })
            .to(stack, { skewX: 0, duration: 1.8, ease: 'power2.inOut' }, '<')
            .set(tilt, { rotationY: 0 })

          // ── Idle : rotation graticule + bob (indépendants de l'intro) ───────
          if (graticule) {
            gsap.to(graticule, {
              rotation: '+=360',
              duration: 90,
              ease: 'none',
              repeat: -1,
              transformOrigin: '50% 50%',
            })
          }
          gsap.to(float, {
            y: '-=12',
            duration: 3.6,
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
          })

          return () => offs.forEach((f) => f())
        },
      )

      return () => mm.revert()
    },
    { scope: rootRef },
  )

  return apiRef
}
