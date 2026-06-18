import { useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { useTourStore } from '@/store/tour-store'
import { STEPS } from '@/tour/steps'
import { useTechStackReveal } from '@/hooks/animations/useTechStackReveal'
// Logos de marque monochromes (data-URI via ?inline) recolorés via CSS mask —
// cf. le pattern LogoMask d'EcosystemBridge.
import dockerLogo from '@/assets/logos/docker.svg?inline'
import postgresLogo from '@/assets/logos/postgresql.svg?inline'
import qgisLogo from '@/assets/logos/qgis.svg?inline'
import nodeLogo from '@/assets/logos/nodedotjs.svg?inline'
import redisLogo from '@/assets/logos/redis.svg?inline'
import maplibreLogo from '@/assets/logos/maplibre.svg?inline'
import reactLogo from '@/assets/logos/react.svg?inline'
import dvcLogoFull from '@/assets/dvc_full.svg?inline'

// Logo monochrome recoloré via `currentColor` : seul l'alpha du SVG sert de
// masque. `style` permet d'imposer une couleur.
function LogoMask({
  src,
  className,
  style,
}: {
  src: string
  className?: string
  style?: CSSProperties
}) {
  return (
    <span
      aria-hidden
      className={className}
      style={{
        ...style,
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

// `role` = libellé court de la face avant ; `pitch` = argumentaire « pourquoi ce
// choix » (orienté bénéfice client) révélé dans le panneau 2D au clic. JSX pour
// mettre en gras les passages clés (cf. helper B).
type Stage = {
  id: string
  name: string
  role: string
  pitch: ReactNode
  logo: string
  brand: string
}

// Emphase des passages clés d'un argumentaire (gras + couleur pleine sur le texte
// atténué du panneau).
const B = ({ children }: { children: ReactNode }) => (
  <strong className="font-semibold text-foreground">{children}</strong>
)

// Le récit du step : « de la donnée à l'écran ». QGIS est en amont, sur le poste
// SIG (hors conteneur). Le reste tourne dans Docker. L'ordre des rangées =
// empilement du bas (donnée) vers le haut (écran) ; la rangée du haut met le duo
// front (React qui pilote MapLibre) côte à côte sur deux colonnes.
const QGIS: Stage = {
  id: 'qgis',
  name: 'QGIS',
  role: 'Édition & préparation des données',
  pitch: (
    <>
      Vos données géographiques sont <B>vérifiées et fiabilisées</B> en amont : des{' '}
      <B>cartes exactes</B>, sans erreurs de positionnement ni surprises à l’affichage.
    </>
  ),
  logo: qgisLogo,
  brand: '#589632',
}
const PG: Stage = {
  id: 'data',
  name: 'PostgreSQL · PostGIS',
  role: 'Stocke & interroge la géométrie',
  pitch: (
    <>
      <B>Vos données restent les vôtres</B> : stockées en toute sécurité, sauvegardées et
      hébergeables chez vous — <B>aucune dépendance</B> à un fournisseur tiers.
    </>
  ),
  logo: postgresLogo,
  brand: '#2F6CA6',
}
const NODE: Stage = {
  id: 'node',
  name: 'Node.js',
  role: 'API & logique métier',
  pitch: (
    <>
      <B>Vos règles métier sont appliquées à la lettre</B> : vos processus, vos calculs et vos
      automatisations fonctionnent <B>exactement comme votre activité l’exige</B>.
    </>
  ),
  logo: nodeLogo,
  brand: '#5FA04E',
}
const REDIS: Stage = {
  id: 'redis',
  name: 'Redis',
  role: 'Cache & diffusion temps réel',
  pitch: (
    <>
      Une application qui reste <B>rapide et réactive</B>, même à forte affluence : vos équipes
      voient les mises à jour <B>en temps réel</B>, sans attente.
    </>
  ),
  logo: redisLogo,
  brand: '#D82C20',
}
const REACT: Stage = {
  id: 'react',
  name: 'React',
  role: 'Interface utilisateur',
  pitch: (
    <>
      Une interface <B>claire et agréable</B>, prise en main en quelques minutes par vos équipes, et
      qui <B>évolue facilement</B> au rythme de vos besoins.
    </>
  ),
  logo: reactLogo,
  brand: '#58C4DC',
}
const MAPLIBRE: Stage = {
  id: 'maplibre',
  name: 'MapLibre',
  role: 'Rendu de la carte — à l’écran',
  pitch: (
    <>
      Des cartes <B>fluides et réactives</B>, <B>sans frais de licence</B> ni dépendance à Google ou
      Mapbox : vous gardez la main et <B>maîtrisez vos coûts</B>.
    </>
  ),
  logo: maplibreLogo,
  brand: '#5A6CF0',
}

// Rangées du meuble Docker, du BAS (donnée) vers le HAUT (écran). Une rangée à 2
// éléments → 2 colonnes ; une rangée à 1 élément → tiroir pleine largeur.
const ROWS: Stage[][] = [[PG], [NODE], [REDIS], [REACT, MAPLIBRE]]

// DaVikingCode (= nous) : panneau affiché au survol du logo gravé au dos. Jaune
// de marque pour l'accent ; appel à l'action vers notre site.
const DVC_BRAND = '#FFEB04'
const DVC_SITE = 'https://davikingcode.com/'
const DVC_PITCH = (
  <>
    Une <B>solution cartographique sur mesure</B> vous intéresse ? Découvrez nos réalisations sur{' '}
    <B>davikingcode.com</B>, ou écrivez-nous via le <B>bouton de contact, en bas à droite</B>.
  </>
)

// ── Géométrie : MEUBLE À CASIERS multi-colonnes (px, repère de .stack) ───────
// Chaque techno est un TIROIR plein étiqueté logé dans sa case ; au clic il
// coulisse vers l'avant (+Y, face ouverte). QGIS est un mini-casier détaché,
// sous le meuble (hors conteneur). Axe Z = empilement (vertical à l'écran).
const W = 365 // largeur intérieure du meuble (axe X)
const D = 116 // profondeur tiroir (axe Y)
const DRAWER_T = 60 // épaisseur tiroir (axe Z) — ≈ hauteur de case → posé, pas flottant
const CELL_T = 62 // hauteur intérieure d'une case (tiroir + jeu)
const SHELF_T = 7 // épaisseur d'une étagère / séparation
const COL_GAP = 6 // jeu entre deux colonnes d'une même rangée — serré → tiroirs + larges
const STEP = CELL_T + SHELF_T // pas centre-à-centre des rangées
const N_ROWS = ROWS.length // rangées dans le meuble Docker
// Hauteur totale = N_ROWS cases + (N_ROWS+1) étagères (bas, séparations, haut).
const STACK_H = N_ROWS * CELL_T + (N_ROWS + 1) * SHELF_T
const STACK_BASE = -STACK_H / 2 // meuble centré sur Z=0
// Tiroir POSÉ au fond de sa case (sur l'étagère du dessous), pas centré : sinon
// il a l'air de flotter. Le jeu (CELL_T - DRAWER_T) reste au-dessus du tiroir.
const DRAWER_INSET = 0
// Base Z (intérieure) de la case de la rangée r (0..N-1, bas→haut), centre Z de
// la rangée, et base Z du tiroir posé au fond de la case.
const cellBaseZ = (r: number) => STACK_BASE + SHELF_T + r * STEP
const rowMidZ = (r: number) => cellBaseZ(r) + CELL_T / 2
const drawerBaseZ = (r: number) => cellBaseZ(r) + DRAWER_INSET

// QGIS : mini-casier détaché sous le meuble.
const QGIS_GAP = 18
const QGIS_H = CELL_T + 2 * SHELF_T
const QGIS_TOP = STACK_BASE - QGIS_GAP
const QGIS_BASE = QGIS_TOP - QGIS_H
const QGIS_MID = (QGIS_BASE + QGIS_TOP) / 2
const QGIS_DRAWER_BASE = QGIS_BASE + SHELF_T + DRAWER_INSET

// Cadre du meuble : à peine plus grand que les tiroirs (boîte serrée, fermée,
// sans bords qui dépassent ; juste un léger jeu pour le coulissement).
const FRAME_W = W
const FRAME_D = D + 4

// Marge latérale : les tiroirs sont légèrement en retrait des parois du meuble
// (sinon leurs arêtes affleurent/débordent des étagères).
const DRAWER_PAD = 5
// Layout horizontal d'une colonne c parmi `cols` (largeur + décalage X), dans la
// largeur utile (W moins les marges latérales).
function colLayout(cols: number, c: number) {
  const inner = W - 2 * DRAWER_PAD
  if (cols === 1) return { w: inner, xoff: 0, narrow: false }
  const w = (inner - COL_GAP) / 2
  const xoff = -inner / 2 + w / 2 + c * (w + COL_GAP)
  return { w, xoff, narrow: true }
}

// Mélange sombre : approfondit la teinte de marque (tiroir « plein », opaque).
const DARK = '#0b0b10'
const tint = (hex: string, pct: number) => `color-mix(in srgb, ${hex} ${pct}%, ${DARK})`

// Cadre en VERRE translucide (frosted) : parois blanches semi-transparentes +
// backdrop-blur (cf. PANEL_BLUR appliqué au rendu). Les tiroirs restent pleins.
const PANEL_BACK = 'rgba(255,255,255,0.05)'
const PANEL_SIDE = 'rgba(255,255,255,0.08)'
const PANEL_CAP = 'rgba(255,255,255,0.10)'
const PANEL_SHELF = 'rgba(255,255,255,0.12)'
const PANEL_BLUR = 'blur(7px)'
const EDGE = 'rgba(255,255,255,0.5)' // arêtes / contour du casier (blanc neutre)

// Plateau graticule (signature SIG) : franc écart sous le meuble → l'armoire
// (meuble + casier QGIS) FLOTTE au-dessus du plateau, ne lui est pas collée.
const GROUND_Z = QGIS_BASE - 72
const GROUND_R = 200

type Face = { w: number; h: number; t: string; bg: string }

// Faces opaques d'un caisson (dos + 2 côtés + dessus + dessous), face avant
// OMISE (case ouverte). midZ = centre Z, h = hauteur totale (axe Z).
function boxShell(midZ: number, h: number): Face[] {
  return [
    // dos (-Y)
    {
      w: FRAME_W,
      h,
      t: `translate3d(0px, ${-FRAME_D / 2}px, ${midZ}px) rotateX(90deg)`,
      bg: PANEL_BACK,
    },
    // côté gauche (-X)
    {
      w: h,
      h: FRAME_D,
      t: `translate3d(${-FRAME_W / 2}px, 0px, ${midZ}px) rotateY(90deg)`,
      bg: PANEL_SIDE,
    },
    // côté droit (+X)
    {
      w: h,
      h: FRAME_D,
      t: `translate3d(${FRAME_W / 2}px, 0px, ${midZ}px) rotateY(90deg)`,
      bg: PANEL_SIDE,
    },
    // dessus (+Z)
    { w: FRAME_W, h: FRAME_D, t: `translate3d(0px, 0px, ${midZ + h / 2}px)`, bg: PANEL_CAP },
    // dessous (-Z)
    { w: FRAME_W, h: FRAME_D, t: `translate3d(0px, 0px, ${midZ - h / 2}px)`, bg: PANEL_CAP },
  ]
}

// Un tiroir plein, opaque : libellé sur la face AVANT (+Y, vers la case ouverte),
// 5 faces pleines teintées marque. Cliquable (piloté par le hook via [data-layer]).
function Drawer({
  stage,
  ordinal,
  zb,
  w,
  xoff,
  narrow,
}: {
  stage: Stage
  ordinal: number
  zb: number
  w: number
  xoff: number
  narrow: boolean
}) {
  const midZ = DRAWER_T / 2 // repère local du tiroir (translate3d(xoff,0,zb))
  const wall = tint(stage.brand, 74)
  const cap = tint(stage.brand, 62)
  const labelBg = tint(stage.brand, 88)

  const plain: Face[] = [
    { w, h: DRAWER_T, t: `translate3d(0px, ${-D / 2}px, ${midZ}px) rotateX(90deg)`, bg: wall },
    { w: DRAWER_T, h: D, t: `translate3d(${-w / 2}px, 0px, ${midZ}px) rotateY(90deg)`, bg: wall },
    { w: DRAWER_T, h: D, t: `translate3d(${w / 2}px, 0px, ${midZ}px) rotateY(90deg)`, bg: wall },
    { w, h: D, t: `translate3d(0px, 0px, ${DRAWER_T}px)`, bg: cap },
    { w, h: D, t: `translate3d(0px, 0px, 0px)`, bg: cap },
  ]

  return (
    <div
      data-layer
      data-flow={ordinal}
      data-z={zb}
      className="absolute inset-0 m-auto"
      style={{
        width: w,
        height: D,
        transform: `translate3d(${xoff}px, 0px, ${zb}px)`,
        transformStyle: 'preserve-3d',
        // ⚠️ NE PAS animer l'opacité de ce conteneur ni la mettre dans
        // will-change : cela aplatirait sa 3D (faces rotées écrasées en lignes).
        // Cf. l'entrée (translateZ + visibility) et le clic (tiroir y) du hook.
        willChange: 'transform',
      }}
    >
      {plain.map((f, i) => (
        <div
          key={`f-${i}`}
          className="absolute inset-0 m-auto"
          style={{
            width: f.w,
            height: f.h,
            transform: f.t,
            background: f.bg,
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.10)',
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* Face AVANT (+Y) — libellé + zone cliquable du tiroir. */}
      <div
        data-face
        className={`absolute inset-0 m-auto flex cursor-pointer items-center overflow-hidden ${narrow ? 'gap-2 px-3' : 'gap-3 px-4'}`}
        style={{
          width: w,
          height: DRAWER_T,
          transform: `translate3d(0px, ${D / 2}px, ${midZ}px) rotateX(-90deg)`,
          background: labelBg,
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.22), 0 0 22px -10px ${stage.brand}`,
          pointerEvents: 'auto',
        }}
      >
        {/* Halo de marque — intensifié quand le tiroir est sorti ([data-glow]). */}
        <span
          data-glow
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0"
          style={{ boxShadow: `inset 0 0 24px -2px ${stage.brand}, 0 0 30px -4px ${stage.brand}` }}
        />
        {/* Poignée de tiroir (signal d'ouverture) — masquée si peu de place. */}
        {!narrow && (
          <span
            aria-hidden
            className="pointer-events-none absolute right-3 top-1/2 h-1 w-7 -translate-y-1/2 rounded-full"
            style={{ background: 'rgba(255,255,255,0.45)' }}
          />
        )}
        <span
          className={`grid shrink-0 place-items-center rounded-lg text-white ${narrow ? 'size-8' : 'size-9'}`}
          style={{
            background: 'rgba(255,255,255,0.16)',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.22)',
          }}
        >
          <LogoMask src={stage.logo} className={narrow ? 'size-[17px]' : 'size-[19px]'} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold leading-tight text-white">
            {stage.name}
          </span>
          <span
            className={`mt-0.5 block text-[10px] leading-snug text-white/75 ${narrow ? 'truncate' : ''}`}
          >
            {stage.role}
          </span>
        </span>
      </div>
    </div>
  )
}

export function TechStackDiagram() {
  const currentStep = useTourStore((s) => s.currentStep)
  const step = STEPS[currentStep]

  const rootRef = useRef<HTMLDivElement>(null)

  // Ordinal du tiroir ouvert (remonté par le hook), ou null si tout fermé.
  // Pilote le panneau 2D fixe du bas. Accordéon : un seul à la fois.
  const [openOrdinal, setOpenOrdinal] = useState<number | null>(null)
  // Survol du logo DaVikingCode (au dos) : referme le tiroir ouvert et affiche
  // le panneau DVC dans le slot du bas (priorité sur le panneau de tiroir).
  const [dvcHover, setDvcHover] = useState(false)

  const techApi = useTechStackReveal(rootRef, setOpenOrdinal)

  // Tiroirs : QGIS (détaché) + les rangées du meuble. `ordinal` = ordre global
  // (entrée/animation), data-z porté par chaque tiroir.
  const drawers: {
    stage: Stage
    ordinal: number
    zb: number
    w: number
    xoff: number
    narrow: boolean
  }[] = [{ stage: QGIS, ordinal: 0, zb: QGIS_DRAWER_BASE, w: W, xoff: 0, narrow: false }]
  let ord = 1
  ROWS.forEach((row, r) => {
    const zb = drawerBaseZ(r)
    row.forEach((stage, c) => {
      const { w, xoff, narrow } = colLayout(row.length, c)
      drawers.push({ stage, ordinal: ord++, zb, w, xoff, narrow })
    })
  })

  // Stage du tiroir ouvert (panneau 2D du bas), via l'ordinal remonté par le hook.
  const openStage =
    openOrdinal == null ? null : drawers.find((d) => d.ordinal === openOrdinal)?.stage

  // ── Cadre du meuble Docker (faces opaques, face avant OMISE = ouvert) ──────
  const frame: Face[] = boxShell(0, STACK_H)
  // Étagères horizontales entre les rangées (plan XY).
  const shelves: Face[] = Array.from({ length: N_ROWS - 1 }, (_, k) => {
    const j = k + 1
    const z = STACK_BASE + j * STEP + SHELF_T / 2
    return { w: FRAME_W, h: FRAME_D, t: `translate3d(0px, 0px, ${z}px)`, bg: PANEL_SHELF }
  })
  // Séparateur vertical (plan YZ) pour chaque rangée à 2 colonnes.
  const dividers: Face[] = ROWS.flatMap((row, r) =>
    row.length === 2
      ? [
          {
            w: CELL_T,
            h: FRAME_D,
            t: `translate3d(0px, 0px, ${rowMidZ(r)}px) rotateY(90deg)`,
            bg: PANEL_SHELF,
          },
        ]
      : [],
  )
  // Mini-casier QGIS (détaché, sous le meuble).
  const qgisFrame: Face[] = boxShell(QGIS_MID, QGIS_H)

  // Contour blanc : 4 montants verticaux + rails horizontaux à l'avant de chaque
  // séparation + montant vertical avant pour chaque rangée à 2 colonnes.
  const posts = [
    { x: -FRAME_W / 2, y: -FRAME_D / 2 },
    { x: FRAME_W / 2, y: -FRAME_D / 2 },
    { x: FRAME_W / 2, y: FRAME_D / 2 },
    { x: -FRAME_W / 2, y: FRAME_D / 2 },
  ]
  // Rails horizontaux : bords haut/bas EXACTEMENT au sommet/fond de la boîte
  // (pas en retrait → pas de cap qui dépasse), + une ligne par séparation interne.
  const railZ = [
    STACK_BASE,
    ...Array.from({ length: N_ROWS - 1 }, (_, k) => STACK_BASE + (k + 1) * STEP + SHELF_T / 2),
    STACK_BASE + STACK_H,
  ]
  const colRailZ = ROWS.flatMap((row, r) => (row.length === 2 ? [rowMidZ(r)] : []))

  const ticks = Array.from({ length: 8 }, (_, i) => (i * 360) / 8)

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 flex items-center justify-center pointer-events-none"
      style={{ zIndex: 100050 }}
    >
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        style={{ pointerEvents: 'auto' }}
      />

      <Card
        id="techstack-diagram"
        className="relative flex flex-col gap-0 overflow-hidden bg-card/95 py-0 shadow-2xl backdrop-blur-md pointer-events-auto w-full sm:w-[1040px] max-w-[96vw] max-h-[92vh]"
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

        {/* Body — scène 3D (CSS preserve-3d, animée par GSAP). */}
        <div className="relative flex-1 overflow-hidden px-4 pt-2 sm:px-8">
          <div
            data-scene
            className="relative h-[480px] w-full touch-none select-none sm:h-[580px]"
            style={{ perspective: '2400px', perspectiveOrigin: '50% 42%', pointerEvents: 'auto' }}
          >
            {/* float (bob ambiant) → tilt (parallax/orbite) → stack (angle de repos) */}
            <div
              data-float
              className="absolute inset-0 flex items-center justify-center"
              style={{ transformStyle: 'preserve-3d' }}
            >
              {/* Décalage vertical : recentre l'assemblage dans la scène. Le centre
                  de masse visuel (QGIS + graticule sous le meuble) tombe sous l'origine
                  géométrique de .stack, donc on remonte légèrement pour compenser. Sur
                  .tilt → n'interfère ni avec le bob (.float) ni l'orbite (rotationX/Y). */}
              <div
                data-tilt
                style={{ transformStyle: 'preserve-3d', transform: 'translateY(-80px)' }}
              >
                <div
                  data-stack
                  className="relative"
                  style={{
                    width: W,
                    height: D,
                    transformStyle: 'preserve-3d',
                    transform: 'rotateX(74deg) rotateZ(-20deg)',
                    willChange: 'transform',
                  }}
                >
                  {/* Plateau graticule (signature SIG), tourne lentement. */}
                  <svg
                    data-graticule
                    width={GROUND_R * 2}
                    height={GROUND_R * 2}
                    viewBox={`0 0 ${GROUND_R * 2} ${GROUND_R * 2}`}
                    fill="none"
                    className="absolute inset-0 m-auto opacity-0"
                    style={{ transform: `translateZ(${GROUND_Z}px)`, pointerEvents: 'none' }}
                  >
                    <g stroke="rgba(255,255,255,0.12)">
                      <circle cx={GROUND_R} cy={GROUND_R} r={GROUND_R - 6} strokeDasharray="2 9" />
                      <circle
                        cx={GROUND_R}
                        cy={GROUND_R}
                        r={(GROUND_R - 6) * 0.62}
                        strokeDasharray="2 9"
                      />
                      {ticks.map((deg) => {
                        const rad = (deg * Math.PI) / 180
                        const r = GROUND_R - 6
                        return (
                          <line
                            key={deg}
                            x1={GROUND_R + Math.cos(rad) * r}
                            y1={GROUND_R + Math.sin(rad) * r}
                            x2={GROUND_R + Math.cos(rad) * (r - 11)}
                            y2={GROUND_R + Math.sin(rad) * (r - 11)}
                          />
                        )
                      })}
                    </g>
                  </svg>

                  {/* Cadre + étagères + séparateurs + mini-casier QGIS (opaques).
                      Rendus AVANT les tiroirs (le dos opaque ferme le fond). */}
                  {[...frame, ...shelves, ...dividers, ...qgisFrame].map((f, i) => (
                    <div
                      key={`panel-${i}`}
                      data-docker
                      className="absolute inset-0 m-auto"
                      style={{
                        width: f.w,
                        height: f.h,
                        transform: f.t,
                        background: f.bg,
                        backdropFilter: PANEL_BLUR,
                        WebkitBackdropFilter: PANEL_BLUR,
                        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)',
                        pointerEvents: 'none',
                      }}
                    />
                  ))}

                  {/* Logo DaVikingCode gravé au DOS du meuble (LogoMask monochrome,
                      cf. le pattern en tête de fichier), orienté -Y : net et lisible
                      quand la rotation d'entrée (axe vertical) ou le drag expose le dos.
                      backface-visibility:hidden → masqué ET non hit-testé quand on voit
                      la FACE AVANT (sinon sa projection capte le survol À TRAVERS les
                      tiroirs). Visible/cliquable seulement dos face caméra. */}
                  <div
                    data-docker
                    className="absolute inset-0 m-auto grid place-items-center"
                    style={{
                      width: FRAME_W,
                      height: STACK_H,
                      transform: `translate3d(0px, ${-FRAME_D / 2 - 0.5}px, 0px) rotateX(-90deg) rotateY(180deg)`,
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      pointerEvents: 'none',
                    }}
                  >
                    <a
                      href="https://davikingcode.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="DaVikingCode"
                      className="cursor-pointer"
                      style={{ pointerEvents: 'auto' }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onPointerEnter={() => {
                        techApi.current.closeAll()
                        setDvcHover(true)
                      }}
                      onPointerLeave={() => setDvcHover(false)}
                    >
                      <LogoMask
                        src={dvcLogoFull}
                        className="block h-[150px] w-[244px] text-white/80"
                        style={{ filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.18))' }}
                      />
                    </a>
                  </div>

                  {/* Tiroirs (QGIS + technos Docker, disposés en grille). */}
                  {drawers.map((d) => (
                    <Drawer
                      key={d.stage.id}
                      stage={d.stage}
                      ordinal={d.ordinal}
                      zb={d.zb}
                      w={d.w}
                      xoff={d.xoff}
                      narrow={d.narrow}
                    />
                  ))}

                  {/* Contour blanc : montants verticaux + rails horizontaux + rails
                      verticaux des rangées à 2 colonnes. */}
                  {posts.map((c, i) => (
                    <div
                      key={`post-${i}`}
                      data-docker
                      className="absolute inset-0 m-auto"
                      style={{
                        width: 1.5,
                        height: STACK_H,
                        transform: `translate3d(${c.x}px, ${c.y}px, 0px) rotateX(90deg)`,
                        background: EDGE,
                        pointerEvents: 'none',
                      }}
                    />
                  ))}
                  {railZ.map((z, i) => (
                    <div
                      key={`rail-${i}`}
                      data-docker
                      className="absolute inset-0 m-auto"
                      style={{
                        width: FRAME_W,
                        height: 1.5,
                        transform: `translate3d(0px, ${FRAME_D / 2}px, ${z}px) rotateX(90deg)`,
                        background: EDGE,
                        pointerEvents: 'none',
                      }}
                    />
                  ))}
                  {colRailZ.map((z, i) => (
                    <div
                      key={`colrail-${i}`}
                      data-docker
                      className="absolute inset-0 m-auto"
                      style={{
                        width: 1.5,
                        height: CELL_T,
                        transform: `translate3d(0px, ${FRAME_D / 2}px, ${z}px) rotateX(90deg)`,
                        background: EDGE,
                        pointerEvents: 'none',
                      }}
                    />
                  ))}

                  {/* « Docker » imprimé sur le DESSUS du meuble : sans fond, blanc
                      léger pour se fondre dans le couvercle. Plus gros que les
                      libellés de tiroir (c'est le nom du conteneur). */}
                  <div
                    data-docker
                    className="absolute inset-0 m-auto flex w-max items-center gap-2.5"
                    style={{
                      transform: `translate3d(0px, 0px, ${STACK_BASE + STACK_H + 0.5}px)`,
                      pointerEvents: 'none',
                    }}
                  >
                    <LogoMask src={dockerLogo} className="size-7 text-white/85" />
                    <span className="text-[22px] font-semibold tracking-tight text-white/85">
                      Docker
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Slot fixe en bas : panneau DVC au survol du logo (priorité), sinon le
              panneau 2D « pourquoi » du tiroir ouvert, sinon le hint « Docker ».
              Hors scène 3D → lisible et stable malgré l'orbite. Clé pour rejouer l'anim. */}
          {dvcHover ? (
            <a
              key="dvc"
              href={DVC_SITE}
              target="_blank"
              rel="noopener noreferrer"
              onPointerEnter={() => setDvcHover(true)}
              onPointerLeave={() => setDvcHover(false)}
              className="absolute inset-x-4 bottom-3 flex items-center gap-4 rounded-xl border bg-card/90 px-4 py-3 text-left no-underline shadow-lg backdrop-blur-md transition-colors hover:bg-card animate-in fade-in slide-in-from-bottom-2 duration-300 sm:inset-x-8"
              style={{ borderColor: `color-mix(in srgb, ${DVC_BRAND} 55%, transparent)` }}
            >
              {/* Logo en couleurs d'origine (blanc + jaune) → <img>, pas LogoMask. */}
              <img src={dvcLogoFull} alt="DaVikingCode" className="block h-10 w-auto shrink-0" />
              <span className="min-w-0 flex-1 text-[12px] leading-snug text-muted-foreground">
                {DVC_PITCH}
              </span>
            </a>
          ) : openStage ? (
            <div
              key={openStage.id}
              className="absolute inset-x-4 bottom-3 flex items-start gap-3 rounded-xl border bg-card/90 px-4 py-3 text-left shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-300 sm:inset-x-8"
              style={{ borderColor: `color-mix(in srgb, ${openStage.brand} 45%, transparent)` }}
            >
              <span
                className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg text-white"
                style={{
                  backgroundColor: openStage.brand,
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.22)',
                }}
              >
                <LogoMask src={openStage.logo} className="size-[19px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold leading-tight text-foreground">
                  {openStage.name}
                </span>
                <span className="mt-1 block text-[12px] leading-snug text-muted-foreground">
                  {openStage.pitch}
                </span>
              </span>
            </div>
          ) : (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-center gap-2 text-[11px] text-muted-foreground/70">
              <LogoMask src={dockerLogo} className="size-3.5 text-muted-foreground/70" />
              Conteneurisé avec Docker — <B>cliquez un tiroir pour l’ouvrir</B>, ou faites pivoter
              le meuble d’un glissé
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
