import type { CustomLayerInterface, CustomRenderMethodInput, Map as MLMap } from 'maplibre-gl'
import { MercatorCoordinate } from 'maplibre-gl'
import type { Feature, LineString } from 'geojson'
import gsap from 'gsap'
import { TRAFFIC_CORRIDORS, type Hotspot } from '@/data/sample-traffic'

// -----------------------------------------------------------------------------
// Trafic — couche WebGL personnalisée (CustomLayerInterface).
//
// Posée à l'étape « Bâtiments 3D appliqués », elle matérialise la densité du
// trafic le long de plusieurs corridors par des bandes de lumière néon parcourues
// de comètes lissées (montée douce + traînée) qui défilent, colorées selon la
// congestion : vert (fluide) → orange → rouge (bouchon).
//
// Rendu « néon » : chaque bande est un ruban large où le fragment shader sculpte
// un CŒUR fin sur-brillant + un HALO doux en falloff gaussien (fake bloom). Pas de
// blend additif ni de passe FBO : le basemap Positron est clair (l'additif y délave
// vers le blanc) et un FBO casserait l'occlusion par les tours. Le fake bloom
// in-shader garde le depth test partagé → les tours du premier plan occultent le
// flux (renderingMode '3d'), et tient 60 fps sur une seule couche / un seul
// programme GLSL.
//
// Couleur de congestion : la densité n'est PAS échantillonnée par sommet (les
// corridors n'ont qu'une quinzaine de points espacés → les foyers gaussiens étroits
// se rendaient en pics triangulaires linéaires = couleur « segmentée »). À la place,
// on passe la position normalisée le long du corridor (a_t, interpolée — exacte sur
// un segment droit) et on ÉVALUE la congestion PAR PIXEL dans le fragment shader à
// partir des foyers (uniforms u_hotspots) → gradient continu et lisse, indépendant
// du nombre de sommets.
//
// Entrée en scène « power-on » (GSAP) : un front de charge remonte chaque corridor
// (uniform u_charge 0→1) en y déposant un flash d'allumage, les corridors étant
// décalés (cascade) ; une fois chargé, le flux permanent de comètes prend le relais.
//
// Largeur exprimée en mètres-monde : les décalages perpendiculaires sont figés une
// fois dans le buffer (unités mercator), la bande grandit donc avec le zoom comme
// une vraie route. Bandes légèrement surélevées (LIFT_M) pour éviter le z-fighting
// au sol. Première (et seule) couche GL custom du dépôt.
// -----------------------------------------------------------------------------

const LAYER_ID = 'gp-traffic-flow'

// --- Réglages visuels (à doser librement) -----------------------------------
const CORE_WIDTH_M = 8.28 // largeur du cœur lumineux (la « route »), en mètres-monde (→ CORE_FRAC 0.23)
const HALF_M = 18 // demi-largeur totale du ruban = portée du halo (glow), en mètres
const LIFT_M = 6 // altitude de la bande (évite le z-fighting au sol)
const PULSE_SPACING_M = 400 // distance entre deux comètes (en trafic fluide), en mètres
const FLOW_SPEED_MPS = 80 // vitesse de défilement des comètes en fluide
const FLOW_WARP = 2.2 // dans un bouchon les comètes se tassent / ralentissent (×(1+WARP))
// Fraction du cycle pour la montée de la comète (petit = tête plus marquée,
// traînée d'autant plus longue ; 0.5 = bosse large et douce). Pulse rise·fall
// C1-continu → aucun bord dur.
const COMET_RISE = 0.5
// Amplitude de l'éclaircissement de COULEUR au passage d'une crête. Réglé à 0 :
// la couleur reste un dégradé pur (le flux ne se lit que via l'opacité ci-dessous)
// → aucune impression de pointillés.
const FLOW_DEPTH = 0
const JAM_PULSE_AMP = 0.15 // amplitude de la « respiration » d'alerte des foyers
const JAM_PULSE_SPEED = 3.0 // pulsation des foyers (rad/s, ~0.5 Hz)
const GLOW_K = 4.0 // raideur du halo (plus grand = halo plus serré autour du cœur)
const HALO_A = 0.5 // opacité max du halo (glow)
const CORE_BASE_A = 1 // opacité du cœur hors comète
const COMET_BOOST_A = 0.36 // opacité ajoutée au cœur au passage d'une crête
const CHARGE_EDGE = 0.06 // douceur du front d'allumage (fraction du corridor)
const FRONT_W = 0.05 // largeur du flash lumineux au front d'allumage
const REVEAL_DELAY_S = 4.2 // attendre l'atterrissage caméra (≈ pan.duration)
const REVEAL_DUR_S = 0.5 // fondu maître d'apparition
const CHARGE_DUR_S = 1.6 // durée du balayage « power-on » d'un corridor
const CHARGE_STAGGER = 0.18 // décalage d'allumage entre corridors (cascade)

// Nombre max de foyers de congestion par corridor (taille du tableau uniform GLSL).
const MAX_HOTSPOTS = 8

// Pas de ré-échantillonnage du tracé (mètres). Les corridors n'ont qu'une quinzaine
// de points espacés de ~180 m : les quads de la triangle-strip sont alors longs, et
// leur diagonale (chaque quad = 2 triangles) montre une cassure visible dans toute
// fonction non-linéaire (gaussienne de congestion, cœur brillant) → « ligne » qui
// coupe les couleurs + liseré blanc. On densifie à pas court → quads minuscules,
// diagonale invisible, t/débit finement interpolés.
const RESAMPLE_STEP_M = 12

// Cœur exprimé en fraction de la demi-largeur du ruban (pour le shader).
const CORE_FRAC = CORE_WIDTH_M / 2 / HALF_M

// Rampe de congestion néon (sRGB 0..1) : fluide → ralenti → bouchon. Saturée pour
// « claquer » sur le fond clair Positron.
const COLOR_FLUID: [number, number, number] = [0.06, 0.8, 0.46] // vert néon
const COLOR_MED: [number, number, number] = [1.0, 0.56, 0.1] // orange néon
const COLOR_JAM: [number, number, number] = [0.96, 0.16, 0.31] // rouge néon

// Trafic fluide hors foyers (plancher de densité).
const BASE_DENSITY = 0.08

// Helper d'injection d'une couleur dans le source GLSL.
const glslVec3 = (c: [number, number, number]) =>
  `vec3(${c[0].toFixed(3)}, ${c[1].toFixed(3)}, ${c[2].toFixed(3)})`

// État d'animation partagé entre les fonctions add/remove et la couche.
// reveal = fondu maître ; charge = position du front « power-on » (0→1).
const flowState = { reveal: 0, charge: 0, reduced: false, startMs: -1 }
let revealTl: gsap.core.Timeline | null = null

// Réglages d'APPARENCE ajustables à chaud : poussés en uniforms à chaque frame
// (aucune recompilation du shader). Le panneau de debug (DEV) écrit dedans ; les
// constantes plus haut servent de valeurs par défaut. NB : largeur / altitude /
// FLOW_WARP ne sont PAS ici (figés dans les buffers → demanderaient un rebuild).
export const flowParams = {
  flowDepth: FLOW_DEPTH,
  cometRise: COMET_RISE,
  coreBaseA: CORE_BASE_A,
  cometBoostA: COMET_BOOST_A,
  haloA: HALO_A,
  glowK: GLOW_K,
  coreFrac: CORE_FRAC,
  jamAmp: JAM_PULSE_AMP,
  spacingM: PULSE_SPACING_M,
  speedMps: FLOW_SPEED_MPS,
}

// Table nom GLSL → valeur live (lue dans flowParams chaque frame). u_freq/u_speed
// sont dérivés de l'espacement. Itérée à l'identique dans onAdd (locations) et
// render (gl.uniform1f) → ajouter un réglage = une seule ligne ici.
const PARAM_UNIFORMS: { name: string; value: () => number }[] = [
  { name: 'u_flowDepth', value: () => flowParams.flowDepth },
  { name: 'u_cometRise', value: () => flowParams.cometRise },
  { name: 'u_coreBaseA', value: () => flowParams.coreBaseA },
  { name: 'u_cometBoostA', value: () => flowParams.cometBoostA },
  { name: 'u_haloA', value: () => flowParams.haloA },
  { name: 'u_glowK', value: () => flowParams.glowK },
  { name: 'u_coreFrac', value: () => flowParams.coreFrac },
  { name: 'u_jamAmp', value: () => flowParams.jamAmp },
  { name: 'u_freq', value: () => 1 / Math.max(1, flowParams.spacingM) },
  { name: 'u_speed', value: () => flowParams.speedMps / Math.max(1, flowParams.spacingM) },
]

const VERT_SRC = `
uniform mat4 u_matrix;
attribute vec2 a_pos;
attribute float a_flow;
attribute float a_side;
attribute float a_t;
varying float v_flow;
varying float v_side;
varying float v_t;
void main() {
  v_flow = a_flow;
  v_side = a_side;
  v_t = a_t;
  // a_pos relatif à l'ancre ; la translation (ancre + altitude) est déjà dans u_matrix.
  gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
}
`

const FRAG_SRC = `
precision highp float;
uniform float u_time;
uniform float u_reveal;
uniform float u_charge;
uniform float u_flowMax;
uniform int u_hotCount;
uniform vec3 u_hotspots[${MAX_HOTSPOTS}];   // par foyer : x=centre, y=demi-largeur, z=intensité (en t∈[0,1])
// Réglages d'apparence ajustables à chaud (cf. flowParams + panneau debug DEV).
uniform float u_flowDepth;   // éclaircissement au passage d'une crête
uniform float u_cometRise;   // forme du pulse (montée courte → longue traînée)
uniform float u_coreBaseA;   // opacité du cœur hors crête
uniform float u_cometBoostA; // opacité ajoutée au cœur sur la crête
uniform float u_haloA;       // opacité max du halo
uniform float u_glowK;       // raideur du halo (grand = halo plus serré)
uniform float u_coreFrac;    // finesse du cœur (fraction de la demi-largeur)
uniform float u_jamAmp;      // amplitude de la respiration des bouchons
uniform float u_freq;        // cycles par mètre (1 / espacement)
uniform float u_speed;       // cycles par seconde (vitesse / espacement)
varying float v_flow;
varying float v_side;
varying float v_t;

// Densité de congestion en t∈[0,1], évaluée PAR PIXEL : maximum de gaussiennes
// centrées sur les foyers (identique au CPU congestionAt). Champ continu → gradient
// lisse, sans dépendre de l'espacement des sommets du corridor.
float congestion(float t) {
  float d = ${BASE_DENSITY.toFixed(3)};
  for (int i = 0; i < ${MAX_HOTSPOTS}; i++) {
    if (i >= u_hotCount) break;
    vec3 h = u_hotspots[i];
    float w = max(h.y, 1e-4);
    float dt = t - h.x;
    d = max(d, h.z * exp(-(dt * dt) / (2.0 * w * w)));
  }
  return min(1.0, d);
}

void main() {
  float d = congestion(v_t);

  // --- Profil radial (largeur) : cœur net + halo doux gaussien (fake bloom). ---
  float s = abs(v_side);
  float core = 1.0 - smoothstep(u_coreFrac * 0.5, u_coreFrac, s);
  float halo = exp(-u_glowK * s * s);

  // --- Flux : comète LISSÉE (montée douce → crête → longue traînée) qui défile
  // le long du corridor. v_flow est une coordonnée « débit » pré-déformée par la
  // densité (bouchon → comètes tassées/ralenties ; fluide → étirées/accélérées).
  // Pulse = rise·fall : deux smoothstep dont valeur ET pente s'annulent au raccord
  // (p:1→0) → C1-continu, AUCUN bord dur (≠ ancien exp(-p)+fract qui recollait une
  // queue noire contre une tête plein-feu = « segment » qui coupait le ruban).
  float p = fract(v_flow * u_freq - u_time * u_speed);
  float rise = smoothstep(0.0, u_cometRise, p);
  float fall = 1.0 - smoothstep(u_cometRise, 1.0, p);
  float comet = rise * fall;                                    // crête ≈ p = COMET_RISE, 0..1 lisse

  // --- Rampe de congestion néon (gradient lisse) : vert → orange → rouge. ---
  // Plages qui se recouvrent (pas de plateau plat) → transition continue.
  vec3 neon = mix(${glslVec3(COLOR_FLUID)}, ${glslVec3(COLOR_MED)}, smoothstep(0.10, 0.55, d));
  neon = mix(neon, ${glslVec3(COLOR_JAM)}, smoothstep(0.45, 0.95, d));

  // Éclaircissement DOUX au passage d'une crête (flux directionnel) : faible
  // amplitude (FLOW_DEPTH) sur un ruban qui reste pleinement allumé entre les
  // crêtes → dégradé lisse qui ondule, plus aucune impression de pointillés.
  vec3 coreCol = clamp(neon * (1.0 + u_flowDepth * comet), 0.0, 1.0);
  vec3 color = mix(neon, coreCol, core);

  // Respiration d'alerte : les foyers (orange/rouge) pulsent doucement en éclat.
  float jam = smoothstep(0.45, 0.85, d);
  color *= 1.0 + u_jamAmp * jam * sin(u_time * ${JAM_PULSE_SPEED.toFixed(3)});

  // --- Power-on : un front de charge remonte le corridor (GSAP u_charge 0→1).
  // En deçà du front : allumé ; au-delà : éteint. Un flash gaussien marque le front.
  float fn = v_flow / max(u_flowMax, 1.0);                       // position « débit » normalisée 0..1
  float lit = 1.0 - smoothstep(u_charge, u_charge + ${CHARGE_EDGE.toFixed(3)}, fn);
  float fd = (fn - u_charge) / ${FRONT_W.toFixed(3)};           // pas de pow() : base négative = indéfini en GLSL
  float front = exp(-fd * fd);
  front *= 1.0 - smoothstep(0.85, 1.0, u_charge);               // le flash s'éteint une fois chargé
  color = clamp(color + front * (0.5 * neon + 0.25), 0.0, 1.0);

  // Les zones denses sont un peu plus opaques → masse de trafic visible.
  float dens = 0.80 + 0.20 * d;

  // --- Alpha (sortie prémultipliée : le canvas MapLibre est en premultiplied alpha).
  float aCore = core * (u_coreBaseA + u_cometBoostA * comet);
  float aHalo = halo * u_haloA * (0.75 + 0.25 * comet);
  float alpha = clamp(aCore + aHalo + front * 0.4, 0.0, 0.96) * dens * lit * u_reveal;
  gl_FragColor = vec4(color * alpha, alpha);
}
`

function compileShader(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  type: number,
  src: string,
): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('[trafficFlow] shader compile failed:', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function createProgram(gl: WebGLRenderingContext | WebGL2RenderingContext): WebGLProgram | null {
  const vert = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC)
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC)
  if (!vert || !frag) return null
  const program = gl.createProgram()
  if (!program) return null
  gl.attachShader(program, vert)
  gl.attachShader(program, frag)
  gl.linkProgram(program)
  gl.deleteShader(vert)
  gl.deleteShader(frag)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('[trafficFlow] program link failed:', gl.getProgramInfoLog(program))
    gl.deleteProgram(program)
    return null
  }
  return program
}

// Densité de trafic en t∈[0,1] : maximum de gaussiennes centrées sur les foyers.
// (Utilisée CPU pour le pré-calcul du « débit » ; le rendu couleur la recalcule en GLSL.)
function congestionAt(t: number, hotspots: Hotspot[]): number {
  let d = BASE_DENSITY
  for (const [c, w, amp] of hotspots) {
    d = Math.max(d, amp * Math.exp(-((t - c) ** 2) / (2 * w * w)))
  }
  return Math.min(1, d)
}

// Distance approximative (mètres) entre deux points lng/lat (équirectangulaire,
// largement suffisant à l'échelle d'un corridor).
function metersBetween(a: [number, number], b: [number, number]): number {
  const lat = ((a[1] + b[1]) / 2) * (Math.PI / 180)
  const dx = (b[0] - a[0]) * Math.cos(lat) * 111320
  const dy = (b[1] - a[1]) * 110540
  return Math.hypot(dx, dy)
}

// Spline Catmull-Rom centripète (α=0.5) sur un segment p1→p2, paramètre t∈[0..1].
// Passe par p1 et p2 ; p0/p3 donnent les tangentes. La paramétrisation centripète
// (tj = ti + dist^α) évite les boucles/dépassements aux virages serrés que produit
// la variante uniforme. Blending de Barry–Goldman.
function catmullRom(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  t: number,
): [number, number] {
  const alpha = 0.5
  const tj = (ti: number, a: [number, number], b: [number, number]): number => {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1])
    return ti + Math.pow(d, alpha)
  }
  const t0 = 0
  const t1 = tj(t0, p0, p1)
  const t2 = tj(t1, p1, p2)
  const t3 = tj(t2, p2, p3)
  // Points dégénérés (coords dupliquées aux bords) → repli linéaire p1→p2.
  if (t1 === t0 || t2 === t1 || t3 === t2) {
    return [p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t]
  }
  const tt = t1 + (t2 - t1) * t
  const lerp = (
    a: [number, number],
    b: [number, number],
    ta: number,
    tb: number,
    x: number,
  ): [number, number] => {
    const f = (x - ta) / (tb - ta)
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
  }
  const a1 = lerp(p0, p1, t0, t1, tt)
  const a2 = lerp(p1, p2, t1, t2, tt)
  const a3 = lerp(p2, p3, t2, t3, tt)
  const b1 = lerp(a1, a2, t0, t2, tt)
  const b2 = lerp(a2, a3, t1, t3, tt)
  return lerp(b1, b2, t1, t2, tt)
}

// Ré-échantillonne un tracé lng/lat à pas ~constant (stepM). Interpole sur une spline
// Catmull-Rom centripète passant par les points d'origine → les coudes sont arrondis
// (pas seulement les bords du ruban via le miter). Produit des sommets denses → la
// triangle-strip n'a plus de longues diagonales et les champs interpolés (t, débit)
// sont lisses.
function densify(coords: [number, number][], stepM: number): [number, number][] {
  if (coords.length < 2) return coords
  const segLen: number[] = []
  let total = 0
  for (let i = 1; i < coords.length; i++) {
    const l = metersBetween(coords[i - 1], coords[i])
    segLen.push(l)
    total += l
  }
  if (total < stepM) return coords
  const nSeg = Math.ceil(total / stepM)
  const out: [number, number][] = []
  for (let k = 0; k <= nSeg; k++) {
    const target = (total * k) / nSeg
    let acc = 0
    let i = 0
    while (i < segLen.length && acc + segLen[i] < target) {
      acc += segLen[i]
      i++
    }
    if (i >= segLen.length) {
      out.push(coords[coords.length - 1])
      break
    }
    const f = segLen[i] > 0 ? (target - acc) / segLen[i] : 0
    const last = coords.length - 1
    const p0 = coords[Math.max(0, i - 1)]
    const p1 = coords[i]
    const p2 = coords[i + 1]
    const p3 = coords[Math.min(last, i + 2)]
    out.push(catmullRom(p0, p1, p2, p3, f))
  }
  return out
}

type Ribbon = {
  data: Float32Array
  anchor: [number, number, number]
  flowMax: number
  hotspots: Float32Array // foyers aplatis (centre, demi-largeur, intensité) ×N
  hotCount: number
}

// Construit la bande (triangle strip) à partir du corridor : pour chaque sommet,
// deux vertices décalés perpendiculairement de ±HALF_M (en unités mercator).
// Attributs entrelacés par vertex : x, y (mercator relatifs à l'ancre), coordonnée
// débit (déformée par la densité, pour l'animation des comètes), côté (-1..+1 sur la
// largeur), t (position normalisée 0..1 le long du corridor, pour la couleur).
// Ordre L0,R0,L1,R1,… → ruban continu.
function buildRibbon(feature: Feature<LineString, { hotspots: Hotspot[] }>): Ribbon {
  // Densifie d'abord le tracé : quads courts → plus de diagonale visible dans la
  // triangle-strip (cf. RESAMPLE_STEP_M).
  const coords = densify(feature.geometry.coordinates as [number, number][], RESAMPLE_STEP_M)
  const hotspots = feature.properties.hotspots
  const mc = coords.map((c) => MercatorCoordinate.fromLngLat(c))
  const pts = mc.map((m) => [m.x, m.y] as [number, number])
  const n = pts.length

  const normalize = (v: [number, number]): [number, number] => {
    const len = Math.hypot(v[0], v[1]) || 1
    return [v[0] / len, v[1] / len]
  }
  const segDir = (a: [number, number], b: [number, number]): [number, number] =>
    normalize([b[0] - a[0], b[1] - a[1]])

  // Normale par sommet : moyenne des normales des segments adjacents (miter simple).
  const normals: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const prev = i > 0 ? segDir(pts[i - 1], pts[i]) : null
    const next = i < n - 1 ? segDir(pts[i], pts[i + 1]) : null
    const dir = prev && next ? normalize([prev[0] + next[0], prev[1] + next[1]]) : (prev ?? next)!
    normals.push([-dir[1], dir[0]])
  }

  // 1ère passe : distance cumulée (mètres) par sommet → fraction le long de l'axe.
  const distAt = [0]
  for (let i = 1; i < n; i++) {
    const segMerc = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    distAt[i] = distAt[i - 1] + segMerc / mc[i].meterInMercatorCoordinateUnits()
  }
  const total = distAt[n - 1] || 1

  // Densité par sommet (uniquement pour la déformation « débit » des comètes).
  // flow = intégrale de (1 + FLOW_WARP·densité) : régulièrement espacés en débit,
  // les comètes se tassent et ralentissent dans les bouchons, s'étirent en fluide.
  const densAt = distAt.map((dd) => congestionAt(dd / total, hotspots))
  const flowAt = [0]
  for (let i = 1; i < n; i++) {
    const segMeters = distAt[i] - distAt[i - 1]
    const dAvg = (densAt[i - 1] + densAt[i]) / 2
    flowAt[i] = flowAt[i - 1] + segMeters * (1 + FLOW_WARP * dAvg)
  }

  // Ancre locale = 1er sommet. On stocke des coordonnées RELATIVES (minuscules) :
  // les coords mercator absolues (~0.515) perdent ~1 m de précision en float32 une
  // fois multipliées par la matrice (énorme au zoom 16) → la bande « nage » quand
  // la caméra tourne. L'ancre (et l'altitude LIFT_M) est réinjectée dans la matrice
  // en double précision côté CPU (cf. composeMatrix). a_pos relatif → z = 0.
  const ax = pts[0][0]
  const ay = pts[0][1]
  const az = LIFT_M * mc[0].meterInMercatorCoordinateUnits()

  // 2ème passe : émission des vertices. Le ruban s'étend sur ±HALF_M (cœur + halo) ;
  // c'est le fragment shader qui sculpte le cœur fin et le halo doux dans cette largeur.
  const verts: number[] = []
  for (let i = 0; i < n; i++) {
    const hw = HALF_M * mc[i].meterInMercatorCoordinateUnits()
    const nx = normals[i][0] * hw
    const ny = normals[i][1] * hw
    const t = distAt[i] / total
    // côté gauche (+normale), puis côté droit (-normale), relatifs à l'ancre
    verts.push(pts[i][0] + nx - ax, pts[i][1] + ny - ay, flowAt[i], 1, t)
    verts.push(pts[i][0] - nx - ax, pts[i][1] - ny - ay, flowAt[i], -1, t)
  }

  // Foyers aplatis (centre, demi-largeur, intensité) pour l'uniform GLSL.
  const hotCount = Math.min(hotspots.length, MAX_HOTSPOTS)
  const flatHot = new Float32Array(hotCount * 3)
  for (let i = 0; i < hotCount; i++) {
    flatHot[i * 3] = hotspots[i][0]
    flatHot[i * 3 + 1] = hotspots[i][1]
    flatHot[i * 3 + 2] = hotspots[i][2]
  }

  return {
    data: new Float32Array(verts),
    anchor: [ax, ay, az],
    flowMax: flowAt[n - 1] || 1,
    hotspots: flatHot,
    hotCount,
  }
}

// u_matrix = mainMatrix · translate(anchor), composé en double précision côté CPU.
// Seule la 4e colonne change (translation) ; les coords relatives minuscules sont
// multipliées sur GPU sans perte → fin du jitter quand la caméra tourne.
function composeMatrix(m: ArrayLike<number>, a: [number, number, number], out: Float32Array) {
  for (let i = 0; i < 12; i++) out[i] = m[i]
  out[12] = a[0] * m[0] + a[1] * m[4] + a[2] * m[8] + m[12]
  out[13] = a[0] * m[1] + a[1] * m[5] + a[2] * m[9] + m[13]
  out[14] = a[0] * m[2] + a[1] * m[6] + a[2] * m[10] + m[14]
  out[15] = a[0] * m[3] + a[1] * m[7] + a[2] * m[11] + m[15]
}

class TrafficFlowLayer implements CustomLayerInterface {
  readonly id = LAYER_ID
  readonly type = 'custom' as const
  readonly renderingMode: '2d' | '3d' = '3d'

  private map: MLMap | null = null
  private program: WebGLProgram | null = null
  private ribbons: {
    buffer: WebGLBuffer
    anchor: [number, number, number]
    count: number
    flowMax: number
    hotspots: Float32Array
    hotCount: number
  }[] = []
  private matrix = new Float32Array(16)
  private aPos = 0
  private aFlow = 0
  private aSide = 0
  private aT = 0
  private uMatrix: WebGLUniformLocation | null = null
  private uTime: WebGLUniformLocation | null = null
  private uReveal: WebGLUniformLocation | null = null
  private uCharge: WebGLUniformLocation | null = null
  private uFlowMax: WebGLUniformLocation | null = null
  private uHotCount: WebGLUniformLocation | null = null
  private uHotspots: WebGLUniformLocation | null = null
  private uParams: (WebGLUniformLocation | null)[] = []

  onAdd(map: MLMap, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.map = map
    const program = createProgram(gl)
    if (!program) return
    this.program = program
    this.aPos = gl.getAttribLocation(program, 'a_pos')
    this.aFlow = gl.getAttribLocation(program, 'a_flow')
    this.aSide = gl.getAttribLocation(program, 'a_side')
    this.aT = gl.getAttribLocation(program, 'a_t')
    this.uMatrix = gl.getUniformLocation(program, 'u_matrix')
    this.uTime = gl.getUniformLocation(program, 'u_time')
    this.uReveal = gl.getUniformLocation(program, 'u_reveal')
    this.uCharge = gl.getUniformLocation(program, 'u_charge')
    this.uFlowMax = gl.getUniformLocation(program, 'u_flowMax')
    this.uHotCount = gl.getUniformLocation(program, 'u_hotCount')
    this.uHotspots = gl.getUniformLocation(program, 'u_hotspots')
    this.uParams = PARAM_UNIFORMS.map((p) => gl.getUniformLocation(program, p.name))

    // Un buffer par corridor (géométrie + ancre + débit max + foyers + nb de vertices).
    this.ribbons = []
    for (const feature of TRAFFIC_CORRIDORS.features) {
      const { data, anchor, flowMax, hotspots, hotCount } = buildRibbon(feature)
      const buffer = gl.createBuffer()
      if (!buffer) continue
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
      this.ribbons.push({ buffer, anchor, count: data.length / 5, flowMax, hotspots, hotCount })
    }
  }

  render(gl: WebGLRenderingContext | WebGL2RenderingContext, args: CustomRenderMethodInput) {
    if (!this.program || this.ribbons.length === 0) return
    if (flowState.reveal <= 0) return // invisible pendant le délai avant apparition
    if (flowState.startMs < 0) flowState.startMs = performance.now()
    const time = flowState.reduced ? 0 : (performance.now() - flowState.startMs) / 1000

    gl.useProgram(this.program)
    gl.uniform1f(this.uTime, time)
    gl.uniform1f(this.uReveal, flowState.reveal)
    // Réglages d'apparence (live depuis flowParams / panneau debug DEV).
    for (let i = 0; i < PARAM_UNIFORMS.length; i++) {
      gl.uniform1f(this.uParams[i], PARAM_UNIFORMS[i].value())
    }

    // Occultées par les bâtiments : depth test partagé (les tours, déjà dans le
    // depth buffer, masquent la bande derrière elles), sans écrire la profondeur.
    // Mélange alpha prémultiplié.
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    gl.depthMask(false)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

    // Allumage en cascade : chaque corridor démarre son balayage avec un léger
    // décalage (cf. CHARGE_STAGGER) → effet de vague d'un corridor à l'autre.
    const n = this.ribbons.length
    const span = Math.max(1e-3, 1 - CHARGE_STAGGER * (n - 1))

    const stride = 20 // 5 floats * 4 octets
    for (let idx = 0; idx < n; idx++) {
      const ribbon = this.ribbons[idx]
      const chargeR = Math.min(1, Math.max(0, (flowState.charge - idx * CHARGE_STAGGER) / span))
      gl.uniform1f(this.uCharge, chargeR)
      gl.uniform1f(this.uFlowMax, ribbon.flowMax)
      gl.uniform1i(this.uHotCount, ribbon.hotCount)
      gl.uniform3fv(this.uHotspots, ribbon.hotspots)

      // Matrice translatée vers l'ancre du corridor (double précision CPU) →
      // coords relatives minuscules côté GPU, plus de jitter quand la caméra tourne.
      composeMatrix(args.defaultProjectionData.mainMatrix, ribbon.anchor, this.matrix)
      gl.uniformMatrix4fv(this.uMatrix, false, this.matrix)

      gl.bindBuffer(gl.ARRAY_BUFFER, ribbon.buffer)
      gl.enableVertexAttribArray(this.aPos)
      gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, stride, 0)
      gl.enableVertexAttribArray(this.aFlow)
      gl.vertexAttribPointer(this.aFlow, 1, gl.FLOAT, false, stride, 8)
      gl.enableVertexAttribArray(this.aSide)
      gl.vertexAttribPointer(this.aSide, 1, gl.FLOAT, false, stride, 12)
      gl.enableVertexAttribArray(this.aT)
      gl.vertexAttribPointer(this.aT, 1, gl.FLOAT, false, stride, 16)

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, ribbon.count)
    }
    gl.depthMask(true)

    // Boucle d'animation : tant que visible et mouvement autorisé, on redemande
    // une frame (MapLibre n'anime pas les couches custom tout seul).
    if (!flowState.reduced) this.map?.triggerRepaint()
  }

  onRemove(_map: MLMap, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    for (const ribbon of this.ribbons) gl.deleteBuffer(ribbon.buffer)
    this.ribbons = []
    if (this.program) gl.deleteProgram(this.program)
    this.program = null
  }
}

export function addTrafficFlow(map: MLMap) {
  if (map.getLayer(LAYER_ID)) return
  flowState.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  flowState.startMs = -1
  // Mouvement réduit : néon statique déjà allumé (pas de balayage ni de flux).
  flowState.reveal = flowState.reduced ? 1 : 0
  flowState.charge = flowState.reduced ? 1 : 0

  // Ajoutée au-dessus de l'extrusion des bâtiments (gp-buildings-3d) : leur
  // profondeur est déjà écrite quand la bande dessine → occlusion correcte.
  map.addLayer(new TrafficFlowLayer())

  revealTl?.kill()
  revealTl = null
  if (!flowState.reduced) {
    // « Power-on » : fondu maître rapide + balayage de charge qui remonte les
    // corridors, puis le flux permanent de comètes prend le relais.
    revealTl = gsap.timeline({
      delay: REVEAL_DELAY_S,
      onUpdate: () => map.triggerRepaint(),
    })
    revealTl.to(flowState, { reveal: 1, duration: REVEAL_DUR_S, ease: 'power1.out' }, 0)
    revealTl.to(flowState, { charge: 1, duration: CHARGE_DUR_S, ease: 'power2.out' }, 0)
  }
}

export function removeTrafficFlow(map: MLMap) {
  revealTl?.kill()
  revealTl = null
  flowState.reveal = 0
  flowState.charge = 0
  if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID) // déclenche onRemove → libère le GL
}
