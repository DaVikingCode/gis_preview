// Hardcoded building-height sample for the Paris 3D step.
// Avoids a live queryRenderedFeatures pass on every moveend (which was the lag source).
// Distribution is hand-picked to look like a real central Paris census:
// lots of low Haussmannian buildings, a few mid-rises, a handful of tall outliers.

function fill(count: number, min: number, max: number): number[] {
  return Array.from({ length: count }, () => min + Math.random() * (max - min))
}

export const STATIC_PARIS_HEIGHTS: number[] = [
  ...fill(180, 4, 10), // small townhouses
  ...fill(420, 10, 25), // typical Haussmannian
  ...fill(120, 25, 50), // larger blocks / offices
  ...fill(28, 50, 100), // mid-rise towers
  ...fill(6, 100, 220), // skyscrapers (Montparnasse-ish, La Défense)
]

// La Défense (quartier d'affaires) : forte densité de tours de grande hauteur.
export const STATIC_LADEFENSE_HEIGHTS: number[] = [
  ...fill(40, 4, 10), // socles / commerces
  ...fill(90, 10, 25), // petits immeubles
  ...fill(120, 25, 50), // immeubles de bureaux
  ...fill(80, 50, 100), // hautes tours
  ...fill(60, 100, 231), // gratte-ciel (First, Total, Majunga…)
]
