import type { Map as MLMap } from 'maplibre-gl'
import * as turf from '@turf/turf'
import type { Feature, FeatureCollection, MultiPolygon, Point, Polygon } from 'geojson'

// Révélation du remplissage du step « Mesure », en deux phases couplées qui
// partent toutes deux du coin de fin de tracé :
//   1. VAGUE DE POINTS — une trame (stippling) éclot en crête mobile : chaque point
//      grossit fort au passage du front puis redescend au repos derrière (onde).
//   2. PAUSE — la trame posée tient un court instant.
//   3. FLOOD + DISSOLUTION — l'aplat inonde depuis le coin (propagation Turf) et
//      chaque point se dissout pile quand le front du remplissage l'atteint.
//   4. ASSOMBRISSEMENT — l'aplat plein monte d'un cran. Fin sans points.
// Piloté par GSAP via des expressions MapLibre data-driven recalculées par frame.
//
// Option `posts` (step « Dessin & analyse spatiale ») : une couche de postes HTA
// reçoit un BUMP synchronisé sur la VAGUE — chaque poste éclot (rayon en crête →
// repos, opacité 0 → 1) pile quand le front de la vague l'atteint, et `onHit(i)`
// est appelé à ce moment (le panneau peut alors incrémenter son compteur en synchro).

const COLS = 40 // densité de la trame (colonnes sur la plus grande dimension bbox)
const DOT_BASE_R = 1.7 // rayon au repos (fin : trame aérée même dense)
const DOT_CREST_R = 4.4 // rayon au sommet de la crête (plus gros → onde, subtile)
const DOT_OPACITY = 0.82 // opacité au repos
const DOT_DEPTH = 0.3 // atténuation des points lointains (profondeur)
const DISSOLVE_BAND = 0.08 // largeur (en `t` normalisé) de la dissolution au front du flood

// Tempo (secondes), relatif au label `at`.
const A_DUR = 0.9 // vague de points
const HOLD = 0.25 // pause trame posée
const B_DUR = 0.75 // flood + dissolution
const C_DUR = 0.4 // assombrissement
const B_AT = A_DUR + HOLD
const C_AT = B_AT + B_DUR

export type MeasureReveal = {
  // Joue les 4 phases le long de la timeline, ancrées au label `at`.
  reveal: (tl: gsap.core.Timeline, at: string) => void
  // Variante sans animation (prefers-reduced-motion) : aplat plein direct, sans points.
  showStatic: () => void
}

export function createMeasureReveal(
  map: MLMap,
  opts: {
    ring: [number, number][]
    dotsSource: string
    dotsLayer: string
    fillSource: string
    fillLayer: string
    fillBase: number
    fillDark: number
    // Postes HTA pilotés par la vague (step Dessin). Absent → aucun poste piloté
    // (step Mesure), comportement strictement identique.
    // `source`/`layer`/`baseR`/`crestR` optionnels : fournis → la couche circle native
    // « bumpe » au passage du front (comportement historique) ; omis → mode TRIGGER-ONLY,
    // on ne fait que tirer `onHit(i)` quand le front atteint le poste (le rendu est alors
    // pris en charge ailleurs, ex. les markers DOM hero de `postHitMarkers`).
    posts?: {
      source?: string
      layer?: string
      coords: [number, number][]
      baseR?: number // rayon au repos (= rayon nominal de la pastille touchée)
      crestR?: number // rayon au sommet du bump (overshoot au passage de la vague)
      onHit?: (index: number) => void // appelé une fois quand la vague atteint le poste i
    }
  },
): MeasureReveal {
  const origin = opts.ring[0]
  const closed: [number, number][] = [...opts.ring, opts.ring[0]]
  const poly = turf.polygon([closed])
  const boundary = turf.lineString(closed)
  const [minX, minY, maxX, maxY] = turf.bbox(poly)

  // --- Trame de points : grille hexagonale (rangées décalées) découpée sur le
  // polygone, à distance de l'arête. `d` = distance normalisée au coin → ordonne
  // les deux fronts (vague puis flood).
  const stepX = (maxX - minX) / COLS
  const stepY = stepX * 0.866
  const edgePadKm =
    turf.distance([minX, minY], [minX + stepX, minY], { units: 'kilometers' }) * 0.45

  const seeds: { coord: [number, number]; d: number }[] = []
  let r = 0
  for (let y = minY; y <= maxY; y += stepY) {
    const xOff = r % 2 ? stepX / 2 : 0
    for (let x = minX + xOff; x <= maxX; x += stepX) {
      const coord: [number, number] = [x, y]
      if (!turf.booleanPointInPolygon(coord, poly)) continue
      if (turf.pointToLineDistance(coord, boundary, { units: 'kilometers' }) < edgePadKm) continue
      seeds.push({ coord, d: turf.distance(origin, coord, { units: 'kilometers' }) })
    }
    r++
  }
  const maxD = Math.max(...seeds.map((s) => s.d), 1e-6)
  const dotsFC: FeatureCollection<Point> = {
    type: 'FeatureCollection',
    features: seeds.map((s) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: s.coord },
      properties: { d: s.d / maxD },
    })),
  }

  // --- Postes HTA (optionnel) : même distance normalisée `d` que la trame → le
  // bump d'un poste se déclenche pile quand le front de la vague atteint son `d`.
  const postCfg = opts.posts
  const postD = postCfg
    ? postCfg.coords.map((c) => turf.distance(origin, c, { units: 'kilometers' }) / maxD)
    : []
  const postsFC: FeatureCollection<Point> = {
    type: 'FeatureCollection',
    features: postCfg
      ? postCfg.coords.map((c, i) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: c },
          properties: { d: postD[i] },
        }))
      : [],
  }
  const postFired = postCfg ? postCfg.coords.map(() => false) : []
  // La vague pousse assez loin pour balayer tous les postes (au repos, baseR), même
  // ceux proches d'un coin éloigné. Sans postes : 1.2 (inchangé pour la Mesure).
  const waveMax = postD.length ? Math.max(1.2, Math.max(...postD) + 0.25) : 1.2

  // --- Flood : un cercle (Turf) grandit depuis le coin et est intersecté avec le
  // polygone → l'aplat « inonde » depuis ce coin (logique reprise du flood d'origine).
  const maxR =
    Math.max(...opts.ring.map((v) => turf.distance(origin, v, { units: 'kilometers' }))) * 1.18
  const emptyFC: FeatureCollection = { type: 'FeatureCollection', features: [] }
  const setRegion = (t: number) => {
    if (!map.getLayer(opts.fillLayer)) return
    const src = map.getSource(opts.fillSource) as maplibregl.GeoJSONSource | undefined
    if (!src) return
    let feat: Feature<Polygon | MultiPolygon> | null = null
    if (t >= 1) feat = poly
    else if (t > 0.001) {
      const circ = turf.circle(origin, maxR * t, { units: 'kilometers', steps: 56 })
      feat = turf.intersect(turf.featureCollection([poly, circ]))
    }
    src.setData(feat ? { type: 'FeatureCollection', features: [feat] } : emptyFC)
  }

  const D = ['to-number', ['get', 'd']]
  // Phase A — k = w - d. k<0 : front pas encore passé (invisible). Sinon le point
  // éclot en crête (rayon : pic puis retombée au repos ; opacité : pic lumineux
  // puis repos), atténué en profondeur pour les points lointains.
  const radiusA = (w: number) => [
    'let',
    'k',
    ['-', w, D],
    [
      'case',
      ['<', ['var', 'k'], 0],
      0,
      ['interpolate', ['linear'], ['var', 'k'], 0, 0, 0.06, DOT_CREST_R, 0.19, DOT_BASE_R],
    ],
  ]
  const opacityA = (w: number) => [
    'let',
    'k',
    ['-', w, D],
    [
      '*',
      ['-', 1, ['*', DOT_DEPTH, D]],
      [
        'case',
        ['<', ['var', 'k'], 0],
        0,
        ['interpolate', ['linear'], ['var', 'k'], 0, 0, 0.05, 1, 0.19, DOT_OPACITY],
      ],
    ],
  ]
  // Phase B — m = f - d (front du flood). m<0 : pas encore atteint → état posé.
  // Une fois le front passé, le point se dissout (fondu = 1 → 0 sur une bande courte).
  const fade = [
    'case',
    ['<', ['var', 'm'], 0],
    1,
    ['interpolate', ['linear'], ['var', 'm'], 0, 1, DISSOLVE_BAND, 0],
  ]
  const radiusB = (f: number) => ['let', 'm', ['-', f, D], ['*', DOT_BASE_R, fade]]
  const opacityB = (f: number) => [
    'let',
    'm',
    ['-', f, D],
    ['*', ['-', 1, ['*', DOT_DEPTH, D]], DOT_OPACITY, fade],
  ]

  // Bump des postes (même front `k = w - d` que la vague de points). k<0 : la vague
  // n'a pas atteint le poste → invisible. Au passage : éclot en crête (overshoot)
  // puis se pose à baseR, et reste plein ensuite (opacité fixée à 1).
  const radiusPost = (w: number) => [
    'let',
    'k',
    ['-', w, D],
    [
      'case',
      ['<', ['var', 'k'], 0],
      0,
      [
        'interpolate',
        ['linear'],
        ['var', 'k'],
        0,
        0,
        0.05,
        postCfg?.crestR ?? 0,
        0.18,
        postCfg?.baseR ?? 0,
      ],
    ],
  ]
  const opacityPost = (w: number) => [
    'let',
    'k',
    ['-', w, D],
    ['case', ['<', ['var', 'k'], 0], 0, ['interpolate', ['linear'], ['var', 'k'], 0, 0, 0.05, 1]],
  ]

  const setDots = (radius: unknown, opacity: unknown) => {
    if (!map.getLayer(opts.dotsLayer)) return
    map.setPaintProperty(opts.dotsLayer, 'circle-radius', radius)
    map.setPaintProperty(opts.dotsLayer, 'circle-opacity', opacity)
  }
  const seedDots = () =>
    (map.getSource(opts.dotsSource) as maplibregl.GeoJSONSource | undefined)?.setData(dotsFC)
  const setFillOpacity = (v: number) => {
    if (map.getLayer(opts.fillLayer)) map.setPaintProperty(opts.fillLayer, 'fill-opacity', v)
  }

  const seedPosts = () => {
    if (postCfg?.source)
      (map.getSource(postCfg.source) as maplibregl.GeoJSONSource | undefined)?.setData(postsFC)
  }
  const setPosts = (radius: unknown, opacity: unknown) => {
    if (postCfg?.layer && map.getLayer(postCfg.layer)) {
      map.setPaintProperty(postCfg.layer, 'circle-radius', radius)
      map.setPaintProperty(postCfg.layer, 'circle-opacity', opacity)
    }
  }
  // Déclenche onHit(i) une seule fois, dès que le front de vague `w` atteint le poste.
  const firePostHits = (w: number) => {
    if (!postCfg) return
    for (let i = 0; i < postD.length; i++) {
      if (!postFired[i] && w >= postD[i]) {
        postFired[i] = true
        postCfg.onHit?.(i)
      }
    }
  }

  return {
    reveal(tl, at) {
      // 1) Trame (et postes) semés invisibles, prêts à éclore.
      tl.call(
        () => {
          seedDots()
          setDots(radiusA(0), opacityA(0))
          seedPosts()
          setPosts(radiusPost(0), opacityPost(0))
        },
        [],
        at,
      )
      // 1) Vague de points en crête mobile depuis le coin — les postes bumpent au
      // passage du front et `onHit` égrène le compteur en synchro.
      const wA = { v: 0 }
      tl.to(
        wA,
        {
          v: waveMax,
          duration: A_DUR,
          ease: 'power2.out',
          onUpdate: () => {
            setDots(radiusA(wA.v), opacityA(wA.v))
            setPosts(radiusPost(wA.v), opacityPost(wA.v))
            firePostHits(wA.v)
          },
        },
        at,
      )
      // 3) Flood depuis le coin (sous les points) + dissolution des points au front.
      const bAt = `${at}+=${B_AT}`
      tl.call(
        () => {
          setFillOpacity(opts.fillBase)
          setRegion(0)
        },
        [],
        bAt,
      )
      const f = { v: 0 }
      tl.to(
        f,
        {
          v: 1,
          duration: B_DUR,
          ease: 'power2.inOut',
          onUpdate: () => {
            setRegion(f.v)
            setDots(radiusB(f.v), opacityB(f.v))
          },
        },
        bAt,
      )
      // 4) Aplat plein : on assombrit d'un cran (les points ont disparu).
      const dk = { v: opts.fillBase }
      tl.to(
        dk,
        {
          v: opts.fillDark,
          duration: C_DUR,
          ease: 'power2.inOut',
          onUpdate: () => setFillOpacity(dk.v),
        },
        `${at}+=${C_AT}`,
      )
    },
    showStatic() {
      // État final direct : aplat plein, aucun point. Postes touchés posés à baseR.
      setRegion(1)
      setFillOpacity(opts.fillDark)
      if (postCfg) {
        seedPosts()
        setPosts(postCfg.baseR, 1)
        for (let i = 0; i < postCfg.coords.length; i++) postCfg.onHit?.(i)
      }
    },
  }
}
