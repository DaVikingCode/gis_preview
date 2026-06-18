import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { useTourStore } from '@/store/tour-store'
import { useMapMaybe } from '@/map/MapContext'
import { STEPS } from './steps'
import { addBuildings3D } from '@/map/layers/buildings3d'
import { prefetchAirplaneModel } from '@/map/layers/airplane3d.shared'
import { preloadImages } from '@/map/preloadImages'
import { Play, MonitorPlay } from 'lucide-react'
import dvcWordmark from '@/assets/dvc-wordmark.svg?inline'
import {
  CalibrationCorners,
  ContourField,
  CoordLabel,
  PrimitivesLegend,
} from '@/components/survey/Survey'

// Coordonnées réelles de la vue d'ouverture (cf. STEPS[0].camera.center) — la marge de
// la feuille affiche le vrai relevé, pas un placeholder.
const ORIGIN = { lon: 2.5, lat: 46.5 }

// Centre du relief calé en haut-droite : le « sommet » (anneaux jaunes) sert d'unique accent.
const CONTOUR = { cx: 338, cy: 104, radii: [22, 40, 62, 90, 124, 164, 210, 264, 328, 404] }

export function StartScreen() {
  const start = useTourStore((s) => s.start)
  const startAuto = useTourStore((s) => s.startAuto)
  const map = useMapMaybe()
  const addedRef = useRef(false)

  useEffect(() => {
    if (!map || addedRef.current) return
    addedRef.current = true
    // Préchargements lourds (nuage LiDAR ~32 Mo, glb avion ~0,77 Mo, images d'interface)
    // DIFFÉRÉS après le 1er paint via requestIdleCallback : ils cèdent la priorité au
    // rendu/LCP du splash au lieu de concurrencer la fenêtre critique. NON bloquants — les
    // boutons « Démarrer » restent actifs immédiatement (aucun gate sur la fin du
    // préchargement). Les tuiles sont réchauffées en fond par TourController au démarrage.
    // prefetchPointCloud est dans le module lourd (three.js) : on le charge via import()
    // ici, à cet instant d'inactivité, donc hors du bundle d'entrée.
    const warm = () => {
      prefetchAirplaneModel()
      void import('@/map/layers/pointCloud').then((m) => m.prefetchPointCloud())
      preloadImages()
    }
    const hasRic = 'requestIdleCallback' in window
    const handle = hasRic
      ? window.requestIdleCallback(warm, { timeout: 2000 })
      : setTimeout(warm, 300)
    // Drop the 3D buildings in so the idle cinematic rotation has something to chew on.
    if (map.isStyleLoaded()) addBuildings3D(map)
    else map.once('idle', () => addBuildings3D(map))
    // Annule le préchargement planifié si le splash est démonté avant qu'il ne se déclenche.
    return () => {
      if (hasRic) window.cancelIdleCallback(handle as number)
      else clearTimeout(handle as ReturnType<typeof setTimeout>)
    }
  }, [map])

  return (
    <div
      className="absolute inset-0 grid place-items-center overflow-auto bg-black/45 p-4 backdrop-blur-[3px] sm:p-6"
      style={{ zIndex: 100200 }}
    >
      {/* La feuille de relevé : un instrument calibré, pas une carte marketing. */}
      <div className="relative w-full max-w-[27rem] overflow-hidden rounded-[14px] bg-gradient-to-b from-[#353535] to-[#1a1a1a] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.85)] ring-1 ring-[#4a4a4a]/70">
        {/* Champ topographique : isolignes dessinées au chargement, sommet en jaune. */}
        <ContourField
          cx={CONTOUR.cx}
          cy={CONTOUR.cy}
          radii={CONTOUR.radii}
          className="absolute inset-0 h-full w-full"
        />
        {/* Voile gauche→droite : garde le titre lisible par-dessus les courbes. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(105deg, #1a1a1a 18%, rgba(26,26,26,0.78) 46%, rgba(26,26,26,0.18) 72%, transparent 100%)',
          }}
        />

        <CalibrationCorners />

        <div className="relative flex flex-col gap-6 p-7 sm:p-9">
          {/* Cartouche : émetteur à gauche, relevé à droite (mono = lecture d'instrument). */}
          <header
            className="gp-rise flex items-start justify-between gap-4"
            style={{ animationDelay: '60ms' }}
          >
            <img src={dvcWordmark} alt="DaVikingCode" className="h-[22px] w-auto" />
            <div className="text-right font-mono text-[10.5px] leading-relaxed tracking-wide">
              <CoordLabel lat={ORIGIN.lat} lon={ORIGIN.lon} className="text-[#00b5e1]/85" />
              <div className="text-white/35">{STEPS.length} ÉTAPES · SIG</div>
            </div>
          </header>

          {/* Hero : le titre se pose au pied du relief. */}
          <div className="gp-rise flex flex-col gap-3" style={{ animationDelay: '150ms' }}>
            <span className="flex items-center gap-2.5 font-mono text-[10.5px] font-medium tracking-[0.22em] text-white/45 uppercase">
              <span className="h-px w-5 bg-[#00b5e1]" />
              Démonstration interactive
            </span>
            <h1 className="font-heading text-[2.1rem] leading-[1.04] font-black tracking-[-0.025em] text-white sm:text-[2.55rem]">
              Cartographie augmentée<span className="text-[#ffeb04]">.</span>
            </h1>
            <p className="max-w-[34ch] text-sm leading-relaxed text-white/55">
              Une visite guidée de nos savoir-faire SIG, étape par étape, sur des rendus réels.
            </p>
          </div>

          {/* Légende calée sur les primitives de données SIG. */}
          <div className="gp-rise flex flex-col gap-3" style={{ animationDelay: '240ms' }}>
            <span className="font-mono text-[10px] tracking-[0.22em] text-white/35 uppercase">
              Légende
            </span>
            <PrimitivesLegend />
          </div>

          <div className="gp-rise flex flex-col gap-2.5" style={{ animationDelay: '330ms' }}>
            <Button
              size="lg"
              onClick={start}
              className="h-11 w-full gap-2 rounded-lg text-[15px] font-semibold transition-transform hover:-translate-y-0.5"
            >
              <Play className="size-4 fill-current" /> Démarrer la visite
            </Button>

            {/* Lecture automatique : enchaîne les étapes seule, sans piloter. */}
            <Button
              variant="ghost"
              size="lg"
              onClick={startAuto}
              className="h-10 w-full gap-2 rounded-lg text-sm font-medium text-white/55 hover:bg-white/5 hover:text-white/85"
            >
              <MonitorPlay className="size-4" /> Lecture automatique
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
