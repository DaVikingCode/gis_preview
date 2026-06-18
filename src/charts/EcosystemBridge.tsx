import { createRef, useEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useTourStore } from '@/store/tour-store'
import { STEPS } from '@/tour/steps'
import { useEcosystemReveal } from '@/hooks/animations/useEcosystemReveal'
import { useEcosystemBeams } from '@/hooks/animations/useEcosystemBeams'
// Logos de marque (SVG monochromes). `?inline` → data-URI typé string (cf.
// vite-plus/client), recoloré en blanc via CSS mask sur la pastille.
import qgisLogo from '@/assets/logos/qgis.svg?inline'
import arcgisLogo from '@/assets/logos/arcgis.svg?inline'
import googleearthLogo from '@/assets/logos/googleearth.svg?inline'
import googlesheetsLogo from '@/assets/logos/googlesheets.svg?inline'

// Accent unique de la maquette (cf. --accent-border, src/index.css) — réservé au
// liseré du hub. Tout le reste reste monochrome pour coller à l'esthétique de
// « Notre stack technique » : la signature est la graticule, pas la couleur.
const ACCENT = '#FFEB04'

type GlyphProps = { className?: string }

// Logo monochrome recoloré en blanc : seul l'alpha du SVG sert de masque.
function LogoMask({ src, className }: { src: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={className}
      style={{
        backgroundColor: 'currentColor',
        WebkitMaskImage: `url("${src}")`,
        maskImage: `url("${src}")`,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
      }}
    />
  )
}

// Glyphes de repli (trait blanc via currentColor) pour les plateformes sans logo
// fourni — GeoServer et PostGIS. Déposez le SVG dans src/assets/logos pour passer
// au vrai logo.
function GeoserverGlyph({ className }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="4" y="4" width="16" height="5.2" rx="1.6" />
      <rect x="4" y="14.8" width="16" height="5.2" rx="1.6" />
      <path d="M7 6.6h.01M7 17.4h.01" />
    </svg>
  )
}

function PostgisGlyph({ className }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v12c0 1.66 3.13 3 7 3s7-1.34 7-3V6" />
      <path d="M5 12c0 1.66 3.13 3 7 3s7-1.34 7-3" />
    </svg>
  )
}

function HubGlyph({ className }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 3 21 8l-9 5-9-5 9-5Z" />
      <path d="M3 12.5 12 17.5 21 12.5" />
      <path d="M3 16.5 12 21.5 21 16.5" />
    </svg>
  )
}

type Side = 'left' | 'right'
type Platform = {
  id: string
  name: string
  sub: string
  // Position autour du hub, en degrés (0 = est, sens horaire ; sin > 0 → vers le bas).
  angle: number
  side: Side
  logo?: string
  Glyph?: (p: GlyphProps) => ReactNode
}

// Aucun sens import/export : la constellation est radiale parce que chaque connecteur
// est bidirectionnel. `side` ne sert qu'à orienter le texte vers l'extérieur.
const PLATFORMS: Platform[] = [
  { id: 'qgis', name: 'QGIS', sub: 'Projets & couches', angle: -140, side: 'left', logo: qgisLogo },
  {
    id: 'postgis',
    name: 'PostGIS',
    sub: 'Base spatiale',
    angle: 180,
    side: 'left',
    Glyph: PostgisGlyph,
  },
  {
    id: 'sheets',
    name: 'Google Sheets',
    sub: 'Tableurs & attributs',
    angle: 140,
    side: 'left',
    logo: googlesheetsLogo,
  },
  { id: 'arcgis', name: 'ArcGIS Pro', sub: 'Esri', angle: -40, side: 'right', logo: arcgisLogo },
  {
    id: 'geoserver',
    name: 'GeoServer',
    sub: 'WMS / WFS',
    angle: 0,
    side: 'right',
    Glyph: GeoserverGlyph,
  },
  {
    id: 'earth',
    name: 'Google Earth',
    sub: 'KML / KMZ',
    angle: 40,
    side: 'right',
    logo: googleearthLogo,
  },
]

const FORMATS = [
  'GeoJSON',
  'Shapefile',
  'GeoPackage',
  'KML / KMZ',
  'GPX',
  'CSV',
  'WMS / WMTS',
  'DWG / DXF',
]

type Point = { x: number; y: number }
type Spoke = { id: string; d: string }
type Marker = { id: string; x: number; y: number }

const HUB_RADIUS = 52 // les spokes démarrent au bord du hub, pas en son centre

function PlatformIcon({ platform, className }: { platform: Platform; className?: string }) {
  if (platform.logo) return <LogoMask src={platform.logo} className={className} />
  if (platform.Glyph) return <platform.Glyph className={className} />
  return null
}

function PlatformTile({
  platform,
  nodeRef,
  className,
}: {
  platform: Platform
  nodeRef?: RefObject<HTMLSpanElement | null>
  className?: string
}) {
  const { name, sub, side } = platform
  return (
    <div
      data-eco-node
      className={cn(
        'flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 backdrop-blur-sm',
        // L'icône regarde toujours vers le hub : à droite de la tuile côté gauche,
        // à gauche côté droit. Les spokes atterrissent ainsi sur l'icône intérieure.
        side === 'left' && 'flex-row-reverse text-right',
        className,
      )}
    >
      <span
        ref={nodeRef}
        className="grid size-11 shrink-0 place-items-center rounded-2xl text-white"
        style={{
          background: 'rgba(255,255,255,0.07)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14)',
        }}
      >
        <PlatformIcon platform={platform} className="size-[22px]" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-tight text-foreground">{name}</span>
        <span className="block text-[11px] leading-tight text-muted-foreground">{sub}</span>
      </span>
    </div>
  )
}

export function EcosystemBridge() {
  const currentStep = useTourStore((s) => s.currentStep)
  const step = STEPS[currentStep]

  const rootRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const beamsRef = useRef<HTMLDivElement>(null)
  const hubRef = useRef<HTMLDivElement>(null)
  // Tableau de refs stable (createRef → identité conservée entre rendus).
  const [nodeRefs] = useState(() => PLATFORMS.map(() => createRef<HTMLSpanElement>()))

  const [reduce] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  const [dims, setDims] = useState({ width: 0, height: 0 })
  const [positions, setPositions] = useState<Record<string, Point>>({})
  // Les spokes ne se mesurent qu'une fois les nœuds posés à leur place définitive.
  const [ready, setReady] = useState(false)
  const [spokes, setSpokes] = useState<Spoke[]>([])
  const [markers, setMarkers] = useState<Marker[]>([])

  useEcosystemReveal(rootRef, reduce, () => setReady(true))
  useEcosystemBeams(beamsRef, ready && spokes.length > 0, reduce)

  // Phase 1 — taille du conteneur → positions (px, centre de tuile) sur une ellipse
  // autour du hub. Recalculé au resize.
  useEffect(() => {
    const compute = () => {
      const el = containerRef.current
      if (!el) return
      const w = el.clientWidth
      const h = el.clientHeight
      const cx = w / 2
      const cy = h / 2
      const rx = Math.min(w * 0.33, 330)
      const ry = Math.min(h * 0.34, 150)
      const next: Record<string, Point> = {}
      PLATFORMS.forEach((p) => {
        const rad = (p.angle * Math.PI) / 180
        next[p.id] = { x: cx + rx * Math.cos(rad), y: cy + ry * Math.sin(rad) }
      })
      setDims({ width: w, height: h })
      setPositions(next)
    }
    compute()
    const ro = new ResizeObserver(compute)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Phase 2 — mesure les spokes (bord du hub → centre de l'icône de chaque nœud) et
  // le point milieu où s'ancre le marqueur ⇄. Dépend des positions, donc se relance
  // au resize une fois `ready`.
  useEffect(() => {
    if (!ready) return
    const container = containerRef.current
    const hub = hubRef.current
    if (!container || !hub) return
    const cRect = container.getBoundingClientRect()
    const hRect = hub.getBoundingClientRect()
    const hubX = hRect.left - cRect.left + hRect.width / 2
    const hubY = hRect.top - cRect.top + hRect.height / 2

    const nextSpokes: Spoke[] = []
    const nextMarkers: Marker[] = []
    PLATFORMS.forEach((p, i) => {
      const node = nodeRefs[i].current
      if (!node) return
      const r = node.getBoundingClientRect()
      const nodeX = r.left - cRect.left + r.width / 2
      const nodeY = r.top - cRect.top + r.height / 2
      const dx = nodeX - hubX
      const dy = nodeY - hubY
      const len = Math.hypot(dx, dy) || 1
      // Démarre au bord du hub pour que la ligne ne jaillisse pas de l'intérieur.
      const sx = hubX + (dx / len) * HUB_RADIUS
      const sy = hubY + (dy / len) * HUB_RADIUS
      nextSpokes.push({ id: p.id, d: `M ${sx},${sy} L ${nodeX},${nodeY}` })
      nextMarkers.push({ id: p.id, x: (sx + nodeX) / 2, y: (sy + nodeY) / 2 })
    })
    setSpokes(nextSpokes)
    setMarkers(nextMarkers)
  }, [ready, positions, nodeRefs])

  // Graticule (deux cercles pointillés + huit ticks radiaux) — la signature SIG,
  // monochrome et tournant lentement. Dimensionnée sur la plus petite demi-extension.
  const ringR = Math.max(0, Math.min(dims.width, dims.height) / 2 - 18)
  const ticks = Array.from({ length: 8 }, (_, i) => (i * 360) / 8)

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 flex items-center justify-center pointer-events-none"
      style={{ zIndex: 100050 }}
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm pointer-events-auto" />

      <Card
        id="ecosystem-diagram"
        className="relative flex flex-col gap-0 overflow-hidden bg-card/95 py-0 shadow-2xl backdrop-blur-md pointer-events-auto w-full sm:w-[1040px] max-w-[96vw] max-h-[88vh]"
      >
        <div className="relative z-10 px-7 pt-6 pb-4 border-b text-left">
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/70">
            Interopérabilité
          </div>
          <h2 className="text-xl font-semibold tracking-tight">
            {step?.title ?? 'Un pont vers tout votre écosystème SIG'}
          </h2>
          <p className="mt-1.5 max-w-[760px] text-sm text-muted-foreground">
            {step?.description ??
              'Vos outils restent les vôtres : la plateforme importe et exporte avec vos SIG existants, dans les deux sens.'}
          </p>
        </div>

        <div
          ref={containerRef}
          className="relative flex-1 overflow-hidden px-4 py-6 sm:px-10 sm:py-9 sm:min-h-[440px]"
        >
          {/* Halo neutre, très discret, derrière la constellation. */}
          <div
            data-eco-ambient
            className="pointer-events-none absolute left-1/2 top-1/2 size-[440px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[64px]"
            style={{
              background: 'radial-gradient(circle, rgba(255,255,255,0.06), transparent 68%)',
            }}
          />

          {/* ── Desktop : la constellation ───────────────────────────────────── */}
          <div ref={beamsRef} className="pointer-events-none absolute inset-0 hidden sm:block">
            {/* Graticule tournante (signature). */}
            {ringR > 40 && (
              <svg
                width={dims.width}
                height={dims.height}
                viewBox={`0 0 ${dims.width} ${dims.height}`}
                fill="none"
                className="absolute left-0 top-0"
              >
                <g
                  data-eco-ring
                  stroke="rgba(255,255,255,0.15)"
                  style={{ transformOrigin: `${dims.width / 2}px ${dims.height / 2}px` }}
                >
                  <circle
                    cx={dims.width / 2}
                    cy={dims.height / 2}
                    r={ringR}
                    strokeWidth={1}
                    strokeDasharray="2 8"
                  />
                  <circle
                    cx={dims.width / 2}
                    cy={dims.height / 2}
                    r={ringR * 0.64}
                    strokeWidth={1}
                    strokeDasharray="2 8"
                  />
                  {ticks.map((deg) => {
                    const rad = (deg * Math.PI) / 180
                    const cx = dims.width / 2
                    const cy = dims.height / 2
                    return (
                      <line
                        key={deg}
                        x1={cx + Math.cos(rad) * ringR}
                        y1={cy + Math.sin(rad) * ringR}
                        x2={cx + Math.cos(rad) * (ringR - 10)}
                        y2={cy + Math.sin(rad) * (ringR - 10)}
                        strokeWidth={1}
                      />
                    )
                  })}
                </g>
              </svg>
            )}

            {/* Spokes (filets statiques hub ↔ nœud). */}
            {spokes.length > 0 && (
              <svg
                width={dims.width}
                height={dims.height}
                viewBox={`0 0 ${dims.width} ${dims.height}`}
                fill="none"
                className="absolute left-0 top-0"
              >
                {spokes.map((s) => (
                  <path
                    key={s.id}
                    data-eco-spoke
                    d={s.d}
                    pathLength={100}
                    stroke="rgba(255,255,255,0.16)"
                    strokeWidth={1.25}
                    strokeLinecap="round"
                    style={{ strokeDasharray: 100, strokeDashoffset: 100 }}
                  />
                ))}
              </svg>
            )}

            {/* Marqueurs ⇄ — chaque connecteur est bidirectionnel. */}
            {markers.map((m) => (
              <span
                key={m.id}
                data-eco-marker
                className="absolute -translate-x-1/2 -translate-y-1/2 grid place-items-center rounded-full border border-white/10 bg-card/90 text-muted-foreground"
                style={{ left: m.x, top: m.y, width: 22, height: 22, opacity: 0 }}
              >
                <ArrowLeftRight className="size-3" />
              </span>
            ))}
          </div>

          {/* Hub central. */}
          <div className="absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 flex-col items-center sm:flex">
            {/* Liseré accent — l'unique touche de couleur. */}
            <div
              className="pointer-events-none absolute left-1/2 top-[46px] size-[132px] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ border: `1px solid ${ACCENT}`, opacity: 0.32 }}
            />
            <div
              ref={hubRef}
              data-eco-hub
              className="relative grid size-[92px] place-items-center rounded-[26px] text-white"
              style={{
                background:
                  'linear-gradient(150deg, rgba(255,255,255,0.10) 0%, rgba(22,22,26,0.92) 52%, rgba(12,12,15,0.96) 100%)',
                border: '1px solid rgba(255,255,255,0.16)',
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.18), 0 22px 46px -22px rgba(0,0,0,0.85)',
              }}
            >
              <HubGlyph className="size-10" />
            </div>
            <div className="relative mt-3 text-center">
              <div className="text-sm font-semibold leading-tight">Votre plateforme SIG</div>
              <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                <ArrowLeftRight className="size-3" /> Échange bidirectionnel
              </div>
            </div>
          </div>

          {/* Tuiles plateforme, posées sur l'ellipse. */}
          {PLATFORMS.map((p, i) => {
            const pos = positions[p.id]
            return (
              <div
                key={p.id}
                className="absolute z-10 hidden w-[210px] max-w-[210px] -translate-x-1/2 -translate-y-1/2 sm:block"
                style={{
                  left: pos?.x ?? 0,
                  top: pos?.y ?? 0,
                  visibility: pos ? 'visible' : 'hidden',
                }}
              >
                <PlatformTile platform={p} nodeRef={nodeRefs[i]} />
              </div>
            )
          })}

          {/* ── Mobile : repli en liste verticale ─────────────────────────────── */}
          <div className="flex flex-col gap-2.5 sm:hidden">
            <div className="mb-1 flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
              <ArrowLeftRight className="size-3.5" /> Échange bidirectionnel avec votre plateforme
            </div>
            {PLATFORMS.map((p) => (
              <PlatformTile key={p.id} platform={{ ...p, side: 'right' }} className="w-full" />
            ))}
          </div>
        </div>

        <div className="relative border-t px-7 py-4">
          <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60">
            Formats &amp; connecteurs pris en charge
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FORMATS.map((f) => (
              <span
                key={f}
                data-eco-chip
                className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-foreground/80"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}
