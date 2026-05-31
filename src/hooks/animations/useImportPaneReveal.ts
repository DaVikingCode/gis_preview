import type { RefObject } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

// Pont entre le glisser-déposer et la simulation d'upload : sans ça, le contenu
// de la modale basculait sèchement du catalogue vers l'espace d'import (coupure
// franche). Ici l'espace de travail se *matérialise* — il monte depuis un léger
// flou pendant que ses panneaux (pipeline, source, aperçu, table, formats) se
// déploient en cascade DERRIÈRE la carte d'upload, dont l'arrivée reste pilotée
// par useImportSimulation ([data-up-card], non touché ici). Le résultat se lit
// comme « le fichier déposé déplie son espace d'import », juste avant que
// l'upload temps réel ne démarre. Respecte prefers-reduced-motion.
export function useImportPaneReveal(paneRef: RefObject<HTMLDivElement | null>) {
  useGSAP(
    () => {
      const root = paneRef.current
      if (!root) return
      const panels = root.querySelectorAll('[data-import-panel]')
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduced) {
        gsap.set(root, { autoAlpha: 1, y: 0, filter: 'none' })
        gsap.set(panels, { autoAlpha: 1, y: 0, scale: 1 })
        return
      }

      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
      // L'espace entier émerge d'un voile flou (transform + opacity + filter).
      tl.fromTo(
        root,
        { autoAlpha: 0, y: 12, filter: 'blur(8px)' },
        { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.5 },
      )
      // Les panneaux montent en cascade serrée — chrome vide qui se remplit
      // ensuite au fil de la simulation. La carte d'upload (hero) n'en fait pas
      // partie : son drop-in appartient à useImportSimulation.
      tl.fromTo(
        panels,
        { autoAlpha: 0, y: 16, scale: 0.985 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.45, stagger: 0.06 },
        0.1,
      )
    },
    { scope: paneRef },
  )
}
