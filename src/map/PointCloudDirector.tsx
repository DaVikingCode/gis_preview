import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { useMap } from './MapContext'
import { MODE, pointCloudView, SCAN_MAX, SCAN_MIN } from './layers/pointCloud'
import { usePointCloudChoreography } from '@/hooks/animations/usePointCloudChoreography'
import { useMapDataStore } from '@/store/map-data-store'

gsap.registerPlugin(useGSAP)

// Hôte React de la chorégraphie du nuage de points : monté dans l'arbre carte
// (Overlays), il fait tourner le hook `usePointCloudChoreography` (qui possède la
// timeline) et expose dans le store le changement manuel de colorisation du panneau.
// Toute la logique GSAP du step vit donc ici / dans le hook, plus dans steps.ts.
export function PointCloudDirector() {
  const map = useMap()
  usePointCloudChoreography(map)

  // Changement manuel de colorisation (panneau) : balaie `scan` du mode courant vers
  // le mode demandé — même wipe que la chorégraphie, plus rapide.
  useGSAP(
    (_ctx, contextSafe) => {
      const setColor = contextSafe!((mode: keyof typeof MODE) => {
        const target = MODE[mode]
        const from = pointCloudView.modeTo
        useMapDataStore.getState().setPointCloudColorMode(mode)
        if (from === target) return
        pointCloudView.modeFrom = from
        pointCloudView.modeTo = target
        pointCloudView.scan = SCAN_MIN
        gsap.to(pointCloudView, {
          scan: SCAN_MAX,
          duration: 1.6,
          ease: 'sine.inOut',
          onStart: () => {
            pointCloudView.scanGlow = 0.5
          },
          onUpdate: () => map.triggerRepaint(),
          onComplete: () => {
            pointCloudView.scanGlow = 0
            pointCloudView.modeFrom = target
            map.triggerRepaint()
          },
        })
      })
      useMapDataStore.getState().setPointCloudSetColor(setColor)
      return () => useMapDataStore.getState().setPointCloudSetColor(null)
    },
    { dependencies: [map] },
  )

  return null
}
