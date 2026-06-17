import { useSyncExternalStore } from 'react'

const MOBILE_BREAKPOINT = 768
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

// Abonnement à un système externe (matchMedia) via useSyncExternalStore plutôt qu'un
// setState dans un effet : pas de render en cascade ni de bailout React Compiler, et la
// 1re valeur est correcte dès le render (plus de flash `undefined → false`).
function subscribe(onChange: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

function getSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT
}

// SPA sans SSR — valeur serveur neutre par sécurité.
function getServerSnapshot() {
  return false
}

export function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
