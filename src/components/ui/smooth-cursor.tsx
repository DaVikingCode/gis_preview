import { useEffect, useRef, useState } from 'react'
import type { FC } from 'react'
import { motion, useSpring } from 'motion/react'

interface Position {
  x: number
  y: number
}

export interface SmoothCursorProps {
  cursor?: React.ReactNode
  zIndex?: number
  // When true, only follow synthetic (dispatched) pointermove events and ignore
  // the real mouse — used to drive the cursor along a scripted path.
  scripted?: boolean
  // When false, leave the real OS cursor visible (no `body { cursor: none }`).
  // Use for a purely-decorative cursor that coexists with the user's real one.
  hideSystemCursor?: boolean
  // Force the cursor to fade out (e.g. once a scripted demo has finished),
  // overriding the move-driven visibility.
  hidden?: boolean
  // Rotate the cursor to face its travel direction (default true). Set false for a
  // real-pointer feel so it never spins on a direction change.
  rotate?: boolean
  // Fixed tilt (deg) used when `rotate` is false — e.g. -35 to point up-left like a
  // real OS pointer instead of straight up (the SVG's default orientation).
  restAngle?: number
  // Suit la cible dispatchée sans ressort (jump) au lieu de la lisser : le curseur colle
  // pile à sa cible scriptée → un élément glissé reste rigide dessous (drag « franc »).
  tightTracking?: boolean
  springConfig?: {
    damping: number
    stiffness: number
    mass: number
    restDelta: number
  }
}

const DESKTOP_POINTER_QUERY = '(any-hover: hover) and (any-pointer: fine)'

function isTrackablePointer(pointerType: string) {
  return pointerType !== 'touch'
}

const DefaultCursorSVG: FC = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={50}
      height={54}
      viewBox="0 0 50 54"
      fill="none"
      style={{ scale: 0.5 }}
    >
      <g filter="url(#filter0_d_91_7928)">
        <path
          d="M42.6817 41.1495L27.5103 6.79925C26.7269 5.02557 24.2082 5.02558 23.3927 6.79925L7.59814 41.1495C6.75833 42.9759 8.52712 44.8902 10.4125 44.1954L24.3757 39.0496C24.8829 38.8627 25.4385 38.8627 25.9422 39.0496L39.8121 44.1954C41.6849 44.8902 43.4884 42.9759 42.6817 41.1495Z"
          fill="black"
        />
        <path
          d="M43.7146 40.6933L28.5431 6.34306C27.3556 3.65428 23.5772 3.69516 22.3668 6.32755L6.57226 40.6778C5.3134 43.4156 7.97238 46.298 10.803 45.2549L24.7662 40.109C25.0221 40.0147 25.2999 40.0156 25.5494 40.1082L39.4193 45.254C42.2261 46.2953 44.9254 43.4347 43.7146 40.6933Z"
          stroke="white"
          strokeWidth={2.25825}
        />
      </g>
      <defs>
        <filter
          id="filter0_d_91_7928"
          x={0.602397}
          y={0.952444}
          width={49.0584}
          height={52.428}
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity={0} result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dy={2.25825} />
          <feGaussianBlur stdDeviation={2.25825} />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.08 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_91_7928" />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="effect1_dropShadow_91_7928"
            result="shape"
          />
        </filter>
      </defs>
    </svg>
  )
}

export function SmoothCursor({
  cursor = <DefaultCursorSVG />,
  zIndex = 100,
  scripted = false,
  hideSystemCursor = true,
  hidden = false,
  rotate = true,
  restAngle = 0,
  tightTracking = false,
  springConfig = {
    damping: 45,
    stiffness: 400,
    mass: 1,
    restDelta: 0.001,
  },
}: SmoothCursorProps) {
  const lastMousePos = useRef<Position>({ x: 0, y: 0 })
  const velocity = useRef<Position>({ x: 0, y: 0 })
  const lastUpdateTime = useRef(0)
  const previousAngle = useRef(0)
  const accumulatedRotation = useRef(0)
  // False jusqu'au 1er angle dispatché (gpAngle) : on initialise alors l'accumulateur
  // sur l'orientation courante pour tourner en douceur (sans jump). Reset avec `positioned`.
  const aimed = useRef(false)
  // False jusqu'au tout premier déplacement : on téléporte alors le curseur au
  // point d'apparition (sans ressort) au lieu de le faire glisser depuis (0,0).
  const positioned = useRef(false)
  const [isEnabled, setIsEnabled] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  const cursorX = useSpring(0, springConfig)
  const cursorY = useSpring(0, springConfig)
  // Init at restAngle so a non-rotating cursor holds a realistic up-left tilt.
  const rotation = useSpring(restAngle, {
    ...springConfig,
    damping: 60,
    stiffness: 300,
  })
  const scale = useSpring(1, {
    ...springConfig,
    stiffness: 500,
    damping: 35,
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_POINTER_QUERY)

    const updateEnabled = () => {
      // Un curseur scripté est piloté par des pointermove synthétiques, pas par la
      // souris réelle : il doit s'afficher même sur mobile/tactile (sinon aucun faux
      // curseur n'apparaît pendant la visite mobile). Le gate pointeur-fin ne
      // concerne que le suivi du vrai pointeur (mode non scripté).
      const nextIsEnabled = scripted || mediaQuery.matches
      setIsEnabled(nextIsEnabled)

      if (!nextIsEnabled) {
        setIsVisible(false)
      }
    }

    updateEnabled()
    mediaQuery.addEventListener('change', updateEnabled)

    return () => {
      mediaQuery.removeEventListener('change', updateEnabled)
    }
  }, [scripted])

  useEffect(() => {
    if (!isEnabled) {
      return
    }

    let timeout: ReturnType<typeof setTimeout> | null = null
    lastUpdateTime.current = Date.now()

    const updateVelocity = (currentPos: Position) => {
      const currentTime = Date.now()
      const deltaTime = currentTime - lastUpdateTime.current

      if (deltaTime > 0) {
        velocity.current = {
          x: (currentPos.x - lastMousePos.current.x) / deltaTime,
          y: (currentPos.y - lastMousePos.current.y) / deltaTime,
        }
      }

      lastUpdateTime.current = currentTime
      lastMousePos.current = currentPos
    }

    const smoothPointerMove = (e: PointerEvent) => {
      if (!isTrackablePointer(e.pointerType)) {
        return
      }

      const currentPos = { x: e.clientX, y: e.clientY }

      // Premier positionnement : téléportation (jump, sans ressort) pour éviter le
      // glissement visible depuis le coin (0,0) jusqu'au point d'apparition. On n'affiche
      // le curseur qu'à la frame SUIVANTE, une fois le jump appliqué au DOM : sinon
      // l'opacité (React/motion) peut monter avant la position (MotionValue) → flash d'une
      // frame au coin (0,0).
      if (!positioned.current) {
        positioned.current = true
        cursorX.jump(currentPos.x)
        cursorY.jump(currentPos.y)
        lastMousePos.current = currentPos
        lastUpdateTime.current = Date.now()
        requestAnimationFrame(() => setIsVisible(true))
        return
      }

      setIsVisible(true)

      updateVelocity(currentPos)

      const speed = Math.sqrt(Math.pow(velocity.current.x, 2) + Math.pow(velocity.current.y, 2))

      // `tightTracking` : le curseur colle EXACTEMENT à la cible dispatchée (jump, sans
      // ressort) — pour un drag scripté « franc » où un élément glissé doit rester rigide
      // sous le curseur. Le chemin étant déjà lissé par GSAP, on ne perd pas de fluidité.
      if (tightTracking) {
        cursorX.jump(currentPos.x)
        cursorY.jump(currentPos.y)
      } else {
        cursorX.set(currentPos.x)
        cursorY.set(currentPos.y)
      }

      // Rotation pilotée par la timeline GSAP : l'angle de trajectoire est dispatché
      // (gpAngle) et suivi par le ressort, par plus-court-chemin. Au 1er angle on PART de
      // l'orientation courante (position naturelle) et on tourne en douceur vers la
      // direction — surtout pas de jump, qui « snapperait » à l'apparition. Un event sans
      // gpAngle (les press n'en envoient pas) laisse le curseur CONSERVER son dernier angle.
      const aimDeg = (e as PointerEvent & { gpAngle?: number }).gpAngle
      if (typeof aimDeg === 'number') {
        if (!aimed.current) {
          aimed.current = true
          const current = rotation.get()
          accumulatedRotation.current = current
          previousAngle.current = current
        }
        let angleDiff = aimDeg - previousAngle.current
        if (angleDiff > 180) angleDiff -= 360
        if (angleDiff < -180) angleDiff += 360
        accumulatedRotation.current += angleDiff
        rotation.set(accumulatedRotation.current)
        previousAngle.current = aimDeg
      }

      if (speed > 0.1) {
        if (rotate) {
          const currentAngle =
            Math.atan2(velocity.current.y, velocity.current.x) * (180 / Math.PI) + 90

          let angleDiff = currentAngle - previousAngle.current
          if (angleDiff > 180) angleDiff -= 360
          if (angleDiff < -180) angleDiff += 360
          accumulatedRotation.current += angleDiff
          rotation.set(accumulatedRotation.current)
          previousAngle.current = currentAngle
        }

        scale.set(0.95)

        if (timeout !== null) {
          clearTimeout(timeout)
        }

        timeout = setTimeout(() => {
          scale.set(1)
        }, 150)
      }
    }

    let rafId = 0
    const throttledPointerMove = (e: PointerEvent) => {
      if (!isTrackablePointer(e.pointerType)) {
        return
      }

      // In scripted mode ignore the real mouse; only follow dispatched events.
      if (scripted && e.isTrusted) {
        return
      }

      if (rafId) return

      rafId = requestAnimationFrame(() => {
        smoothPointerMove(e)
        rafId = 0
      })
    }

    if (hideSystemCursor) document.body.style.cursor = 'none'
    window.addEventListener('pointermove', throttledPointerMove, {
      passive: true,
    })

    return () => {
      window.removeEventListener('pointermove', throttledPointerMove)
      if (hideSystemCursor) document.body.style.cursor = 'auto'
      if (rafId) cancelAnimationFrame(rafId)
      if (timeout !== null) {
        clearTimeout(timeout)
      }
    }
  }, [
    cursorX,
    cursorY,
    rotation,
    scale,
    isEnabled,
    scripted,
    hideSystemCursor,
    rotate,
    tightTracking,
  ])

  // Fin d'animation scriptée (`hidden`) : on « oublie » la position courante. La
  // prochaine animation se téléportera (jump) à son point de départ au lieu de
  // faire glisser le curseur depuis l'ancienne position à travers l'écran.
  useEffect(() => {
    if (!hidden) return
    positioned.current = false
    aimed.current = false
    setIsVisible(false)
  }, [hidden])

  if (!isEnabled) {
    return null
  }

  const shown = isVisible && !hidden

  return (
    <motion.div
      data-fake-cursor=""
      style={{
        position: 'fixed',
        left: cursorX,
        top: cursorY,
        translateX: '-50%',
        translateY: '-50%',
        rotate: rotation,
        scale: scale,
        zIndex,
        pointerEvents: 'none',
        willChange: 'transform',
        opacity: shown ? 1 : 0,
      }}
      initial={false}
      animate={{ opacity: shown ? 1 : 0 }}
      transition={{
        duration: 0.15,
      }}
    >
      {cursor}
    </motion.div>
  )
}
