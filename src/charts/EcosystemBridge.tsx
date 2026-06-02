import { createRef, useEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { ArrowLeftRight, ArrowRight } from 'lucide-react'
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

// Accent unique de la maquette (cf. --accent-border, src/index.css) — réservé aux
// conduits de données animés et au halo du hub. Tout le reste reste monochrome
// pour coller à l'esthétique de « Notre stack technique ».
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

// Glyphe de repli (trait blanc via currentColor) pour les plateformes sans logo
// fourni — GeoServer. Déposez geoserver.svg dans src/assets/logos pour passer
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
  side: Side
  row: number
  // Logo de marque (data-URI) prioritaire ; sinon glyphe de repli dessiné.
  logo?: string
  Glyph?: (p: GlyphProps) => ReactNode
}

// Colonne gauche = sources d'import ; colonne droite = cibles d'export. La
// répartition est illustrative : chaque connecteur est en réalité bidirectionnel.
const PLATFORMS: Platform[] = [
  { id: 'qgis', name: 'QGIS', sub: 'Projets & couches', side: 'left', row: 0, logo: qgisLogo },
  {
    id: 'googlesheets',
    name: 'Google Sheets',
    sub: 'Tableurs & attributs',
    side: 'left',
    row: 1,
    logo: googlesheetsLogo,
  },
  {
    id: 'geoserver',
    name: 'GeoServer',
    sub: 'WMS / WFS',
    side: 'left',
    row: 2,
    Glyph: GeoserverGlyph,
  },
  { id: 'arcgis', name: 'ArcGIS Pro', sub: 'Esri', side: 'right', row: 0, logo: arcgisLogo },
  {
    id: 'geoserver-out',
    name: 'GeoServer',
    sub: 'WMS / WFS',
    side: 'right',
    row: 1,
    Glyph: GeoserverGlyph,
  },
  {
    id: 'earth',
    name: 'Google Earth',
    sub: 'KML / KMZ',
    side: 'right',
    row: 2,
    logo: googleearthLogo,
  },
]

const FORMATS = ['GeoJSON', 'Shapefile', 'KML', 'GPX', 'CSV', 'WMS / WMTS', 'DWG / DXF', 'MapProxy']

type Conduit = { id: string; d: string; row: number }

function PlatformIcon({ platform, className }: { platform: Platform; className?: string }) {
  if (platform.logo) return <LogoMask src={platform.logo} className={className} />
  if (platform.Glyph) return <platform.Glyph className={className} />
  return null
}

function PlatformTile({
  platform,
  nodeRef,
}: {
  platform: Platform
  nodeRef: RefObject<HTMLSpanElement | null>
}) {
  const { name, sub, side } = platform
  return (
    <div
      data-eco-node
      className={cn(
        'flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 backdrop-blur-sm',
        side === 'right' && 'flex-row-reverse text-right',
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
  // Les conduits ne se montent qu'une fois les nœuds posés à leur place définitive
  // (onReady), sinon getBoundingClientRect mesurerait des positions animées.
  const [beamsReady, setBeamsReady] = useState(false)
  const [conduits, setConduits] = useState<Conduit[]>([])
  const [dims, setDims] = useState({ width: 0, height: 0 })

  useEcosystemReveal(rootRef, reduce, () => setBeamsReady(true))
  useEcosystemBeams(beamsRef, beamsReady && conduits.length > 0, reduce)

  // Trace une courbe de Bézier quadratique de chaque nœud vers le hub (sens
  // import) ou du hub vers chaque nœud (sens export), relative au conteneur. La
  // courbure dépend de la rangée pour étaler les conduits en éventail.
  useEffect(() => {
    if (!beamsReady) return
    const compute = () => {
      const container = containerRef.current
      const hub = hubRef.current
      if (!container || !hub) return
      const cRect = container.getBoundingClientRect()
      const hubRect = hub.getBoundingClientRect()
      const hubX = hubRect.left - cRect.left + hubRect.width / 2
      const hubY = hubRect.top - cRect.top + hubRect.height / 2

      const next: Conduit[] = []
      PLATFORMS.forEach((p, i) => {
        const node = nodeRefs[i].current
        if (!node) return
        const r = node.getBoundingClientRect()
        const nodeX = r.left - cRect.left + r.width / 2
        const nodeY = r.top - cRect.top + r.height / 2
        const isImport = p.side === 'left'
        const startX = isImport ? nodeX : hubX
        const startY = isImport ? nodeY : hubY
        const endX = isImport ? hubX : nodeX
        const endY = isImport ? hubY : nodeY
        const curvature = (1 - p.row) * 52
        const controlX = (startX + endX) / 2
        const controlY = startY - curvature
        next.push({
          id: p.id,
          row: p.row,
          d: `M ${startX},${startY} Q ${controlX},${controlY} ${endX},${endY}`,
        })
      })
      setDims({ width: cRect.width, height: cRect.height })
      setConduits(next)
    }

    compute()
    const ro = new ResizeObserver(compute)
    if (containerRef.current) ro.observe(containerRef.current)
    window.addEventListener('resize', compute)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', compute)
    }
  }, [beamsReady, nodeRefs])

  const leftPlatforms = PLATFORMS.filter((p) => p.side === 'left')
  const rightPlatforms = PLATFORMS.filter((p) => p.side === 'right')

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
              'Import comme export : la plateforme dialogue avec vos outils SIG existants.'}
          </p>
        </div>

        <div
          ref={containerRef}
          className="relative flex-1 overflow-y-auto px-4 py-6 sm:px-10 sm:py-9"
        >
          <div
            data-eco-ambient
            className="pointer-events-none absolute left-1/2 top-1/2 size-[440px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[60px]"
            style={{
              background: 'radial-gradient(circle, rgba(255,255,255,0.06), transparent 68%)',
            }}
          />

          <div ref={beamsRef} className="pointer-events-none absolute inset-0 z-0 hidden sm:block">
            {conduits.length > 0 && (
              <svg
                width={dims.width}
                height={dims.height}
                viewBox={`0 0 ${dims.width} ${dims.height}`}
                fill="none"
                className="absolute left-0 top-0 overflow-visible"
              >
                <defs>
                  <filter id="eco-pulse-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2.6" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {conduits.map((c) => (
                  <g key={c.id}>
                    <path
                      data-eco-rail
                      d={c.d}
                      pathLength={100}
                      stroke="rgba(255,255,255,0.12)"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      style={{ strokeDasharray: 100, strokeDashoffset: 100 }}
                    />
                    <path
                      data-eco-pulse
                      data-row={c.row}
                      d={c.d}
                      pathLength={100}
                      stroke={ACCENT}
                      strokeWidth={2.4}
                      strokeLinecap="round"
                      filter="url(#eco-pulse-glow)"
                      style={{ strokeDasharray: '40 60', strokeDashoffset: 0, opacity: 0 }}
                    />
                  </g>
                ))}
              </svg>
            )}
          </div>

          <div className="relative z-10 grid grid-cols-1 items-center gap-x-12 gap-y-6 sm:grid-cols-[1fr_auto_1fr] sm:gap-y-0">
            <div
              data-eco-col="left"
              className="flex w-full max-w-[240px] flex-col gap-4 justify-self-center sm:justify-self-end"
            >
              <div
                data-eco-label
                className="flex items-center justify-end gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80"
              >
                Importer depuis <ArrowRight className="size-3.5" />
              </div>
              {leftPlatforms.map((p) => {
                const idx = PLATFORMS.indexOf(p)
                return <PlatformTile key={p.id} platform={p} nodeRef={nodeRefs[idx]} />
              })}
            </div>

            <div data-eco-hub className="relative flex flex-col items-center">
              <div
                data-eco-glow
                className="pointer-events-none absolute left-1/2 top-[46px] size-36 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
                style={{
                  background: `radial-gradient(circle, ${ACCENT}, transparent 70%)`,
                  opacity: 0.4,
                }}
              />
              <div
                ref={hubRef}
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
                  <ArrowLeftRight className="size-3" /> Import &amp; Export
                </div>
              </div>
            </div>

            <div
              data-eco-col="right"
              className="flex w-full max-w-[240px] flex-col gap-4 justify-self-center sm:justify-self-start"
            >
              <div
                data-eco-label
                className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80"
              >
                <ArrowRight className="size-3.5" /> Exporter vers
              </div>
              {rightPlatforms.map((p) => {
                const idx = PLATFORMS.indexOf(p)
                return <PlatformTile key={p.id} platform={p} nodeRef={nodeRefs[idx]} />
              })}
            </div>
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
