import type { Map as MLMap } from 'maplibre-gl'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import {
  MODE,
  POINTCLOUD_ANCHOR,
  pointCloudTuning,
  pointCloudView,
  SCAN_MAX,
  SCAN_MIN,
} from '@/map/layers/pointCloud'
import { useMapDataStore, type PointCloudColorMode } from '@/store/map-data-store'

gsap.registerPlugin(useGSAP)

// -----------------------------------------------------------------------------
// Chorégraphie du step « Nuage de points · LiDAR » (Auxonne), en hook d'animation.
//
// La caméra orbite en continu autour du nuage (centre verrouillé sur l'ancrage, cap
// qui tourne sans fin). Par-dessus, une timeline GSAP :
//   1. Révélation progressive du nuage (mode altitude).
//   2. SCAN Altitude → RGB (vraie couleur).
//   3. SCAN RGB → Classification (sol/végétation, ligne électrique rouge, urgence U0→U4).
//   4. PLAN RAPPROCHÉ qui SUIT LA LIGNE ÉLECTRIQUE (centre caméra le long de la
//      polyligne classe 24, cf. meta.linePath) en classification.
//   5. Recul + reprise de l'orbite (en classification).
//
// L'orbite (cap) est un tween gsap recréable (makeOrbit) ; pendant le suivi de ligne on
// le tue pour piloter le centre/cap à la main, puis on le recrée. Piloté par le jeton
// `pointCloudRun` (revertOnUpdate → rejoue/tue proprement).
// -----------------------------------------------------------------------------

const MODE_NAME: Record<number, PointCloudColorMode> = {
  [MODE.altitude]: 'altitude',
  [MODE.rgb]: 'rgb',
  [MODE.classification]: 'classification',
}

const ORBIT_PERIOD = 28 // s pour un tour complet

// Position [lng,lat] sur la polyligne par spline Catmull-Rom (t ∈ [0,1]) : courbe LISSE
// passant par les waypoints (pas de coins comme une interpolation linéaire) → mouvement
// de caméra fluide le long de la ligne.
const splineAt = (path: [number, number][], t: number): [number, number] => {
  const n = path.length
  if (n < 2) return [path[0]?.[0] ?? 0, path[0]?.[1] ?? 0]
  const u = Math.min(n - 1, Math.max(0, t * (n - 1)))
  const i = Math.floor(u)
  const f = u - i
  const p0 = path[Math.max(0, i - 1)]
  const p1 = path[i]
  const p2 = path[Math.min(n - 1, i + 1)]
  const p3 = path[Math.min(n - 1, i + 2)]
  const cr = (a: number, b: number, c: number, d: number) => {
    const f2 = f * f
    const f3 = f2 * f
    return (
      0.5 *
      (2 * b + (-a + c) * f + (2 * a - 5 * b + 4 * c - d) * f2 + (-a + 3 * b - 3 * c + d) * f3)
    )
  }
  return [cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])]
}
// Azimut (°, cap MapLibre) de a → b.
const azimuth = (a: [number, number], b: [number, number]): number => {
  const lat = (a[1] * Math.PI) / 180
  return (Math.atan2((b[0] - a[0]) * Math.cos(lat), b[1] - a[1]) * 180) / Math.PI
}

export function usePointCloudChoreography(map: MLMap | null) {
  const handle = useMapDataStore((s) => s.pointCloudHandle)
  const run = useMapDataStore((s) => s.pointCloudRun)

  useGSAP(
    () => {
      if (!map || !handle || run === 0) return

      const setMode = (m: number) =>
        useMapDataStore.getState().setPointCloudColorMode(MODE_NAME[m] ?? 'altitude')
      let cancelled = false

      // Reset état animé (Rejouer).
      pointCloudView.modeFrom = MODE.altitude
      pointCloudView.modeTo = MODE.altitude
      pointCloudView.scan = SCAN_MAX
      pointCloudView.scanGlow = 0
      pointCloudTuning.pointSizePx = 0.5
      handle.setReveal(0)
      setMode(MODE.altitude)

      // Caméra : centre (lng/lat, mobile pour le suivi de ligne), zoom, tangage, cap.
      const cam = {
        center: [POINTCLOUD_ANCHOR[0], POINTCLOUD_ANCHOR[1]] as [number, number],
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing(),
      }
      const applyCam = () => {
        if (cancelled) return
        map.jumpTo({ center: cam.center, zoom: cam.zoom, pitch: cam.pitch, bearing: cam.bearing })
      }

      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduced) {
        void handle.ready.then(({ count }) => {
          if (cancelled) return
          handle.setReveal(count)
          pointCloudView.modeFrom = MODE.classification
          pointCloudView.modeTo = MODE.classification
          pointCloudView.scan = SCAN_MAX
          pointCloudTuning.pointSizePx = 1.4
          cam.zoom = 15.8
          cam.pitch = 55
          cam.bearing = 0
          applyCam()
          setMode(MODE.classification)
        })
        return () => {
          cancelled = true
          useMapDataStore.getState().setPointCloudStopCamera(null)
        }
      }

      // Orbite continue (cap) — recréable.
      const makeOrbit = () =>
        gsap.to(cam, {
          bearing: cam.bearing + 360,
          duration: ORBIT_PERIOD,
          ease: 'none',
          repeat: -1,
          onUpdate: applyCam,
        })
      let orbit = makeOrbit()

      const tl = gsap.timeline({ paused: true })
      useMapDataStore.getState().setPointCloudStopCamera(() => {
        cancelled = true
        orbit.pause()
        tl.pause()
        map.stop()
      })

      let count = 0
      void handle.ready.then((r) => {
        if (cancelled) return
        count = r.count
        tl.play()
      })

      const v = pointCloudView
      const addScan = (fromMode: number, toMode: number, duration: number) => {
        tl.call(() => {
          v.modeFrom = fromMode
          v.modeTo = toMode
          v.scan = SCAN_MIN
          v.scanGlow = 1
          map.triggerRepaint()
        })
        tl.to(v, {
          scan: SCAN_MAX,
          duration,
          ease: 'sine.inOut',
          onUpdate: () => map.triggerRepaint(),
        })
        tl.to(v, { scanGlow: 0, duration: 0.5, ease: 'power1.out' })
        tl.call(() => {
          v.modeFrom = toMode
          setMode(toMode)
        })
      }

      // ── 1. Révélation PROGRESSIVE (altitude) + cadrage d'orbite ──────────
      const REVEAL_S = 5.5
      const reveal = { n: 0 }
      tl.to(
        cam,
        { zoom: 15.8, pitch: 58, duration: 3.4, ease: 'power2.inOut', onUpdate: applyCam },
        0,
      )
      tl.fromTo(
        pointCloudTuning,
        { pointSizePx: 0.15 },
        { pointSizePx: 1.2, duration: REVEAL_S, ease: 'power2.out' },
        0,
      )
      tl.fromTo(
        reveal,
        { n: 0 },
        {
          n: 1,
          duration: REVEAL_S,
          ease: 'power1.inOut',
          onUpdate: () => handle.setReveal(reveal.n * count),
        },
        0,
      )
      tl.to({}, { duration: 0.6 })

      // ── 2. Scan Altitude → RGB ───────────────────────────────────────────
      addScan(MODE.altitude, MODE.rgb, 3.2)
      tl.to({}, { duration: 1.0 })

      // ── 3. Scan RGB → Classification ─────────────────────────────────────
      addScan(MODE.rgb, MODE.classification, 3.2)
      tl.to({}, { duration: 0.8 })

      // ── 4. Plan rapproché : SUIVI de la ligne électrique (classification) ─
      // Cap amorti vers une cible : évite le « à-coup » quand on change de segment
      // (la direction par segment est discontinue) — la caméra pivote doucement.
      const dampBearing = (target: number) => {
        const d = ((target - cam.bearing + 540) % 360) - 180
        cam.bearing += d * 0.12
      }
      let followPath: [number, number][] = []
      const entryStart: [number, number] = [POINTCLOUD_ANCHOR[0], POINTCLOUD_ANCHOR[1]]
      let entryBearing0 = 0
      let entryZoom0 = 0
      let entryPitch0 = 0
      tl.call(() => {
        orbit.kill() // l'orbite ne pilote plus la caméra pendant l'entrée + le suivi
        followPath = useMapDataStore.getState().pointCloudLinePath
        entryStart[0] = cam.center[0]
        entryStart[1] = cam.center[1]
        entryBearing0 = cam.bearing
        entryZoom0 = cam.zoom
        entryPitch0 = cam.pitch
      })
      // Cap depuis la tangente de la spline en t (échantillon avant) — continu donc lisse.
      const headingSpline = (t: number) =>
        azimuth(splineAt(followPath, t), splineAt(followPath, Math.min(1, t + 0.04)))
      // ── ENTRÉE UNIFIÉE ───────────────────────────────────────────────────
      // Un SEUL mouvement (descente + glissé vers le début de la ligne + alignement du
      // cap + grossissement des points), tous pilotés par le même `p` et le même ease
      // `power1.out` : départ immédiat dans la continuité de l'orbite (pas de ralenti
      // « tourne PUIS descend »), arrivée douce qui alimente le parcours.
      const entry = { p: 0 }
      tl.to(
        entry,
        {
          p: 1,
          duration: 4.0,
          ease: 'power1.out',
          onUpdate: () => {
            if (followPath.length < 2) return applyCam()
            const p = entry.p
            const s0 = splineAt(followPath, 0)
            cam.center[0] = entryStart[0] + (s0[0] - entryStart[0]) * p
            cam.center[1] = entryStart[1] + (s0[1] - entryStart[1]) * p
            cam.zoom = entryZoom0 + (20 - entryZoom0) * p
            cam.pitch = entryPitch0 + (77 - entryPitch0) * p
            // Cap : alignement (chemin le plus court) sur la direction de la ligne.
            const delta = ((headingSpline(0) - entryBearing0 + 540) % 360) - 180
            cam.bearing = entryBearing0 + delta * p
            applyCam()
          },
        },
        '>',
      )
      // Points plus gros au ras de la ligne (surfaces lisibles en gros plan).
      tl.to(pointCloudTuning, { pointSizePx: 5.5, duration: 4.0, ease: 'power1.out' }, '<')
      // Parcours le long de la ligne : le centre suit la SPLINE (courbe lisse, pas de
      // coins), le cap suit (amorti) la tangente → on la longe au ras. Les POI de danger
      // (overlay) restent visibles en mode classification et la caméra passe devant.
      // Ease `power1.in` : on accélère le long de la ligne et on FINIT à pleine vitesse
      // → l'élan se prolonge dans l'envol final (pas de ralenti au bout de la ligne).
      const follow = { t: 0 }
      tl.to(follow, {
        t: 1,
        duration: 12,
        ease: 'power1.in',
        onUpdate: () => {
          if (followPath.length >= 2) {
            const c = splineAt(followPath, follow.t)
            cam.center[0] = c[0]
            cam.center[1] = c[1]
            dampBearing(headingSpline(follow.t))
          }
          applyCam()
        },
      })

      // ── 5. Envol au bout de la ligne, puis demi-tour vers le nuage (CONTINU) ──
      // Au lieu de revenir EN ARRIÈRE vers le centre, la caméra CONTINUE TOUT DROIT
      // (dépassement vers l'avant), prend de l'altitude (dézoom + tangage), et pivote
      // (~200°) pour SE RETOURNER vers le nuage. Trajectoire en arc (Bézier quadratique
      // bout-de-ligne → point avant → ancrage) : aucun retour en arrière, aucun arrêt.
      const exitE = [0, 0] // bout de la ligne
      const exitC = [0, 0] // point de contrôle = dépassement vers l'avant
      let exitBearing0 = 0
      tl.call(() => {
        exitE[0] = cam.center[0]
        exitE[1] = cam.center[1]
        exitBearing0 = cam.bearing
        if (followPath.length >= 2) {
          const back = splineAt(followPath, 0.9)
          const fx = exitE[0] - back[0]
          const fy = exitE[1] - back[1]
          const len = Math.hypot(fx, fy) || 1
          const OVER = 0.0011 // ~120 m de dépassement (en degrés)
          exitC[0] = exitE[0] + (fx / len) * OVER
          exitC[1] = exitE[1] + (fy / len) * OVER
        } else {
          exitC[0] = exitE[0]
          exitC[1] = exitE[1]
        }
      })
      const exit = { p: 0 }
      tl.to(exit, {
        p: 1,
        duration: 4.4,
        ease: 'power2.out',
        onUpdate: () => {
          const p = exit.p
          const q = 1 - p
          // Bézier quad : départ vers l'AVANT (exitC) puis arc vers l'ancrage.
          cam.center[0] = q * q * exitE[0] + 2 * q * p * exitC[0] + p * p * POINTCLOUD_ANCHOR[0]
          cam.center[1] = q * q * exitE[1] + 2 * q * p * exitC[1] + p * p * POINTCLOUD_ANCHOR[1]
          cam.zoom = 20 + (15.8 - 20) * p // s'envole (prend de l'altitude)
          cam.pitch = 77 + (54 - 77) * p
          cam.bearing = exitBearing0 + 200 * p // se retourne vers le nuage
          applyCam()
        },
      })
      tl.to(pointCloudTuning, { pointSizePx: 1.0, duration: 4.4, ease: 'power2.out' }, '<')
      // L'orbite reprend depuis le cap final, même sens → enchaînement sans couture.
      tl.call(() => {
        orbit = makeOrbit()
      })

      return () => {
        cancelled = true
        orbit.kill()
        useMapDataStore.getState().setPointCloudStopCamera(null)
      }
    },
    { dependencies: [run, handle, map], revertOnUpdate: true },
  )
}
