import { useEffect, useRef } from 'react'
import { useMap } from './MapContext'
import { useMapDataStore } from '@/store/map-data-store'

// POI de danger « élagage » : segments fixes VÉGÉTATION ↔ CONDUCTEUR aux vrais points
// chauds (calculés au prebake, cf. meta.dangerPois). Affichés en mode Classification,
// persistants (la caméra passe devant pendant l'orbite/le survol). Chaque POI = un trait
// rouge entre la végétation et la ligne, une pastille à chaque bout, et une étiquette
// « P{i} ⚠ {distance} m ». Projection 3D→écran via `pointCloudHandle.project`, mise à jour
// en DOM/SVG impératif à chaque frame (`map.on('render')`).

const RED = 'rgb(239,68,68)' // ligne électrique (conducteur)
const BLUE = 'rgb(59,130,246)' // végétation
const fr1 = (n: number) => n.toFixed(1).replace('.', ',')

export function PointCloudDangerPois() {
  const map = useMap()
  const pois = useMapDataStore((s) => s.pointCloudDangerPois)
  const handle = useMapDataStore((s) => s.pointCloudHandle)
  const colorMode = useMapDataStore((s) => s.pointCloudColorMode)

  const lineRefs = useRef<(SVGLineElement | null)[]>([])
  const vegRefs = useRef<(SVGCircleElement | null)[]>([])
  const condRefs = useRef<(SVGCircleElement | null)[]>([])
  const labelRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const visibleMode = colorMode === 'classification'
    // Hors mode classification, les segments danger ne s'affichent pas : on masque une
    // fois et on NE s'abonne PAS à `render`/`move`. Sinon `place()` tournerait à ~60 fps
    // (la couche nuage appelle `triggerRepaint()` chaque frame) en projetant tous les POI
    // pour rien. L'effet est ré-exécuté au changement de `colorMode` → (dé)branchement net.
    if (!visibleMode || !handle) {
      for (let i = 0; i < pois.length; i++) {
        for (const r of [lineRefs, vegRefs, condRefs, labelRefs]) {
          const el = r.current[i]
          if (el) el.style.opacity = '0'
        }
      }
      return
    }
    const place = () => {
      for (let i = 0; i < pois.length; i++) {
        const line = lineRefs.current[i]
        const veg = vegRefs.current[i]
        const cond = condRefs.current[i]
        const label = labelRefs.current[i]
        const pv = handle?.project(pois[i].veg)
        const pc = handle?.project(pois[i].cond)
        const ok = visibleMode && pv && pc && (pv.visible || pc.visible)
        const op = ok ? '1' : '0'
        if (line) {
          line.style.opacity = op
          if (ok) {
            line.setAttribute('x1', String(pv!.x))
            line.setAttribute('y1', String(pv!.y))
            line.setAttribute('x2', String(pc!.x))
            line.setAttribute('y2', String(pc!.y))
          }
        }
        if (veg && ok) {
          veg.style.opacity = op
          veg.setAttribute('cx', String(pv!.x))
          veg.setAttribute('cy', String(pv!.y))
        } else if (veg) veg.style.opacity = op
        if (cond && ok) {
          cond.style.opacity = op
          cond.setAttribute('cx', String(pc!.x))
          cond.setAttribute('cy', String(pc!.y))
        } else if (cond) cond.style.opacity = op
        if (label) {
          label.style.opacity = op
          if (ok) {
            const mx = (pv!.x + pc!.x) / 2
            const my = (pv!.y + pc!.y) / 2
            label.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -150%)`
          }
        }
      }
    }
    place()
    map.on('render', place)
    map.on('move', place)
    return () => {
      map.off('render', place)
      map.off('move', place)
    }
  }, [map, pois, handle, colorMode])

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ zIndex: 100099 }}
    >
      <svg className="absolute inset-0 h-full w-full" style={{ overflow: 'visible' }}>
        {pois.map((_, i) => (
          <g key={i}>
            <line
              ref={(el) => {
                lineRefs.current[i] = el
              }}
              stroke={RED}
              strokeWidth={2.5}
              strokeDasharray="5 3"
              style={{ opacity: 0 }}
            />
            <circle
              ref={(el) => {
                vegRefs.current[i] = el
              }}
              r={5}
              fill={BLUE}
              stroke="white"
              strokeWidth={1.5}
              style={{ opacity: 0 }}
            />
            <circle
              ref={(el) => {
                condRefs.current[i] = el
              }}
              r={5}
              fill={RED}
              stroke="white"
              strokeWidth={1.5}
              style={{ opacity: 0 }}
            />
          </g>
        ))}
      </svg>
      {pois.map((poi, i) => (
        <div
          key={i}
          ref={(el) => {
            labelRefs.current[i] = el
          }}
          className="absolute left-0 top-0 flex items-center gap-1 whitespace-nowrap rounded-full border border-red-500/70 bg-black/75 px-2 py-0.5 text-xs font-semibold tabular-nums text-red-300 shadow-lg backdrop-blur transition-opacity duration-300"
          style={{ opacity: 0, willChange: 'transform' }}
        >
          <span className="text-white/60">P{i + 1}</span>
          <span>⚠ {fr1(poi.clearanceM)} m</span>
        </div>
      ))}
    </div>
  )
}
