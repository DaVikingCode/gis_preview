import { useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { ArrowUp } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { useTourStore } from '@/store/tour-store'
import { STEPS } from '@/tour/steps'
import { useTechStackReveal } from '@/hooks/animations/useTechStackReveal'
// Logos de marque monochromes (data-URI via ?inline) recolorés en blanc par CSS
// mask — cf. le pattern PlatformTile d'EcosystemBridge.
import dockerLogo from '@/assets/logos/docker.svg?inline'
import postgresLogo from '@/assets/logos/postgresql.svg?inline'
import qgisLogo from '@/assets/logos/qgis.svg?inline'
import nodeLogo from '@/assets/logos/nodedotjs.svg?inline'
import redisLogo from '@/assets/logos/redis.svg?inline'
import maplibreLogo from '@/assets/logos/maplibre.svg?inline'
import reactLogo from '@/assets/logos/react.svg?inline'

// ── Isometric slab geometry (px) ──────────────────────────────────────────────
const W = 200 // slab width
const D = 200 // slab depth
const H = 20 // slab thickness
const GAP = 36 // screen-space vertical offset between stacked layers
const RADIUS = 16 // corner radius of the slab (top + extruded sides)
const SLICES = 12 // stacked copies forming the thickness; sides follow the radius
// Orthographic isometric tilt applied to each slab; no perspective → parallel
// edges (the true "vite.dev" look) and uniform slabs at any screen offset.
const ISO = 'rotateX(54deg) rotateZ(-45deg)'

// Screen-space projection of the (orthographic) ISO transform — used to draw the
// SVG hit-polygon that exactly matches each slab's visible top-face diamond.
const RAD = Math.PI / 180
const COS_Z = Math.cos(45 * RAD)
const COS_X = Math.cos(54 * RAD)
const SIN_X = Math.sin(54 * RAD)
const PROJ_X = (W / 2 + D / 2) * COS_Z // diamond half-width on screen
const PROJ_Y = (W / 2 + D / 2) * COS_Z * COS_X // diamond half-height on screen
const TOP_SHIFT = -(H / 2) * SIN_X // top face sits this much above the slab centre

const MORPH =
  'background 0.3s ease, opacity 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease'

const offsetForIndex = (index: number, count: number) => ((count - 1) / 2 - index) * GAP

// SVG points for a slab's top-face diamond, centred on the scene centre.
function diamondPoints(index: number, count: number): string {
  const cy = offsetForIndex(index, count) + TOP_SHIFT
  return `${PROJ_X},${cy} 0,${cy - PROJ_Y} ${-PROJ_X},${cy} 0,${cy + PROJ_Y}`
}

type GlyphProps = { className?: string }

// Pas de logo PostGIS fourni → glyphe inline (trait blanc via currentColor).
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
      <path d="M12 9v9M8 12.4c1.2 1 2.6 1.5 4 1.5s2.8-.5 4-1.5" />
    </svg>
  )
}

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

type Layer = {
  id: string
  name: string
  role: string
  logo?: string
  Glyph?: (p: GlyphProps) => ReactNode
}

// Bottom → top: infra at the base, data, then backend, then the user-facing UI.
// QGIS est tout en bas, sous Docker (« QGIS sous Docker »).
const LAYERS: Layer[] = [
  { id: 'qgis', name: 'QGIS', role: 'Édition & préparation des données SIG', logo: qgisLogo },
  { id: 'docker', name: 'Docker', role: 'Conteneurisation & déploiement', logo: dockerLogo },
  { id: 'postgres', name: 'PostgreSQL', role: 'Base de données relationnelle', logo: postgresLogo },
  {
    id: 'postgis',
    name: 'PostGIS',
    role: 'Extension géospatiale · requêtes spatiales',
    Glyph: PostgisGlyph,
  },
  { id: 'node', name: 'Node.js', role: 'API & logique métier (backend)', logo: nodeLogo },
  { id: 'redis', name: 'Redis', role: 'Cache & diffusion temps réel', logo: redisLogo },
  { id: 'maplibre', name: 'MapLibre', role: 'Moteur de rendu cartographique', logo: maplibreLogo },
  { id: 'react', name: 'React', role: 'Interface utilisateur', logo: reactLogo },
]

// Derived stack extent (depends on the number of layers) — drives the scene,
// column and SVG-overlay sizing so the whole pile always fits.
const N = LAYERS.length
const HALF_SPAN = ((N - 1) / 2) * GAP + PROJ_Y
const STACK_H = Math.round(2 * HALF_SPAN)

function LayerIcon({ layer, className }: { layer: Layer; className?: string }) {
  if (layer.logo) return <LogoMask src={layer.logo} className={className} />
  if (layer.Glyph) return <layer.Glyph className={className} />
  return null
}

// One face of the cuboid (absolutely centered on the slab origin, then transformed).
function face(transform: string, w: number, h: number, extra: CSSProperties): CSSProperties {
  return {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: w,
    height: h,
    marginLeft: -w / 2,
    marginTop: -h / 2,
    transform,
    ...extra,
  }
}

function Slab({
  layer,
  index,
  count,
  wire,
}: {
  layer: Layer
  index: number
  count: number
  wire: boolean
}) {
  // Bottom slab sits lowest on screen; the top slab highest.
  const offsetY = offsetForIndex(index, count)
  const sliceStep = H / (SLICES - 1)

  return (
    <div
      className="absolute"
      style={{
        left: '50%',
        top: '50%',
        transform: `translate(-50%, -50%) translateY(${offsetY}px)`,
        transformStyle: 'preserve-3d',
        zIndex: index, // upper slabs paint over the ones below
      }}
    >
      {/* Soft arrival halo, lies in the ground plane (hidden until the layer settles). */}
      <div
        data-slab-impact
        className="pointer-events-none absolute left-1/2 top-1/2"
        style={{
          width: W,
          height: D,
          marginLeft: -W / 2,
          marginTop: -D / 2,
          transform: ISO,
          borderRadius: RADIUS + 6,
          border: '2px solid rgba(255,255,255,0.7)',
          boxShadow: '0 0 30px 4px rgba(255,255,255,0.3)',
          opacity: 0,
        }}
      />

      {/* Animated unit (GSAP owns its transform + opacity for the entrance). */}
      <div data-slab style={{ transformStyle: 'preserve-3d' }}>
        <div
          style={{
            transform: ISO,
            transformStyle: 'preserve-3d',
            position: 'relative',
            width: 1,
            height: 1,
          }}
        >
          {/* Thickness = stacked copies of the rounded shape, so the sides follow
              the corner radius exactly. They fade out in wireframe mode. */}
          {Array.from({ length: SLICES - 1 }).map((_, i) => {
            const k = i + 1
            const z = H / 2 - k * sliceStep
            const t = k / (SLICES - 1)
            const l = Math.round(36 - 24 * t) // lighter at the top edge → dark at the base
            return (
              <div
                key={`slice${k}`}
                style={face(`translateZ(${z}px)`, W, D, {
                  borderRadius: RADIUS,
                  background: `rgb(${l},${l},${l})`,
                  backfaceVisibility: 'hidden',
                  opacity: wire ? 0 : 1,
                  transition: MORPH,
                })}
              />
            )
          })}

          {/* Top surface — the readable face. */}
          <div
            style={face(`translateZ(${H / 2}px)`, W, D, {
              borderRadius: RADIUS,
              border: wire
                ? '1.5px dashed rgba(255,255,255,0.5)'
                : '1px solid rgba(255,255,255,0.18)',
              boxShadow: wire
                ? 'none'
                : 'inset 0 1px 0 rgba(255,255,255,0.14), 0 22px 46px -28px rgba(0,0,0,0.85)',
              transition: MORPH,
            })}
          >
            {/* Glass fill — fades out in wireframe so layers below show through. */}
            <div
              className="absolute inset-0"
              style={{
                borderRadius: 'inherit',
                background:
                  'linear-gradient(150deg, rgba(255,255,255,0.08) 0%, rgba(22,22,26,0.92) 48%, rgba(12,12,15,0.96) 100%)',
                opacity: wire ? 0 : 1,
                transition: MORPH,
              }}
            />
            {/* Content */}
            <div className="relative flex h-full w-full flex-col items-center justify-center gap-2 text-white">
              <span
                className="grid size-11 place-items-center rounded-2xl"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14)',
                }}
              >
                <LayerIcon layer={layer} className="size-6" />
              </span>
              <span
                className="text-[15px] font-semibold tracking-tight"
                style={{ opacity: wire ? 0 : 1, transition: 'opacity 0.3s ease' }}
              >
                {layer.name}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function LegendRow({ layer, isTop, active }: { layer: Layer; isTop: boolean; active: boolean }) {
  return (
    <div data-legend-row className="relative flex items-center gap-3 pl-7 text-white">
      {/* rail node */}
      <span
        className="absolute left-[7px] top-1/2 size-2.5 -translate-y-1/2 rounded-full transition-all"
        style={{
          background: active ? '#fff' : 'rgba(255,255,255,0.85)',
          boxShadow: active
            ? '0 0 14px 2px rgba(255,255,255,0.6)'
            : '0 0 10px 1px rgba(255,255,255,0.35)',
        }}
      />
      <span
        className="grid size-8 shrink-0 place-items-center rounded-xl transition-all"
        style={{
          background: active ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)',
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,${active ? 0.28 : 0.12})`,
        }}
      >
        <LayerIcon layer={layer} className="size-[17px]" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-sm font-semibold leading-tight text-foreground">
          {layer.name}
          {isTop && <ArrowUp className="size-3 text-white/55" />}
        </span>
        <span className="block text-[11px] leading-tight text-muted-foreground">{layer.role}</span>
      </span>
    </div>
  )
}

export function TechStackDiagram() {
  const currentStep = useTourStore((s) => s.currentStep)
  const step = STEPS[currentStep]
  const rootRef = useRef<HTMLDivElement>(null)
  // Only one slab can be hovered at a time (single id).
  const [hovered, setHovered] = useState<string | null>(null)
  const [reduce] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useTechStackReveal(rootRef, reduce)

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 flex items-center justify-center pointer-events-none"
      style={{ zIndex: 100050 }}
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm pointer-events-auto" />

      <Card
        id="techstack-diagram"
        className="relative flex flex-col gap-0 overflow-hidden bg-card/95 py-0 shadow-2xl backdrop-blur-md pointer-events-auto w-[1040px] max-w-[96vw] max-h-[92vh]"
      >
        {/* Header */}
        <div className="relative z-10 px-7 pt-6 pb-4 border-b text-left">
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/70">
            Architecture
          </div>
          <h2 className="text-xl font-semibold tracking-tight">
            {step?.title ?? 'Notre stack technique'}
          </h2>
          <p className="mt-1.5 max-w-[760px] text-sm text-muted-foreground">
            {step?.description ??
              'De la donnée à l’écran : une pile pensée pour la performance géospatiale.'}
          </p>
        </div>

        {/* Body: isometric stack (left) + pipeline legend (right) */}
        <div className="relative grid flex-1 grid-cols-[1.18fr_0.82fr] items-center gap-2">
          {/* Ambient bloom (neutral, very faint) behind the stack */}
          <div
            data-stack-glow
            className="pointer-events-none absolute left-[30%] top-1/2 size-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[60px]"
            style={{
              background: 'radial-gradient(circle, rgba(255,255,255,0.07), transparent 68%)',
            }}
          />

          {/* LEFT — the 3D scene + flat SVG hit-overlay (both float together) */}
          <div
            className="relative flex items-center justify-center"
            style={{ perspective: 'none', minHeight: STACK_H + 80 }}
          >
            <div data-stack-float style={{ position: 'relative', width: W, height: STACK_H }}>
              <div
                data-stack-scene
                style={{ transformStyle: 'preserve-3d', position: 'absolute', inset: 0 }}
              >
                {/* Ground glow the pile casts */}
                <div
                  data-stack-floor
                  className="pointer-events-none absolute left-1/2 top-1/2 rounded-full blur-2xl"
                  style={{
                    width: W * 1.7,
                    height: D * 1.7,
                    marginLeft: -(W * 1.7) / 2,
                    marginTop: -(D * 1.7) / 2 + HALF_SPAN * 0.6,
                    transform: ISO,
                    background: 'radial-gradient(circle, rgba(255,255,255,0.06), transparent 62%)',
                  }}
                />
                {LAYERS.map((layer, i) => (
                  <Slab
                    key={layer.id}
                    layer={layer}
                    index={i}
                    count={N}
                    wire={hovered !== layer.id}
                  />
                ))}
              </div>

              {/* Invisible hit-overlay. Each diamond matches a slab's visible top
                  face; drawn bottom→top so the exposed crescent of each slab is
                  what gets hit → one slab at a time. */}
              <svg
                className="absolute"
                style={{
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 2 * PROJ_X + 40,
                  height: 2 * HALF_SPAN + 40,
                  overflow: 'visible',
                  pointerEvents: 'none',
                }}
                viewBox={`${-(PROJ_X + 20)} ${-(HALF_SPAN + 20)} ${2 * PROJ_X + 40} ${2 * HALF_SPAN + 40}`}
              >
                {LAYERS.map((layer, i) => (
                  <polygon
                    key={layer.id}
                    className="gp-stack-hit"
                    points={diamondPoints(i, N)}
                    fill="none"
                    onMouseEnter={() => setHovered(layer.id)}
                    onMouseLeave={() => setHovered((h) => (h === layer.id ? null : h))}
                  />
                ))}
              </svg>
            </div>
          </div>

          {/* RIGHT — pipeline legend (column-reverse → react on top, docker at base) */}
          <div className="relative flex flex-col-reverse justify-center gap-3 pr-8">
            {/* vertical rail + travelling data-flow light */}
            <div className="pointer-events-none absolute bottom-3 left-[7px] top-3 w-px bg-white/10" />
            <div
              data-flow-rail
              className="pointer-events-none absolute bottom-3 left-[6px] top-3 w-[3px] rounded-full"
              style={{
                background:
                  'linear-gradient(to top, transparent 0%, transparent 38%, rgba(255,255,255,0.85) 50%, transparent 62%, transparent 100%)',
                backgroundSize: '100% 220%',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: '50% 120%',
              }}
            />
            {LAYERS.map((layer, i) => (
              <LegendRow
                key={layer.id}
                layer={layer}
                isTop={i === N - 1}
                active={hovered === layer.id}
              />
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}
