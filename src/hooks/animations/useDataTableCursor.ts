import type { RefObject } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import type { Map as MLMap } from 'maplibre-gl'
import { useTourStore } from '@/store/tour-store'
import { dispatchCursor } from '@/animations/tourCursor'
import { useCursorAim } from '@/hooks/animations/useCursorAim'
import { setVectorHover } from '@/map/layers/vectorStyled'
import { SAMPLE_TABLE } from '@/data/sample-table'

// Les 3 premières lignes du tableau sont, par construction, les 3 zones les plus
// centrées (cf. SAMPLE_TABLE) → elles sont toujours dans le cadre, jamais hors écran.
const TARGET_IDS = SAMPLE_TABLE.slice(0, 3).map((r) => r.id)

// Maintien sur chaque ligne : assez long pour que la transition spotlight se pose
// avant de passer à la suivante.
const DWELL = 1.4

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export function useDataTableCursor(
  rootRef: RefObject<HTMLDivElement | null>,
  active: boolean,
  map: MLMap | null,
  onActiveRow: (id: string | null) => void,
) {
  const aim = useCursorAim()
  useGSAP(
    () => {
      const root = rootRef.current
      if (!active || !map || !root) return
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

      const finish = () => {
        onActiveRow(null)
        setVectorHover(map, null)
        useTourStore.getState().setTableLinkDone(true)
      }

      if (reduced) {
        // Pas de chorégraphie — on lève quand même la gate (pas de « Suivant » manuel).
        gsap.delayedCall(0.5, finish)
        return () => {
          onActiveRow(null)
          setVectorHover(map, null)
        }
      }

      // Position courante du curseur, mise à jour à chaque frame du glissement.
      let cx = 0
      let cy = 0

      const tl = gsap.timeline({ delay: 0.6 })

      // Amorce : pose le curseur en bas-droite de la première ligne (pas de vol depuis 0,0).
      tl.call(() => {
        const first = root.querySelector<HTMLElement>(`[data-row-id="${TARGET_IDS[0]}"]`)
        if (!first) return
        const r = first.getBoundingClientRect()
        cx = r.right + 60
        cy = r.bottom + 90
        dispatchCursor(cx, cy)
      })
      tl.to({}, { duration: 0.35 }) // laisse le ressort rejoindre l'amorce

      for (const id of TARGET_IDS) {
        const sel = `[data-row-id="${id}"]`

        // Glissement rectiligne orienté jusqu'à la ligne. La cible (centre de la ligne,
        // calée à gauche sur la colonne « Zone ») et le point de départ sont figés dans
        // onStart — atomiquement, à l'instant où le glissement démarre — pour éviter
        // toute cible périmée (ex. {0,0}) qui ferait remonter le curseur hors écran.
        const g = { t: 0 }
        const p = { x: 0, y: 0 }
        let sx = 0
        let sy = 0
        let ok = false
        tl.to(g, {
          t: 1,
          duration: 0.55,
          ease: 'power2.inOut',
          onStart: () => {
            const row = root.querySelector<HTMLElement>(sel)
            if (!row) return
            const r = row.getBoundingClientRect()
            p.x = r.left + Math.min(r.width * 0.5, 220)
            p.y = r.top + r.height / 2
            sx = cx
            sy = cy
            ok = true
          },
          onUpdate: () => {
            if (!ok) return
            const x = lerp(sx, p.x, g.t)
            const y = lerp(sy, p.y, g.t)
            aim.segment(x, y, p.x - sx, p.y - sy, g.t)
            cx = x
            cy = y
          },
        })

        // Survol : surligne la ligne + spotlight la zone carte, puis maintient. On
        // ré-émet la position du curseur à chaque frame pendant le maintien (aim.hold)
        // pour épingler le ressort sur la ligne — sinon, après ~1,4s sans pointermove,
        // la reprise du glissement repart avec une vélocité périmée (curseur qui saute).
        tl.call(() => {
          onActiveRow(id)
          setVectorHover(map, id)
        })
        const hold = { t: 0 }
        tl.to(hold, { t: 1, duration: DWELL, ease: 'none', onUpdate: () => aim.hold(cx, cy) })
      }

      tl.call(finish)

      return () => {
        onActiveRow(null)
        setVectorHover(map, null)
      }
    },
    { scope: rootRef, dependencies: [active, map], revertOnUpdate: true },
  )
}
