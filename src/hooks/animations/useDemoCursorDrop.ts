import type { RefObject } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { useTourStore } from '@/store/tour-store'
import { dispatchCursor } from '@/animations/tourCursor'

// Faux curseur qui « glisse-dépose » un fichier sur la zone d'import du catalogue,
// puis fait avancer la visite tout seul (pas de « Suivant » manuel — verrouillé via
// le gate dropDone). C'est le SmoothCursor (magicui) piloté par des pointermove
// synthétiques, comme useDemoCursorClick, mais en geste drag-and-drop : un fantôme
// de fichier ([data-drop-file], portalisé sur <body>) entre par le bord de l'écran,
// reste collé à la pointe le long d'un arc (Bézier quadratique) jusqu'à la zone, qui
// réagit ; puis le fichier se dépose (fond dans la zone) et la visite passe à l'étape
// d'import. En reduced-motion la chorégraphie est ignorée mais la visite avance.

// Décalage du fantôme par rapport à la pointe (en dessous-droite, sens « glissé »).
const GHOST_DX = 10
const GHOST_DY = 14

export function useDemoCursorDrop(
  rootRef: RefObject<HTMLDivElement | null>,
  viewportRef: RefObject<HTMLDivElement | null>,
  dropImport: boolean,
  isImport: boolean,
) {
  useGSAP(
    () => {
      const root = rootRef.current
      if (!dropImport || isImport || !root) return
      const zone = root.querySelector<HTMLElement>('[data-layer-id="import"]')
      const ghost = document.querySelector<HTMLElement>('[data-drop-file]')
      const label = root.querySelector<HTMLElement>('[data-import-label]')
      if (!zone || !ghost) return
      // Le SmoothCursor est rendu spring (Framer Motion) : sa position à l'écran
      // « traîne » derrière la cible dispatchée. Pour que le fichier reste COLLÉ au
      // curseur, on lit la position RÉELLE du curseur à chaque frame plutôt que la
      // cible. (Tombe sur la cible dispatchée si le curseur n'est pas monté.)
      const cursorEl = document.querySelector<HTMLElement>('[data-fake-cursor]')
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

      const finish = () => {
        const s = useTourStore.getState()
        s.setDropDone(true)
        s.jumpToStep?.(s.currentStep + 1)
      }

      // Colle le fantôme sur la position rendue du curseur (avec décalage « main »).
      const stickGhost = (fallbackX: number, fallbackY: number) => {
        if (cursorEl) {
          const c = cursorEl.getBoundingClientRect()
          gsap.set(ghost, {
            x: c.left + c.width / 2 + GHOST_DX,
            y: c.top + c.height / 2 + GHOST_DY,
          })
        } else {
          gsap.set(ghost, { x: fallbackX + GHOST_DX, y: fallbackY + GHOST_DY })
        }
      }

      // Sécurité : la zone d'import est le 1er élément, mais on remonte en haut.
      viewportRef.current?.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })

      if (reduced) {
        // Pas de chorégraphie — on avance quand même (pas de « Suivant » manuel).
        gsap.delayedCall(0.6, finish)
        return
      }

      // GSAP pilote seul la zone : on neutralise sa transition CSS le temps du geste
      // (sinon GSAP + transition CSS = double animation → rendu saccadé).
      gsap.set(zone, { transition: 'none' })

      // Délai : laisse l'apparition du catalogue (stagger) se stabiliser.
      const tl = gsap.timeline({ delay: 0.85 })

      // ── Arc « main humaine » depuis le bord (bas-droite, hors écran) jusqu'au
      // centre de la zone d'import. Point de contrôle décalé perpendiculairement à
      // la corde → trajectoire courbe, jamais une ligne droite robotique.
      let sx = 0
      let sy = 0
      let ex = 0
      let ey = 0
      let cx = 0
      let cy = 0
      tl.call(() => {
        const r = zone.getBoundingClientRect()
        ex = r.left + r.width / 2
        ey = r.top + r.height / 2
        // Départ hors écran à droite (le fichier « entre par le bord droit »).
        sx = window.innerWidth + 80
        sy = ey + 100
        const mx = (sx + ex) / 2
        const my = (sy + ey) / 2
        const dx = ex - sx
        const dy = ey - sy
        const len = Math.hypot(dx, dy) || 1
        const arc = 80 // amplitude de la courbe
        cx = mx + (-dy / len) * arc
        cy = my + (dx / len) * arc
        dispatchCursor(sx, sy)
        gsap.set(ghost, { x: sx + GHOST_DX, y: sy + GHOST_DY, autoAlpha: 0, scale: 0.92 })
      })

      // Glissement : la pointe suit l'arc, le fantôme reste collé au curseur rendu.
      // Départ tardif (+=0.5) : laisse le ressort du curseur rejoindre l'amorce.
      const g = { t: 0 }
      tl.to(
        g,
        {
          t: 1,
          duration: 1.9,
          ease: 'power3.inOut',
          onUpdate: () => {
            const t = g.t
            const mt = 1 - t
            const x = mt * mt * sx + 2 * mt * t * cx + t * t * ex
            const y = mt * mt * sy + 2 * mt * t * cy + t * t * ey
            dispatchCursor(x, y)
            stickGhost(x, y)
          },
        },
        '+=0.5',
      )
      // Le fichier apparaît en entrant dans le cadre (même départ que le glissement).
      tl.to(ghost, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'power2.out' }, '<')

      // ── Dépôt : ancré en fin de glissement. La zone réagit à l'approche, puis le
      // fichier se dépose (fond dans la zone) + un petit rebond du curseur.
      const DROP = 'drop'
      tl.addLabel(DROP)

      // Réaction de la zone à l'approche (bordure + fond fuchsia + léger scale).
      tl.call(
        () => {
          if (label) label.textContent = 'Déposez le fichier ici'
        },
        undefined,
        `${DROP}-=0.6`,
      )
      tl.to(
        zone,
        {
          borderColor: 'rgba(217,70,239,0.9)',
          backgroundColor: 'rgba(217,70,239,0.12)',
          scale: 1.025,
          duration: 0.45,
          ease: 'power2.out',
        },
        `${DROP}-=0.6`,
      )

      // Le curseur s'enfonce (relâché) puis remonte avec un petit rebond ; le fantôme
      // reste collé pendant l'appui.
      const press = { y: 0 }
      tl.to(
        press,
        {
          y: 14,
          duration: 0.14,
          ease: 'power2.in',
          onUpdate: () => {
            dispatchCursor(ex, ey + press.y)
            stickGhost(ex, ey + press.y)
          },
        },
        DROP,
      )
      tl.to(
        press,
        {
          y: 0,
          duration: 0.5,
          ease: 'back.out(2.2)',
          onUpdate: () => {
            dispatchCursor(ex, ey + press.y)
            stickGhost(ex, ey + press.y)
          },
        },
        `${DROP}+=0.14`,
      )

      // Le fichier est absorbé par la zone (réduit + fondu).
      tl.to(ghost, { scale: 0.55, autoAlpha: 0, duration: 0.4, ease: 'power2.in' }, DROP)

      // Onde + retour d'échelle de la zone, libellé « déposé ».
      tl.fromTo(
        zone,
        { boxShadow: '0 0 0 0 rgba(217,70,239,0.5)' },
        { boxShadow: '0 0 0 14px rgba(217,70,239,0)', duration: 0.7, ease: 'power2.out' },
        DROP,
      )
      tl.to(zone, { scale: 1, duration: 0.5, ease: 'back.out(2)' }, DROP)
      tl.call(
        () => {
          if (label) label.textContent = 'Fichier déposé ✓'
        },
        undefined,
        DROP,
      )

      // Dépôt perçu → léger temps de lecture, puis on avance vers l'étape d'import
      // (la modale reste montée, seul son contenu bascule sur la simulation d'upload).
      tl.call(finish, undefined, `${DROP}+=0.9`)
    },
    { scope: rootRef, dependencies: [dropImport, isImport], revertOnUpdate: true },
  )
}
