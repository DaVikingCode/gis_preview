import type { RefObject } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { useTourStore } from '@/store/tour-store'
import { dispatchCursor } from '@/animations/tourCursor'
import { useCursorAim } from '@/hooks/animations/useCursorAim'
import {
  KANBAN_DEMO_CARD_ID,
  KANBAN_DEMO_TARGET,
  KANBAN_DEMO_EXTEND_TO,
  type TaskStatus,
} from '@/data/sample-tasks'

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

// Filet de sécurité : lève la gate même si le geste est coupé.
const SAFETY_SEC = 12

type Opts = {
  rootRef: RefObject<HTMLDivElement | null>
  active: boolean
  // Repositionne la carte dans une autre colonne (override de statut).
  onDrop: (taskId: string, status: TaskStatus) => void
  // Bascule l'onglet (Kanban → Planning).
  onTab: (value: string) => void
  // Étire la durée d'une tâche (override de span) — édition scriptée du planning.
  onExtend: (taskId: string, span: number) => void
}

// Faux curseur scripté du step « Planning & suivi d'équipe » : il attrape une carte
// « À faire », la glisse (collée au curseur via un fantôme) jusqu'à « En cours », bascule
// sur l'onglet Planning, puis étire la barre d'une tâche d'un jour pour montrer l'édition.
// Gate kanbanDone levée à la fin.
export function useKanbanCursor({ rootRef, active, onDrop, onTab, onExtend }: Opts) {
  const aim = useCursorAim()

  useGSAP(
    () => {
      const root = rootRef.current
      if (!active || !root) return
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

      const finish = () => useTourStore.getState().setKanbanDone(true)

      if (reduced) {
        // Pas de chorégraphie — on applique les résultats et on lève la gate.
        onDrop(KANBAN_DEMO_CARD_ID, KANBAN_DEMO_TARGET)
        onExtend(KANBAN_DEMO_CARD_ID, KANBAN_DEMO_EXTEND_TO)
        gsap.delayedCall(0.4, finish)
        return
      }

      const cardSel = `[data-task-id="${KANBAN_DEMO_CARD_ID}"]`
      const colSel = `[data-col-id="${KANBAN_DEMO_TARGET}"]`
      const barSel = `[data-plan-bar="${KANBAN_DEMO_CARD_ID}"]`
      const card = root.querySelector<HTMLElement>(cardSel)
      const col = root.querySelector<HTMLElement>(colSel)
      const tab = root.querySelector<HTMLElement>('[data-value="planning"]')
      const cardInner = card?.querySelector<HTMLElement>('[data-task-card]') ?? null
      if (!card || !col || !tab || !cardInner) {
        // DOM pas prêt : on lève quand même la gate pour ne pas bloquer « Suivant ».
        finish()
        return
      }

      const safety = gsap.delayedCall(SAFETY_SEC, finish)

      // Position courante de la CIBLE curseur (dispatchée), maj à chaque frame.
      let cx = 0
      let cy = 0

      // --- Fantôme : copie visuelle de la carte qui suit le curseur RENDU (ressort) ---
      let ghost: HTMLElement | null = null
      let ghostW = 0
      let ghostH = 0
      const ghostPos = { x: 0, y: 0 }
      const applyGhost = () => {
        if (!ghost) return
        ghost.style.left = `${ghostPos.x - ghostW / 2}px`
        ghost.style.top = `${ghostPos.y - ghostH / 2}px`
      }
      // Cale le fantôme PILE sur la cible curseur (cx, cy), pas sur la position rendue lue
      // au tick d'après : combiné au `tightTracking` du SmoothCursor (curseur sans ressort),
      // carte et curseur partagent la même valeur à chaque frame → drag rigide, sans traîne.
      let glued = false
      const glue = () => {
        if (!glued || !ghost) return
        ghostPos.x = cx
        ghostPos.y = cy
        applyGhost()
      }
      gsap.ticker.add(glue)
      const removeGhost = () => {
        glued = false
        ghost?.remove()
        ghost = null
        // La carte peut avoir été remontée dans une autre colonne (nouveau nœud DOM) :
        // on ré-interroge l'intérieur vivant pour le ré-afficher (fallback : nœud d'origine).
        const liveInner =
          root.querySelector<HTMLElement>(`${cardSel} [data-task-card]`) ?? cardInner
        liveInner.style.visibility = ''
      }

      // Couleur du statut « En cours » (cf. STATUS_COLOR dans KanbanPanel) — sert au halo
      // de confirmation à la dépose. `aa`/`00` = canal alpha en hex (pulse → transparent).
      const EN_COURS = '#f59e0b'

      // Micro-anim « dépose carte » : léger rebond d'échelle + halo qui pulse puis s'estompe.
      // On cible l'intérieur [data-task-card] (div simple) — pas le motion.div externe à
      // `layout`, dont le transform est piloté par le FLIP motion.
      const settleCard = () => {
        const inner = root.querySelector<HTMLElement>(`${cardSel} [data-task-card]`)
        if (!inner) return
        const stl = gsap.timeline({
          onComplete: () => gsap.set(inner, { clearProps: 'filter,transform' }),
        })
        stl.fromTo(
          inner,
          { scale: 1.06 },
          { scale: 1, duration: 0.4, ease: 'back.out(2.2)', transformOrigin: '50% 50%' },
        )
        stl.fromTo(
          inner,
          { filter: `drop-shadow(0 0 12px ${EN_COURS}aa)` },
          { filter: `drop-shadow(0 0 0px ${EN_COURS}00)`, duration: 0.55, ease: 'power2.out' },
          '<',
        )
      }

      // Micro-anim « étirement barre » : halo le long de la barre (filter, sans conflit FLIP)
      // + pop de la poignée (span simple).
      const settleBar = () => {
        const bar = root.querySelector<HTMLElement>(barSel)
        if (bar)
          gsap.fromTo(
            bar,
            { filter: `drop-shadow(0 0 10px ${EN_COURS}aa)` },
            {
              filter: `drop-shadow(0 0 0px ${EN_COURS}00)`,
              duration: 0.6,
              ease: 'power2.out',
              clearProps: 'filter',
            },
          )
        const handle = root.querySelector<HTMLElement>(
          `[data-plan-handle="${KANBAN_DEMO_CARD_ID}"]`,
        )
        if (handle)
          gsap.fromTo(
            handle,
            { scale: 1.3 },
            {
              scale: 1,
              duration: 0.45,
              ease: 'back.out(2.4)',
              transformOrigin: '50% 50%',
              clearProps: 'transform',
            },
          )
      }

      const tl = gsap.timeline({
        delay: 0.6,
        onComplete: () => {
          gsap.ticker.remove(glue)
          safety.kill()
        },
      })

      // 1) Amorce : pose le curseur en bas-droite de la carte.
      tl.call(() => {
        const r = card.getBoundingClientRect()
        cx = r.right + 40
        cy = r.bottom + 60
        dispatchCursor(cx, cy)
      })
      tl.to({}, { duration: 0.35 })

      // 2) Glissement orienté jusqu'au centre de la carte.
      const g = { t: 0 }
      const p = { x: 0, y: 0 }
      let sx = 0
      let sy = 0
      tl.to(g, {
        t: 1,
        duration: 0.5,
        ease: 'power2.inOut',
        onStart: () => {
          const r = card.getBoundingClientRect()
          p.x = r.left + r.width / 2
          p.y = r.top + r.height / 2
          sx = cx
          sy = cy
        },
        onUpdate: () => {
          const x = lerp(sx, p.x, g.t)
          const y = lerp(sy, p.y, g.t)
          aim.hold(x, y) // pointeur calme (inclinaison −35° fixe) : glisse sans tourner
          cx = x
          cy = y
        },
      })

      // 3) « Saisie » : on crée le fantôme à la place de la carte, on masque la vraie carte
      //    (sa case reste occupée → pas de reflux pendant le drag), puis on colle au curseur.
      tl.call(() => {
        const r = cardInner.getBoundingClientRect()
        ghostW = r.width
        ghostH = r.height
        ghost = cardInner.cloneNode(true) as HTMLElement
        Object.assign(ghost.style, {
          position: 'fixed',
          left: `${r.left}px`,
          top: `${r.top}px`,
          width: `${r.width}px`,
          height: `${r.height}px`,
          margin: '0',
          zIndex: '1000000050',
          pointerEvents: 'none',
          boxShadow: '0 16px 36px -10px rgba(0,0,0,0.6)',
        })
        document.body.appendChild(ghost)
        gsap.set(ghost, { rotation: -1.5, transformOrigin: '50% 50%' })
        ghostPos.x = r.left + r.width / 2
        ghostPos.y = r.top + r.height / 2
        cardInner.style.visibility = 'hidden'
        glued = true
      })
      tl.to(ghost, { scale: 1.05, duration: 0.16, ease: 'power2.out' })
      tl.to({}, { duration: 0.04 })

      // 4) Drag : on emmène la CIBLE curseur jusqu'en tête de « En cours » ; le fantôme suit.
      //    Ease doux (power1.inOut) + pas de temps mort : la carte part tout de suite et
      //    glisse de façon continue, sans « coller » à la 1re colonne puis filer d'un coup.
      const gMove = { t: 0 }
      const mTo = { x: 0, y: 0 }
      let msx = 0
      let msy = 0
      tl.to(gMove, {
        t: 1,
        duration: 0.9,
        ease: 'power1.inOut',
        onStart: () => {
          const r = col.getBoundingClientRect()
          mTo.x = r.left + r.width / 2
          mTo.y = r.top + 64
          msx = cx
          msy = cy
        },
        onUpdate: () => {
          const x = lerp(msx, mTo.x, gMove.t)
          const y = lerp(msy, mTo.y, gMove.t)
          aim.hold(x, y) // le curseur mène, le fantôme suit (glue) ; pas de rotation
          cx = x
          cy = y
        },
      })

      // 5) Dépose : le fantôme RESTE collé au curseur (glue). On déplace la carte (override) ;
      //    sa case finale est immédiate (FLIP désactivé sur la carte démo), puis on emmène le
      //    CURSEUR jusqu'à cette case (le fantôme suit) avant de le retirer.
      tl.call(() => {
        onDrop(KANBAN_DEMO_CARD_ID, KANBAN_DEMO_TARGET)
      })
      // Court délai : laisse React monter le NOUVEAU nœud (autre colonne) ; on masque cet
      // intérieur vivant dès qu'il existe pour qu'il n'y ait pas de carte en double sous le fantôme.
      let liveHidden = false
      tl.to(
        {},
        {
          duration: 0.18,
          onUpdate: () => {
            aim.hold(cx, cy)
            if (!liveHidden) {
              const li = root.querySelector<HTMLElement>(`${cardSel} [data-task-card]`)
              if (li) {
                li.style.visibility = 'hidden'
                liveHidden = true
              }
            }
          },
        },
      )
      const land = { t: 0 }
      const lTo = { x: 0, y: 0 }
      let lsx = 0
      let lsy = 0
      tl.to(land, {
        t: 1,
        duration: 0.34,
        ease: 'power2.inOut',
        onStart: () => {
          // Ré-interroge le nœud VIVANT (l'ancien `card` est détaché après le changement de
          // colonne → son rect serait (0,0) et enverrait le curseur en haut-gauche).
          const live = root.querySelector<HTMLElement>(cardSel) ?? card
          const r = live.getBoundingClientRect() // carte posée dans « En cours » (FLIP fini)
          // Garde-fou : rect vide (nœud détaché) → on reste sur place plutôt que sauter en (0,0).
          lsx = cx
          lsy = cy
          lTo.x = r.width ? r.left + r.width / 2 : cx
          lTo.y = r.width ? r.top + r.height / 2 : cy
        },
        onUpdate: () => {
          // On pilote la CIBLE curseur ; le fantôme, toujours collé (glue), suit le curseur.
          cx = lerp(lsx, lTo.x, land.t)
          cy = lerp(lsy, lTo.y, land.t)
          aim.hold(cx, cy)
        },
      })
      tl.to(ghost, { scale: 1, rotation: 0, duration: 0.18, ease: 'power2.out' }, '<')
      // Settle : le ressort du curseur rendu rattrape → le fantôme se pose pile sur la carte.
      tl.to({}, { duration: 0.25, onUpdate: () => aim.hold(cx, cy) })
      tl.call(removeGhost) // révélation sans pop : carte déjà finale, fantôme dessus
      tl.call(settleCard) // confirmation : petit rebond + halo amber
      tl.to({}, { duration: 0.2, onUpdate: () => aim.hold(cx, cy) })

      // 6) Bascule vers l'onglet Planning.
      const gt = { t: 0 }
      const tp = { x: 0, y: 0 }
      let tsx = 0
      let tsy = 0
      tl.to(gt, {
        t: 1,
        duration: 0.7,
        ease: 'power3.inOut', // glisse posée, sans à-coup, vers l'onglet
        onStart: () => {
          const r = tab.getBoundingClientRect()
          tp.x = r.left + r.width / 2
          tp.y = r.top + r.height / 2
          tsx = cx
          tsy = cy
        },
        onUpdate: () => {
          const x = lerp(tsx, tp.x, gt.t)
          const y = lerp(tsy, tp.y, gt.t)
          aim.hold(x, y) // pas de rotation : la montée se lit comme une approche, pas un flail
          cx = x
          cy = y
        },
      })
      // Petit « clic » (enfoncement) sur l'onglet → la montée se lit comme un clic volontaire.
      tl.to({}, { duration: 0.1, ease: 'power2.in', onUpdate: () => aim.hold(cx, cy + 6) })
      tl.to({}, { duration: 0.18, ease: 'back.out(2)', onUpdate: () => aim.hold(cx, cy) })
      tl.call(() => onTab('planning'))
      tl.to({}, { duration: 0.45, onUpdate: () => aim.hold(cx, cy) }) // planning se monte

      // 7) Édition : le curseur attrape le bord droit de la barre démo et l'étire d'un jour.
      const ge = { t: 0 }
      const eTo = { x: 0, y: 0 }
      let esx = 0
      let esy = 0
      let dayW = 0
      tl.to(ge, {
        t: 1,
        duration: 0.6,
        ease: 'power2.inOut',
        onStart: () => {
          const bar = root.querySelector<HTMLElement>(barSel)
          if (!bar) return
          const r = bar.getBoundingClientRect()
          const grid = bar.parentElement // conteneur grid-cols-5
          dayW = grid ? grid.getBoundingClientRect().width / 5 : r.width
          eTo.x = r.right
          eTo.y = r.top + r.height / 2
          esx = cx
          esy = cy
        },
        onUpdate: () => {
          const x = lerp(esx, eTo.x, ge.t)
          const y = lerp(esy, eTo.y, ge.t)
          aim.hold(x, y)
          cx = x
          cy = y
        },
      })
      // Petit « clic » (enfoncement) sur la poignée.
      tl.to({}, { duration: 0.12, onUpdate: () => aim.hold(cx, cy) }, '>')
      // Étirement « franc » : on valide la durée DÈS le début (la barre grandit via override +
      // FLIP motion) et on colle le curseur au bord droit RÉEL de la barre pendant qu'elle
      // grandit — il ne file pas devant comme avec un déplacement rigide en aveugle.
      const drag = { t: 0 }
      tl.to(drag, {
        t: 1,
        duration: 0.7,
        ease: 'power2.inOut',
        onStart: () => {
          onExtend(KANBAN_DEMO_CARD_ID, KANBAN_DEMO_EXTEND_TO)
        },
        onUpdate: () => {
          const bar = root.querySelector<HTMLElement>(barSel)
          const r = bar?.getBoundingClientRect()
          // Le curseur suit le bord droit qui grandit (fallback : avance d'un jour si lecture KO).
          cx = r?.width ? r.right : cx + dayW * 0.02
          aim.hold(cx, cy)
        },
      })
      // Court beat : laisse l'override + FLIP grandir la barre, puis confirmation (halo + pop poignée).
      tl.to({}, { duration: 0.18, onUpdate: () => aim.hold(cx, cy) })
      tl.call(settleBar)
      // Relâcher : curseur redressé, courte observation.
      tl.to({}, { duration: 0.6, onUpdate: () => aim.rest(cx, cy) })

      tl.call(finish)

      return () => {
        // Démontage en plein geste : retire le fantôme, stoppe le glue, restaure la carte.
        gsap.ticker.remove(glue)
        removeGhost()
      }
    },
    { scope: rootRef, dependencies: [active], revertOnUpdate: true },
  )
}
