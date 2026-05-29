import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  FileJson,
  Map as MapIcon,
  FileSpreadsheet,
  Database,
  Loader2,
  Upload,
  Check,
  Braces,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { SmoothCursor } from '@/components/ui/smooth-cursor'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useTourStore } from '@/store/tour-store'
import { STEPS } from '@/tour/steps'
import { cn } from '@/lib/utils'
import { SAMPLE_TABLE, type RowStatus } from '@/data/sample-table'
import { CATEGORY_COLORS } from '@/map/layers/vectorStyled'
import { ZonePreview } from '@/charts/DataTablePanel'
import { useModalReveal } from '@/hooks/animations/useModalReveal'
import { useLayerCardsStagger } from '@/hooks/animations/useLayerCardsStagger'
import { useModalHeaderReveal } from '@/hooks/animations/useModalHeaderReveal'
import { useDemoCursorClick } from '@/hooks/animations/useDemoCursorClick'
import { useDemoCursorDrop } from '@/hooks/animations/useDemoCursorDrop'
import { useLayerSpotlight } from '@/hooks/animations/useLayerSpotlight'
import { useImportSimulation } from '@/hooks/animations/useImportSimulation'

import SatelliteImg from '@/assets/layer-previews/sattelite.webp'
import IgnImg from '@/assets/layer-previews/ign.webp'
import HtaImg from '@/assets/layer-previews/hta.webp'
import BtImg from '@/assets/layer-previews/bt.webp'
import PosteHtaImg from '@/assets/layer-previews/poste_hta.webp'
import PoteauxImg from '@/assets/layer-previews/poteaux.webp'
import CadastreImg from '@/assets/layer-previews/cadastre.webp'
import DebroussaillementImg from '@/assets/layer-previews/debroussaillement.webp'
import UasImg from '@/assets/layer-previews/uas.webp'
import BiotopImg from '@/assets/layer-previews/biotop.webp'
import GeoparcImg from '@/assets/layer-previews/geoparc.webp'
import ConservatoireImg from '@/assets/layer-previews/conservatoire_espace_naturel.webp'
import ConservatoireLittoralImg from '@/assets/layer-previews/conservatoire_littoral.webp'
import Natura2000ZSCImg from '@/assets/layer-previews/natura_2000__ZSC.webp'
import Natura2000HabitatImg from '@/assets/layer-previews/natura_2000_habitat.webp'
import Natura2000OiseauxImg from '@/assets/layer-previews/natura_2000_oiseaux.webp'
import ParcNationauxImg from '@/assets/layer-previews/parc_nationaux.webp'
import ParcMarinImg from '@/assets/layer-previews/parc_naturel_marin.webp'
import ParcRegionauxImg from '@/assets/layer-previews/parc_naturels_regionaux.webp'
import ReserveBiologiqueImg from '@/assets/layer-previews/reserve_biologique.webp'
import ReserveBiosphereImg from '@/assets/layer-previews/reserve_biosphere.webp'
import ReserveNaturelImg from '@/assets/layer-previews/reserve_nat.webp'
import ReserveNatRegImg from '@/assets/layer-previews/reserve_nat_regionales.webp'
import UnescoImg from '@/assets/layer-previews/site_unesco.webp'
import ZicoImg from '@/assets/layer-previews/zico.webp'
import Znieff1Img from '@/assets/layer-previews/znieff1.webp'
import Znieff2Img from '@/assets/layer-previews/znieff2.webp'
import ZonesHumidesImg from '@/assets/layer-previews/zones_humides.webp'

type CategoryId = 'basemaps' | 'network' | 'raster' | 'protected' | 'import'

type LayerItem = {
  id: string
  name: string
  preview: string
  active: boolean
}

type Category = {
  id: CategoryId
  label: string
  ring: string
  bg: string
  border: string
  text: string
  dot: string
  layers: LayerItem[]
}

const gradient = (a: string, b: string, label: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 96'>
      <defs><linearGradient id='g' x1='0' x2='1' y1='0' y2='1'>
        <stop offset='0' stop-color='${a}'/>
        <stop offset='1' stop-color='${b}'/>
      </linearGradient></defs>
      <rect width='160' height='96' fill='url(#g)'/>
      <text x='80' y='54' font-family='system-ui' font-size='12' font-weight='600'
        text-anchor='middle' fill='white' opacity='0.85'>${label}</text>
    </svg>`,
  )}`

const CATEGORIES: Category[] = [
  {
    id: 'basemaps',
    label: 'Fonds',
    ring: 'ring-sky-500/60',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/40',
    text: 'text-sky-500',
    dot: 'bg-sky-500',
    layers: [
      {
        id: 'positron',
        name: 'Positron',
        preview: gradient('#f8fafc', '#cbd5e1', 'Positron'),
        active: true,
      },
      {
        id: 'liberty',
        name: 'Liberty',
        preview: gradient('#fef3c7', '#f59e0b', 'Liberty'),
        active: false,
      },
      {
        id: 'bright',
        name: 'Bright',
        preview: gradient('#bbf7d0', '#10b981', 'Bright'),
        active: false,
      },
      { id: 'satellite', name: 'Satellite', preview: SatelliteImg, active: false },
      { id: 'ign-plan', name: 'Plan IGN', preview: IgnImg, active: false },
    ],
  },
  {
    id: 'network',
    label: 'Réseau',
    ring: 'ring-violet-500/60',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/40',
    text: 'text-violet-500',
    dot: 'bg-violet-500',
    layers: [
      { id: 'hta', name: 'Réseau HTA', preview: HtaImg, active: true },
      { id: 'bt', name: 'Réseau BT', preview: BtImg, active: true },
      { id: 'poste-hta', name: 'Postes HTA', preview: PosteHtaImg, active: true },
      { id: 'poteaux', name: 'Poteaux', preview: PoteauxImg, active: false },
    ],
  },
  {
    id: 'raster',
    label: 'Raster',
    ring: 'ring-amber-500/60',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/40',
    text: 'text-amber-500',
    dot: 'bg-amber-500',
    layers: [
      { id: 'cadastre', name: 'Cadastre', preview: CadastreImg, active: true },
      {
        id: 'debroussaillement',
        name: 'Débroussaillement',
        preview: DebroussaillementImg,
        active: false,
      },
      { id: 'uas', name: 'UAS (drones)', preview: UasImg, active: false },
    ],
  },
  {
    id: 'protected',
    label: 'Zones protégées',
    ring: 'ring-emerald-500/60',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/40',
    text: 'text-emerald-500',
    dot: 'bg-emerald-500',
    layers: [
      { id: 'biotop', name: 'Biotope', preview: BiotopImg, active: false },
      { id: 'geoparc', name: 'Géoparc', preview: GeoparcImg, active: false },
      { id: 'cons-ens', name: 'Conservatoire ENS', preview: ConservatoireImg, active: false },
      {
        id: 'cons-litt',
        name: 'Conservatoire littoral',
        preview: ConservatoireLittoralImg,
        active: false,
      },
      { id: 'n2000-zsc', name: 'Natura 2000 ZSC', preview: Natura2000ZSCImg, active: true },
      {
        id: 'n2000-hab',
        name: 'Natura 2000 Habitat',
        preview: Natura2000HabitatImg,
        active: false,
      },
      {
        id: 'n2000-ois',
        name: 'Natura 2000 Oiseaux',
        preview: Natura2000OiseauxImg,
        active: false,
      },
      { id: 'parc-nat', name: 'Parc nationaux', preview: ParcNationauxImg, active: false },
      { id: 'parc-marin', name: 'Parc naturel marin', preview: ParcMarinImg, active: false },
      { id: 'parc-reg', name: 'Parc régionaux', preview: ParcRegionauxImg, active: false },
      { id: 'res-bio', name: 'Réserve biologique', preview: ReserveBiologiqueImg, active: false },
      { id: 'res-bios', name: 'Réserve biosphère', preview: ReserveBiosphereImg, active: false },
      { id: 'res-nat', name: 'Réserve naturelle', preview: ReserveNaturelImg, active: false },
      {
        id: 'res-nat-reg',
        name: 'Réserve nat. régionale',
        preview: ReserveNatRegImg,
        active: false,
      },
      { id: 'unesco', name: 'Site UNESCO', preview: UnescoImg, active: false },
      { id: 'zico', name: 'ZICO', preview: ZicoImg, active: false },
      { id: 'znieff1', name: 'ZNIEFF 1', preview: Znieff1Img, active: true },
      { id: 'znieff2', name: 'ZNIEFF 2', preview: Znieff2Img, active: false },
      { id: 'zones-humides', name: 'Zones humides', preview: ZonesHumidesImg, active: false },
    ],
  },
  {
    id: 'import',
    label: 'Vos données',
    ring: 'ring-fuchsia-500/60',
    bg: 'bg-fuchsia-500/10',
    border: 'border-fuchsia-500/40',
    text: 'text-fuchsia-500',
    dot: 'bg-fuchsia-500',
    layers: [],
  },
]

export function LayersPresentationModal() {
  const rootRef = useRef<HTMLDivElement>(null)
  const currentStep = useTourStore((s) => s.currentStep)
  const step = STEPS[currentStep]
  const isImport = step?.id === 'layers-import'
  const clickLayer = step?.clickLayer
  const highlightLayer = step?.highlightLayer
  const dropImport = !!step?.dropImport
  const overviewCategories = CATEGORIES.filter((c) => c.id !== 'import')
  const [tab, setTab] = useState<CategoryId>('basemaps')
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  const scrollToCat = (id: CategoryId) => {
    const vp = viewportRef.current
    const sec = sectionRefs.current[id]
    if (!vp || !sec) return
    const top =
      vp.scrollTop + (sec.getBoundingClientRect().top - vp.getBoundingClientRect().top) - 8
    vp.scrollTo({ top, behavior: 'smooth' })
  }

  // Scroll-spy: highlight the tab whose section is currently at the top.
  useEffect(() => {
    if (isImport) return
    const vp = viewportRef.current
    if (!vp) return
    const onScroll = () => {
      const vpTop = vp.getBoundingClientRect().top
      let current = overviewCategories[0]?.id ?? 'basemaps'
      for (const cat of overviewCategories) {
        const sec = sectionRefs.current[cat.id]
        if (sec && sec.getBoundingClientRect().top - vpTop <= 72) current = cat.id
      }
      setTab(current)
    }
    onScroll()
    vp.addEventListener('scroll', onScroll, { passive: true })
    return () => vp.removeEventListener('scroll', onScroll)
    // overviewCategories is derived from a module constant — stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isImport])

  useModalReveal(rootRef)
  useLayerCardsStagger(rootRef, isImport)
  useModalHeaderReveal(rootRef, step?.id)
  useDemoCursorClick(rootRef, viewportRef, clickLayer, isImport)
  useDemoCursorDrop(rootRef, viewportRef, dropImport, isImport)
  useLayerSpotlight(rootRef, viewportRef, highlightLayer, isImport)

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 flex items-center justify-center pointer-events-none"
      style={{ zIndex: 100050 }}
    >
      <div
        data-modal-backdrop
        className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-auto"
      />
      <Card
        id="layers-presentation-modal"
        data-modal-card
        className={cn(
          'relative flex flex-col bg-card/95 backdrop-blur-md shadow-2xl pointer-events-auto overflow-hidden gap-0 py-0',
          // Same frame for catalogue and import — only the inner content swaps,
          // so the modal never resizes between the pick step and the import sim.
          'w-[1180px] max-w-[96vw] max-h-[88vh]',
        )}
      >
        <div className="px-6 pt-5 pb-4 border-b text-left flex flex-col items-start justify-start">
          <div data-modal-header key={step?.id} className="w-full">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 font-medium mb-1.5">
              Données de carte
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-left">
              {step?.title ?? 'Données de carte'}
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5 text-left max-w-[680px]">
              {step?.description ?? ''}
            </p>
          </div>
        </div>

        {isImport ? (
          <div className="flex-1 min-h-0 mt-3">
            <ImportPane />
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <Tabs
              value={tab}
              onValueChange={(v) => scrollToCat(v as CategoryId)}
              className="shrink-0"
            >
              <TabsList className="self-center mt-4 h-auto grid w-[680px] max-w-[92%] grid-cols-4 p-1">
                {overviewCategories.map((cat) => (
                  <TabsTrigger
                    key={cat.id}
                    value={cat.id}
                    className="gap-1.5 py-1.5 text-[13px] data-[state=active]:font-semibold"
                  >
                    <span className={cn('size-1.5 rounded-full', cat.dot)} />
                    {cat.label}
                    <span className="ml-0.5 text-[10px] font-normal tabular-nums text-muted-foreground">
                      {cat.layers.length}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div
              ref={viewportRef}
              className="mt-4 max-h-[64vh] overflow-y-auto px-6 pb-6 pt-1 space-y-7"
            >
              <button
                type="button"
                data-layer-card
                data-layer-id="import"
                onClick={() => {
                  const s = useTourStore.getState()
                  if (step?.dropImport) {
                    s.setDropDone(true)
                    s.jumpToStep?.(s.currentStep + 1)
                  }
                }}
                className="group flex w-full items-center gap-3 rounded-xl border border-dashed border-fuchsia-500/50 bg-fuchsia-500/5 px-4 py-3 text-left transition-colors hover:bg-fuchsia-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-fuchsia-500/15 text-fuchsia-500">
                  <Upload className="size-5" />
                </span>
                <span className="min-w-0">
                  <span data-import-label className="block text-sm font-semibold">
                    Importer une couche
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    GeoJSON, KML, Shapefile, GPX, CSV — vos données deviennent une couche
                    stylisable.
                  </span>
                </span>
              </button>

              {overviewCategories.map((cat) => (
                <section
                  key={cat.id}
                  ref={(el) => {
                    sectionRefs.current[cat.id] = el
                  }}
                  className="space-y-3 scroll-mt-4"
                >
                  <div className="flex items-center gap-2">
                    <span className={cn('size-2 rounded-full', cat.dot)} />
                    <h3
                      className={cn('text-xs uppercase tracking-[0.16em] font-semibold', cat.text)}
                    >
                      {cat.label}
                    </h3>
                    <span className="text-[10px] tabular-nums text-muted-foreground/70">
                      {cat.layers.length} couches
                    </span>
                    <div className="ml-1 h-px flex-1 bg-border/60" />
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    {cat.layers.map((layer) => (
                      <LayerCard key={layer.id} layer={layer} cat={cat} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Demo cursor for the "click a layer" step — magicui SmoothCursor, steered by
          synthetic pointermove events (window-level, so the portal doesn't affect them).
          PORTALED to <body>: this modal root is `position:fixed; z-index:100050`, which
          creates a stacking context that traps any child below driver.js's popover
          (z-index 1000000000). Rendering at <body> with z above the popover is the only
          way the cursor stays visible over the popover/stepper as it glides. */}
      {clickLayer &&
        !isImport &&
        createPortal(
          <SmoothCursor zIndex={1000000100} scripted rotate={false} restAngle={-35} />,
          document.body,
        )}

      {/* Étape « Vos propres données » : un fantôme de fichier glissé + le faux
          curseur, pilotés par useDemoCursorDrop. Portalisés sur <body> (même raison
          que le curseur ci-dessus, et la Card a un backdrop-blur qui casserait un
          position:fixed enfant). Le fantôme est positionné via transform (x/y) en
          coordonnées client, alignées sur le curseur. */}
      {dropImport &&
        !isImport &&
        createPortal(
          <>
            <div
              data-drop-file
              className="fixed left-0 top-0 flex items-center gap-2.5 rounded-xl border border-fuchsia-500/40 bg-card/95 px-3 py-2 shadow-2xl backdrop-blur-md"
              style={{
                zIndex: 1000000099,
                opacity: 0,
                pointerEvents: 'none',
                willChange: 'transform',
              }}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-fuchsia-500/15 text-fuchsia-500">
                <FileJson className="size-4" />
              </span>
              <div className="leading-tight">
                <div className="text-xs font-semibold">zones_dijon.geojson</div>
                <div className="text-[10px] text-muted-foreground">GeoJSON · 64 Ko</div>
              </div>
            </div>
            <SmoothCursor zIndex={1000000100} scripted rotate={false} restAngle={-35} />
          </>,
          document.body,
        )}
    </div>
  )
}

function LayerCard({ layer, cat }: { layer: LayerItem; cat: Category }) {
  return (
    <button
      type="button"
      data-layer-card
      data-layer-id={layer.id}
      className={cn(
        'group relative block w-full overflow-hidden rounded-xl border text-left',
        'aspect-[5/4] transition-[transform,box-shadow,border-color] duration-300 ease-out',
        'hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        layer.active
          ? cn('border-transparent ring-2 shadow-xl', cat.ring)
          : 'border-border/60 shadow-md hover:border-border hover:shadow-xl',
      )}
    >
      <img
        src={layer.preview}
        alt={layer.name}
        loading="lazy"
        className={cn(
          'absolute inset-0 size-full bg-muted object-cover transition-all duration-500 ease-out group-hover:scale-[1.07]',
          layer.active
            ? 'saturate-100'
            : 'brightness-[0.78] saturate-[0.55] group-hover:brightness-100 group-hover:saturate-100',
        )}
      />

      {/* legibility scrim */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

      {/* active accent — top hairline + inner color wash */}
      {layer.active && (
        <>
          <div className={cn('absolute inset-x-0 top-0 h-0.5', cat.dot)} />
          <div className={cn('absolute inset-0 mix-blend-overlay', cat.bg)} />
        </>
      )}

      {/* status pill */}
      <div className="absolute right-2 top-2">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset backdrop-blur-md',
            layer.active
              ? cn(cat.bg, cat.text, cat.ring)
              : 'bg-black/45 text-white/75 ring-white/15',
          )}
        >
          <span className={cn('size-1.5 rounded-full', layer.active ? cat.dot : 'bg-white/45')} />
          {layer.active ? 'Visible' : 'Masquée'}
        </span>
      </div>

      {/* title */}
      <div className="absolute inset-x-0 bottom-0 p-3">
        <h4 className="text-sm font-semibold leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] line-clamp-2">
          {layer.name}
        </h4>
      </div>
    </button>
  )
}

const FORMATS = [
  { icon: FileJson, label: 'GeoJSON' },
  { icon: MapIcon, label: 'KML / KMZ' },
  { icon: Database, label: 'Shapefile' },
  { icon: MapIcon, label: 'GPX' },
  { icon: FileSpreadsheet, label: 'CSV géo' },
  { icon: Database, label: 'WMS / WFS' },
]

// The imported layer IS the same dataset shown later in the "Vue tabulaire" step
// (SAMPLE_TABLE / ZONES) — so the preview here and the map there are the very
// same polygons around Dijon → a believable "real import".
const IMPORT_ROWS = SAMPLE_TABLE
const IMPORT_FEATURES = IMPORT_ROWS.length
const IMPORT_SIZE_KO = 64

// Status presentation, mirrored from DataTablePanel's STATUS (kept compact here).
const ZONE_STATUS: Record<RowStatus, { label: string; dot: string; cls: string }> = {
  actif: {
    label: 'Actif',
    dot: '#22c55e',
    cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
  en_attente: {
    label: 'En attente',
    dot: '#f59e0b',
    cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  },
  anomalie: {
    label: 'Anomalie',
    dot: '#ef4444',
    cls: 'border-red-500/30 bg-red-500/10 text-red-300',
  },
  archive: {
    label: 'Archivé',
    dot: '#94a3b8',
    cls: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
  },
}

const CATEGORY_LABELS: Record<string, string> = {
  agricole: 'Agricole',
  urbain: 'Urbain',
  industriel: 'Industriel',
  forêt: 'Forêt',
}
const CATEGORY_LEGEND = Object.keys(CATEGORY_LABELS)
  .map((c) => ({
    c,
    label: CATEGORY_LABELS[c],
    color: CATEGORY_COLORS[c as keyof typeof CATEGORY_COLORS],
    n: IMPORT_ROWS.filter((z) => z.category === c).length,
  }))
  .filter((x) => x.n > 0)

// The import pipeline shown as a vertical stepper, lit up stage by stage.
const STAGES = [
  { key: 'upload', label: 'Téléversement', sub: `1 fichier · ${IMPORT_SIZE_KO} Ko` },
  { key: 'reproject', label: 'Reprojection', sub: 'Lambert-93 → WGS 84' },
  { key: 'schema', label: 'Validation du schéma', sub: '6 attributs détectés' },
  { key: 'index', label: 'Indexation spatiale', sub: `R-tree · ${IMPORT_FEATURES} entités` },
  { key: 'render', label: 'Ajout à la carte', sub: 'Style par catégorie' },
] as const

const STAGE_STATUS: Record<string, string> = {
  upload: 'Téléversement…',
  reproject: 'Reprojection…',
  schema: 'Validation du schéma…',
  index: 'Indexation spatiale…',
  render: 'Application du style…',
}

// Render the real zone rings into the SVG viewBox. We decouple *layout* from
// *feature size*: each ring is projected undistorted (cos(lat) correction + Y
// flip so shapes never stretch), then the zone centroids are spread across — and
// slightly past — all four edges so the wide 16:9 frame fills up and zones bleed
// off every side, like a real map window onto a larger dataset. The polygons
// themselves keep their true shape; only their spacing is exaggerated.
const VB_W = 420
const VB_H = 250
const VB_PAD = 16
// How far the outermost zone centroids land beyond each edge, as a fraction of
// the frame (per axis). Bigger = more zones bleed off that side; 0 = outermost
// centroids sit exactly on the edge (half-clipped). Tune to taste.
const SPREAD_X = 0.06
const SPREAD_Y = 0.06
// Polygon size multiplier (shape kept undistorted). Higher = bigger zones.
const FEATURE_SCALE = 1.5

// Undistorted projection of lng/lat → px (fit-to-frame, no spread applied yet).
function makeProjector(rings: [number, number][][]) {
  const pts = rings.flat()
  const lngs = pts.map((p) => p[0])
  const lats = pts.map((p) => p[1])
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const lngScale = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180))
  const spanX = (maxLng - minLng) * lngScale || 1
  const spanY = maxLat - minLat || 1
  const scale = Math.min((VB_W - 2 * VB_PAD) / spanX, (VB_H - 2 * VB_PAD) / spanY)
  return (lng: number, lat: number): [number, number] => [
    (lng - minLng) * lngScale * scale,
    (maxLat - lat) * scale,
  ]
}

const projectZone = makeProjector(IMPORT_ROWS.map((z) => z.ring))

// Project each ring once and compute its centroid in the undistorted space.
const baseZones = IMPORT_ROWS.map((z) => {
  const pts = z.ring.map(([lng, lat]) => projectZone(lng, lat))
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length
  return { z, pts, cx, cy }
})

// Centroid bounding box → remap to the spread target rect (per axis, may overflow).
const cxs = baseZones.map((b) => b.cx)
const cys = baseZones.map((b) => b.cy)
const cxMin = Math.min(...cxs)
const cyMin = Math.min(...cys)
const cSpanX = Math.max(...cxs) - cxMin || 1
const cSpanY = Math.max(...cys) - cyMin || 1
const tX0 = -SPREAD_X * VB_W
const tX1 = VB_W * (1 + SPREAD_X)
const tY0 = -SPREAD_Y * VB_H
const tY1 = VB_H * (1 + SPREAD_Y)

const IMPORT_ZONES = baseZones.map(({ z, pts, cx, cy }) => {
  const tx = tX0 + ((cx - cxMin) / cSpanX) * (tX1 - tX0)
  const ty = tY0 + ((cy - cyMin) / cSpanY) * (tY1 - tY0)
  return {
    ...z,
    color: CATEGORY_COLORS[z.category],
    d:
      'M' +
      pts
        .map(([x, y]) => {
          const px = tx + (x - cx) * FEATURE_SCALE
          const py = ty + (y - cy) * FEATURE_SCALE
          return `${px.toFixed(1)},${py.toFixed(1)}`
        })
        .join(' L') +
      ' Z',
  }
})

// Dotted canvas background — Railway/node-editor style (static, non-draggable).
const DOT_GRID = 'radial-gradient(circle, rgba(255,255,255,0.13) 1px, transparent 1.6px)'

// --- Raw GeoJSON source preview ---------------------------------------------
// A faithful-looking source view of the uploaded file, streamed in line by line
// during the "upload" stage so the demo shows the raw file → GIS render link.
// Coordinates are projected to Lambert-93 (EPSG:2154) integers so the file is
// internally consistent with the "Reprojection L93 → WGS 84" pipeline stage.
type SrcTok = { s: string; k: 'p' | 'k' | 's' | 'n'; color?: string }
type SrcLine = { d: number; t: SrcTok[] }

// Coarse WGS 84 → Lambert-93 linear fit (national) — illustrative, just enough
// to print plausible, locally-consistent metric coordinates around Dijon.
function toL93(lng: number, lat: number): [number, number] {
  const e = Math.round(892000 + (lng - 5.37) * 80700)
  const n = Math.round(6247000 + (lat - 43.3) * 111000)
  return [e, n]
}

const P = (s: string): SrcTok => ({ s, k: 'p' })
const K = (s: string): SrcTok => ({ s: `"${s}"`, k: 'k' })
const S = (s: string): SrcTok => ({ s: `"${s}"`, k: 's' })
const Num = (n: number): SrcTok => ({ s: String(n), k: 'n' })
const Cat = (s: string): SrcTok => ({
  s: `"${s}"`,
  k: 's',
  color: CATEGORY_COLORS[s as keyof typeof CATEGORY_COLORS],
})

const IMPORT_SOURCE_LINES: SrcLine[] = (() => {
  const lines: SrcLine[] = []
  lines.push({ d: 0, t: [P('{')] })
  lines.push({ d: 1, t: [K('type'), P(': '), S('FeatureCollection'), P(',')] })
  lines.push({ d: 1, t: [K('name'), P(': '), S('zones_dijon'), P(',')] })
  lines.push({
    d: 1,
    t: [
      K('crs'),
      P(': { '),
      K('type'),
      P(': '),
      S('name'),
      P(', '),
      K('properties'),
      P(': { '),
      K('name'),
      P(': '),
      S('EPSG:2154'),
      P(' } },'),
    ],
  })
  lines.push({ d: 1, t: [K('features'), P(': [')] })

  IMPORT_ROWS.forEach((z, i) => {
    const last = i === IMPORT_ROWS.length - 1
    if (i < 2) {
      // First two features fully expanded — the 6 properties echo "6 attributs
      // détectés", and the multi-vertex geometry gives the file real length to scroll.
      const verts = z.ring.slice(0, 4).map(([lng, lat]) => toL93(lng, lat))
      lines.push({ d: 2, t: [P('{')] })
      lines.push({ d: 3, t: [K('type'), P(': '), S('Feature'), P(',')] })
      lines.push({ d: 3, t: [K('properties'), P(': {')] })
      lines.push({ d: 4, t: [K('id'), P(': '), S(z.id), P(',')] })
      lines.push({ d: 4, t: [K('name'), P(': '), S(z.name), P(',')] })
      lines.push({ d: 4, t: [K('code'), P(': '), S(z.code), P(',')] })
      lines.push({ d: 4, t: [K('category'), P(': '), Cat(z.category), P(',')] })
      lines.push({ d: 4, t: [K('status'), P(': '), S(z.status), P(',')] })
      lines.push({ d: 4, t: [K('coverage'), P(': '), Num(z.coverage)] })
      lines.push({ d: 3, t: [P('},')] })
      lines.push({ d: 3, t: [K('geometry'), P(': {')] })
      lines.push({ d: 4, t: [K('type'), P(': '), S('Polygon'), P(',')] })
      lines.push({ d: 4, t: [K('coordinates'), P(': [[')] })
      verts.forEach(([e, n]) => lines.push({ d: 5, t: [P('['), Num(e), P(', '), Num(n), P('],')] }))
      lines.push({ d: 5, t: [P('… ]]')] })
      lines.push({ d: 3, t: [P('}')] })
      lines.push({ d: 2, t: [P(last ? '}' : '},')] })
    } else {
      // Remaining features collapsed to a single line each.
      const [e, n] = toL93(z.ring[0][0], z.ring[0][1])
      lines.push({
        d: 2,
        t: [
          P('{ '),
          K('type'),
          P(': '),
          S('Feature'),
          P(', '),
          K('properties'),
          P(': { '),
          K('id'),
          P(': '),
          S(z.id),
          P(', '),
          K('category'),
          P(': '),
          Cat(z.category),
          P(', … }, '),
          K('geometry'),
          P(': { '),
          K('type'),
          P(': '),
          S('Polygon'),
          P(', … [['),
          Num(e),
          P(', '),
          Num(n),
          P(']] }'),
          P(last ? ' }' : ' },'),
        ],
      })
    }
  })

  lines.push({ d: 1, t: [P(']')] })
  lines.push({ d: 0, t: [P('}')] })
  return lines
})()

function SrcToken({ tok }: { tok: SrcTok }) {
  if (tok.color) return <span style={{ color: tok.color }}>{tok.s}</span>
  const cls =
    tok.k === 'k'
      ? 'text-sky-300'
      : tok.k === 's'
        ? 'text-emerald-300'
        : tok.k === 'n'
          ? 'text-fuchsia-300'
          : 'text-slate-500'
  return (
    <span className={cls} {...(tok.k === 'k' ? { 'data-src-key': '' } : {})}>
      {tok.s}
    </span>
  )
}

function SrcLineRow({ line, n }: { line: SrcLine; n: number }) {
  return (
    <div data-src-line className="flex gap-3">
      <span className="w-5 shrink-0 select-none text-right tabular-nums text-slate-600">{n}</span>
      <span className="whitespace-pre" style={{ paddingLeft: line.d * 12 }}>
        {line.t.map((tok, i) => (
          <SrcToken key={i} tok={tok} />
        ))}
      </span>
    </div>
  )
}

function ImportPane() {
  const paneRef = useRef<HTMLDivElement>(null)
  const setImportDone = useTourStore((s) => s.setImportDone)

  useImportSimulation(paneRef, setImportDone, {
    sizeKo: IMPORT_SIZE_KO,
    features: IMPORT_FEATURES,
    stageStatus: STAGE_STATUS,
    sourceLineCount: IMPORT_SOURCE_LINES.length,
  })

  return (
    <ScrollArea className="h-full max-h-[70vh]">
      <div ref={paneRef} className="px-6 pb-6 pt-2">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,400px)_1fr] gap-5">
          {/* LEFT — file upload + pipeline */}
          <div className="space-y-4">
            <Card data-up-card className="p-4 border-fuchsia-500/40 bg-fuchsia-500/5">
              <div className="flex items-start gap-3">
                <div className="size-11 shrink-0 rounded-lg bg-fuchsia-500/15 flex items-center justify-center">
                  <FileJson className="size-5 text-fuchsia-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm truncate">zones_paca.geojson</span>
                    <Badge
                      variant="outline"
                      className="text-[10px] shrink-0 border-fuchsia-500/40 text-fuchsia-500"
                    >
                      GeoJSON
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      FeatureCollection
                    </span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                      {IMPORT_FEATURES} polygones
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-fuchsia-500 shrink-0">
                  <Loader2 data-up-spinner className="size-3.5 animate-spin" />
                  <span data-up-status>En attente</span>
                </div>
              </div>

              <div className="mt-3">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    data-up-bar
                    className="relative h-full w-full origin-left rounded-full bg-fuchsia-500"
                  >
                    <div
                      data-up-shimmer
                      className="absolute inset-y-0 -inset-x-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/55 to-transparent"
                    />
                  </div>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                  <span data-up-size>0 / 38 Ko</span>
                  <span data-up-pct className="font-medium text-foreground">
                    0%
                  </span>
                </div>
              </div>
            </Card>

            <div className="rounded-xl border bg-card/40 p-4">
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70 font-medium mb-3">
                Pipeline d’import
              </div>
              <div>
                {STAGES.map((s, i) => (
                  <div key={s.key} data-stage={s.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        data-node={s.key}
                        className="relative flex size-7 shrink-0 items-center justify-center rounded-full border bg-background"
                      >
                        <Loader2
                          data-spin={s.key}
                          className="absolute size-3.5 animate-spin text-fuchsia-500"
                        />
                        <Check data-check={s.key} className="absolute size-3.5 text-emerald-500" />
                      </div>
                      {i < STAGES.length - 1 && (
                        <div className="relative my-1 w-px flex-1 bg-border">
                          <div data-line={s.key} className="absolute inset-0 bg-emerald-500" />
                        </div>
                      )}
                    </div>
                    <div className="pb-4">
                      <div className="text-sm font-medium leading-tight">{s.label}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{s.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* raw uploaded file — streamed in line by line during upload, so the
                demo shows the source GeoJSON being read into the GIS render */}
            <div className="overflow-hidden rounded-xl border bg-card/40">
              <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
                <Braces className="size-3.5 shrink-0 text-fuchsia-500" />
                <span className="text-xs font-medium">zones_paca.geojson</span>
                <Badge
                  variant="outline"
                  className="text-[10px] shrink-0 border-fuchsia-500/40 text-fuchsia-500"
                >
                  GeoJSON
                </Badge>
                <span
                  data-src-count
                  className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground"
                >
                  0 entités
                </span>
              </div>
              <div
                data-src-body
                className="relative h-[360px] overflow-hidden bg-[#0b0b14] px-3 py-2.5 font-mono text-[11px] leading-relaxed"
              >
                {IMPORT_SOURCE_LINES.map((line, i) => (
                  <SrcLineRow key={i} line={line} n={i + 1} />
                ))}
                <div className="flex gap-3">
                  <span className="w-5 shrink-0" />
                  <span
                    data-src-caret
                    className="mt-0.5 inline-block h-3.5 w-1.5 rounded-[1px] bg-fuchsia-400"
                  />
                </div>
              </div>
              <div
                data-src-done
                className="flex items-center gap-1.5 border-t border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-[10px] font-medium text-emerald-400"
              >
                <Check className="size-3 shrink-0" />
                {IMPORT_FEATURES} features · 6 attributs · EPSG:2154 → EPSG:4326
              </div>
            </div>
          </div>

          {/* RIGHT — live preview + attribute table */}
          <div className="min-w-0 space-y-4">
            <div className="relative aspect-[16/9] overflow-hidden rounded-xl border bg-[#0b0b14]">
              <div
                className="absolute inset-0"
                style={{ backgroundImage: DOT_GRID, backgroundSize: '16px 16px' }}
              />
              <svg
                viewBox="0 0 420 250"
                className="absolute inset-0 size-full"
                preserveAspectRatio="xMidYMid meet"
                aria-hidden="true"
              >
                {IMPORT_ZONES.map((z) => (
                  <path
                    key={z.id}
                    d={z.d}
                    data-zone=""
                    pathLength={1}
                    fill={z.color}
                    stroke={z.color}
                    strokeWidth={1.4}
                    strokeLinejoin="round"
                  />
                ))}
              </svg>
              <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
                <span className="rounded-md bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white/90 ring-1 ring-inset ring-white/10 backdrop-blur">
                  Polygones
                </span>
                <span className="rounded-md bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white/90 ring-1 ring-inset ring-white/10 backdrop-blur">
                  WGS 84
                </span>
                <span
                  data-feat
                  className="rounded-md bg-fuchsia-500/25 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-fuchsia-100 ring-1 ring-inset ring-fuchsia-400/30 backdrop-blur"
                >
                  0 entités
                </span>
              </div>
              <div className="absolute bottom-2.5 left-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-black/45 px-2 py-1 ring-1 ring-inset ring-white/10 backdrop-blur">
                {CATEGORY_LEGEND.map((l) => (
                  <span
                    key={l.c}
                    className="inline-flex items-center gap-1.5 text-[10px] font-medium text-white/85"
                  >
                    <span className="size-2 rounded-[3px]" style={{ background: l.color }} />
                    {l.label}
                    <span className="tabular-nums text-white/50">{l.n}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border">
              <div className="grid grid-cols-[36px_1.5fr_1.6fr_auto_6rem] items-center gap-3 bg-muted/50 px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                <span>Aperçu</span>
                <span>Zone</span>
                <span>Responsable</span>
                <span>Statut</span>
                <span>Couverture</span>
              </div>
              <div className="divide-y divide-border/60">
                {IMPORT_ZONES.map((z) => {
                  const st = ZONE_STATUS[z.status]
                  return (
                    <div
                      key={z.id}
                      data-row
                      className="grid grid-cols-[36px_1.5fr_1.6fr_auto_6rem] items-center gap-3 px-3 py-1.5"
                    >
                      <ZonePreview ring={z.ring} category={z.category} />
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium">{z.name}</div>
                        <div className="truncate text-[10px] tabular-nums text-muted-foreground">
                          {z.id} · {z.code}
                        </div>
                      </div>
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-1 ring-inset ring-white/15"
                          style={{
                            background: `linear-gradient(135deg, hsl(${z.user.hue} 70% 55%), hsl(${(z.user.hue + 40) % 360} 65% 42%))`,
                          }}
                        >
                          {z.user.initials}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium">{z.user.name}</div>
                          <div className="truncate text-[10px] text-muted-foreground">
                            {z.user.role}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${st.cls}`}
                      >
                        <span className="size-1.5 rounded-full" style={{ background: st.dot }} />
                        {st.label}
                      </span>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-muted-foreground">Couv.</span>
                          <span className="font-semibold tabular-nums">{z.coverage}%</span>
                        </div>
                        <Progress value={z.coverage} className="h-1" />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div
              data-success
              className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2"
            >
              <Check className="size-4 shrink-0 text-emerald-500" />
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Couche « zones_dijon » ajoutée — {IMPORT_FEATURES} zones, reprojetées et indexées,
                prêtes pour la vue tabulaire.
              </span>
            </div>
          </div>
        </div>

        {/* bottom — supported formats + capabilities */}
        <div className="mt-5 grid grid-cols-1 gap-4 border-t pt-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70 font-medium mb-2">
              Formats supportés
            </div>
            <div className="flex flex-wrap gap-2">
              {FORMATS.map((f) => (
                <div
                  key={f.label}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-card/50 px-2.5 py-1"
                >
                  <f.icon className="size-3.5 text-fuchsia-500" />
                  <span className="text-xs font-medium">{f.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-[10px]">
              Reprojection auto
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              Jointure attributaire
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              Style par catégorie
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              Partage équipe
            </Badge>
          </div>
        </div>
      </div>
    </ScrollArea>
  )
}
