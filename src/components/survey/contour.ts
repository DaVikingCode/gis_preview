// Générateur de courbes de niveau partagé par le vocabulaire « feuille de relevé »
// (StartScreen, OutroScreen…). Des rayons modulés par quelques harmoniques fixes donnent
// des isolignes irrégulières et imbriquées — topographiques, pas des cercles concentriques.

export type Harmonic = { k: number; a: number; p: number }

export const HARMONICS: Harmonic[] = [
  { k: 1, a: 0.11, p: 0.6 },
  { k: 2, a: 0.07, p: 2.1 },
  { k: 3, a: 0.045, p: 4.0 },
  { k: 5, a: 0.024, p: 1.2 },
]

// `squash` < 1 écrase verticalement → relief en légère perspective.
export function contourPath(
  cx: number,
  cy: number,
  radius: number,
  squash = 0.82,
  harmonics: Harmonic[] = HARMONICS,
): string {
  const N = 84
  const pts: string[] = []
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2
    let rr = 1
    for (const h of harmonics) rr += h.a * Math.sin(h.k * t + h.p)
    const r = radius * rr
    const x = cx + r * Math.cos(t)
    const y = cy + r * Math.sin(t) * squash
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return `M${pts.join(' L')}Z`
}

export type ContourRing = { d: string; peak: boolean; delay: number }

export function buildContours(opts: {
  cx: number
  cy: number
  radii: number[]
  peakCount?: number
  squash?: number
  baseDelay?: number
  step?: number
}): ContourRing[] {
  // step ≳ durée du tracé (cf. .gp-contour dans index.css) → les isolignes se dessinent
  // une par une, du sommet vers l'extérieur, plutôt qu'en lavis simultané.
  const { cx, cy, radii, peakCount = 2, squash = 0.82, baseDelay = 80, step = 320 } = opts
  return radii.map((radius, i) => ({
    d: contourPath(cx, cy, radius, squash),
    peak: i < peakCount, // les anneaux internes = le sommet, en jaune
    delay: baseDelay + i * step,
  }))
}
