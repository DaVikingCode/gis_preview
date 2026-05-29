import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

// Pulses the driver.js "Suivant" button the moment a gated step unlocks. The
// button is rendered by driver.js outside React's tree, so it is passed in
// directly rather than selected via a scope. The tween is wrapped in
// contextSafe so it's registered to the useGSAP context and reverted on unmount
// (the original inline tween left no cleanup). Returns a stable nudge(btn).
export function useGateUnlockNudge() {
  const nudgeRef = useRef<(btn: HTMLElement) => void>(() => {})

  useGSAP((_context, contextSafe) => {
    if (!contextSafe) return
    nudgeRef.current = contextSafe((btn: HTMLElement) => {
      gsap.fromTo(
        btn,
        { scale: 1 },
        {
          scale: 1.08,
          duration: 0.18,
          repeat: 3,
          yoyo: true,
          ease: 'power1.inOut',
          transformOrigin: 'center',
        },
      )
    })
  })

  return (btn: HTMLElement) => nudgeRef.current(btn)
}
