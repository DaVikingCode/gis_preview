import {
  CURSOR_REST_ANGLE,
  cursorAngle,
  dispatchCursor,
  settledAngle,
} from '@/animations/tourCursor'

type Pt = { x: number; y: number }

// Helpers d'orientation des faux curseurs scriptés. La progression `t` (0→1) fait
// revenir le curseur à sa position naturelle sur la fin du trajet (settledAngle) : il
// arrive droit, juste avant le clic.
export function useCursorAim() {
  // Bézier quadratique : oriente la pointe le long de la courbe. Retourne la position
  // calculée (utile pour coller un ghost dessus).
  const bezier = (t: number, p0: Pt, c: Pt, p1: Pt): Pt => {
    const mt = 1 - t
    const x = mt * mt * p0.x + 2 * mt * t * c.x + t * t * p1.x
    const y = mt * mt * p0.y + 2 * mt * t * c.y + t * t * p1.y
    const dx = 2 * mt * (c.x - p0.x) + 2 * t * (p1.x - c.x)
    const dy = 2 * mt * (c.y - p0.y) + 2 * t * (p1.y - c.y)
    dispatchCursor(x, y, settledAngle(cursorAngle(dx, dy), t))
    return { x, y }
  }

  // Glissement rectiligne orienté. Si `t` est fourni, on revient à la position naturelle
  // sur la fin du trajet ; sinon angle fixe.
  const segment = (x: number, y: number, dirX: number, dirY: number, t?: number): void =>
    dispatchCursor(
      x,
      y,
      t === undefined ? cursorAngle(dirX, dirY) : settledAngle(cursorAngle(dirX, dirY), t),
    )

  // Retour explicite à la position naturelle (ex. au relâcher d'un drag) : le ressort
  // de rotation du curseur lisse la transition.
  const rest = (x: number, y: number): void => dispatchCursor(x, y, CURSOR_REST_ANGLE)

  // Press / maintien : pas d'angle → le curseur conserve son dernier angle.
  const hold = (x: number, y: number): void => dispatchCursor(x, y)

  return { bezier, segment, rest, hold }
}
