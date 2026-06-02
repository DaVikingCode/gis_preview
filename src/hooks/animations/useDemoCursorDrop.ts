import type { RefObject } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { useTourStore } from '@/store/tour-store'
import { dispatchCursor } from '@/animations/tourCursor'
import { useCursorAim } from '@/hooks/animations/useCursorAim'

// Faux curseur qui « glisse-dépose » un fichier ([data-drop-file], portalisé sur
// <body>) sur la zone d'import du catalogue, puis fait avancer la visite tout seul
// (verrouillé via le gate dropDone).

// Décalage du fantôme par rapport à la pointe (en dessous-droite, sens « glissé »).
const GHOST_DX = 10
const GHOST_DY = 14

export function useDemoCursorDrop(
  rootRef: RefObject<HTMLDivElement | null>,
  viewportRef: RefObject<HTMLDivElement | null>,
  dropImport: boolean,
  isImport: boolean,
) {
  const aim = useCursorAim()
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

      viewportRef.current?.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })

      if (reduced) {
        gsap.delayedCall(0.6, finish)
        return
      }

      // GSAP pilote seul la zone : on neutralise sa transition CSS le temps du geste
      // (sinon GSAP + transition CSS = double animation → rendu saccadé).
      gsap.set(zone, { transition: 'none' })

      // Délai : laisse l'apparition du catalogue (stagger) se stabiliser.
      const tl = gsap.timeline({ delay: 0.85 })

      // Arc « main humaine » depuis le bord (bas-droite, hors écran) jusqu'au centre
      // de la zone d'import. Point de contrôle décalé perpendiculairement à la corde,
      // pour une trajectoire courbe et non une ligne droite.
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

      // Départ tardif (+=0.5) : laisse le ressort du curseur rejoindre l'amorce.
      const g = { t: 0 }
      tl.to(
        g,
        {
          t: 1,
          duration: 1.9,
          ease: 'power3.inOut',
          onUpdate: () => {
            const p = aim.bezier(g.t, { x: sx, y: sy }, { x: cx, y: cy }, { x: ex, y: ey })
            stickGhost(p.x, p.y)
          },
        },
        '+=0.5',
      )
      tl.to(ghost, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'power2.out' }, '<')

      const DROP = 'drop'
      tl.addLabel(DROP)

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

      tl.to(ghost, { scale: 0.55, autoAlpha: 0, duration: 0.4, ease: 'power2.in' }, DROP)

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
