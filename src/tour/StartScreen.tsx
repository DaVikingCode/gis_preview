import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { useTourStore } from '@/store/tour-store'
import { useMapMaybe } from '@/map/MapContext'
import { STEPS } from './steps'
import { addBuildings3D } from '@/map/layers/buildings3d'
import { prefetchPointCloud } from '@/map/layers/pointCloud'
import { prefetchAirplaneModel } from '@/map/layers/airplane3d'
import { preloadImages } from '@/map/preloadImages'
import { Play, Boxes, Ruler, Flame, MapPin, MonitorPlay } from 'lucide-react'
import dvcWordmark from '@/assets/dvc-wordmark.svg?inline'

// Capacités phares, résumées en pastilles scannables plutôt qu'en paragraphe.
const CAPS = [
  { icon: Boxes, label: 'Bâtiments 3D' },
  { icon: Ruler, label: 'Mesure' },
  { icon: Flame, label: 'Heatmaps' },
  { icon: MapPin, label: 'POI cliquables' },
] as const

export function StartScreen() {
  const start = useTourStore((s) => s.start)
  const startAuto = useTourStore((s) => s.startAuto)
  const map = useMapMaybe()
  const addedRef = useRef(false)

  useEffect(() => {
    if (!map || addedRef.current) return
    addedRef.current = true
    // Préchargement EN TÂCHE DE FOND dès le splash, NON bloquant : on lance le
    // téléchargement du nuage LiDAR (~32 Mo gzippés), du glb avion et des images d'interface
    // pour que les steps correspondants arrivent sans latence, mais les boutons
    // « Démarrer » restent actifs immédiatement (aucun gate sur la fin du préchargement).
    // Les tuiles sont réchauffées en fond par TourController au démarrage.
    prefetchPointCloud()
    prefetchAirplaneModel()
    preloadImages()
    // Drop the 3D buildings in so the idle cinematic rotation has something to chew on.
    if (map.isStyleLoaded()) addBuildings3D(map)
    else map.once('idle', () => addBuildings3D(map))
  }, [map])

  return (
    <div
      className="absolute inset-0 grid place-items-center overflow-auto bg-black/30 p-4 backdrop-blur-md sm:p-6"
      style={{ zIndex: 100200 }}
    >
      {/* Splash sombre « panneau de contrôle » : tranche sur la carte claire et colle
          à l'identité DVC (jaune + cyan sur quasi-noir). */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-gradient-to-b from-[#26262a] to-[#161618] p-7 shadow-[0_30px_90px_-25px_rgba(0,0,0,0.7)] ring-1 ring-white/10 duration-500 animate-in fade-in zoom-in-95 sm:p-9">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              'linear-gradient(to right,#fff 1px,transparent 1px),linear-gradient(to bottom,#fff 1px,transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full bg-[#ffeb04]/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-12 h-52 w-52 rounded-full bg-[#00b5e1]/15 blur-3xl"
        />

        <div className="relative flex flex-col gap-5">
          <div
            className="flex items-center justify-between fill-mode-both duration-700 animate-in fade-in slide-in-from-bottom-2"
            style={{ animationDelay: '60ms' }}
          >
            <img src={dvcWordmark} alt="DaVikingCode" className="h-6 w-auto" />
            <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/60 tabular-nums">
              {STEPS.length} étapes
            </span>
          </div>

          <div
            className="flex flex-col gap-3 fill-mode-both duration-700 animate-in fade-in slide-in-from-bottom-2"
            style={{ animationDelay: '140ms' }}
          >
            <span className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-white/45 uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00b5e1]" />
              Démo interactive
            </span>
            <h1 className="font-heading text-[2rem] leading-[1.05] font-black tracking-[-0.02em] text-white sm:text-[2.5rem]">
              Cartographie augmentée<span className="text-[#ffeb04]">.</span>
            </h1>
            <p className="text-sm text-white/55">
              Une visite guidée de nos savoir-faire SIG, étape par étape.
            </p>
          </div>

          <div
            className="flex flex-wrap gap-2 fill-mode-both duration-700 animate-in fade-in slide-in-from-bottom-2"
            style={{ animationDelay: '220ms' }}
          >
            {CAPS.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70"
              >
                <Icon className="size-3.5 text-[#ffeb04]" />
                {label}
              </span>
            ))}
            <span className="inline-flex items-center rounded-full px-2 py-1 text-xs text-white/35">
              + raster, vecteurs, swipe…
            </span>
          </div>

          <Button
            size="lg"
            onClick={start}
            className="mt-1 h-11 w-full gap-2 rounded-xl text-[15px] font-semibold fill-mode-both transition-transform duration-700 animate-in fade-in slide-in-from-bottom-2 hover:-translate-y-0.5"
            style={{ animationDelay: '300ms' }}
          >
            <Play className="size-4 fill-current" /> Démarrer la visite
          </Button>

          {/* Lecture automatique : enchaîne les étapes seule, sans piloter. */}
          <Button
            variant="outline"
            size="lg"
            onClick={startAuto}
            className="h-11 w-full gap-2 rounded-xl text-[15px] font-semibold fill-mode-both transition-transform duration-700 animate-in fade-in slide-in-from-bottom-2 hover:-translate-y-0.5"
            style={{ animationDelay: '360ms' }}
          >
            <MonitorPlay className="size-4" /> Lecture automatique
          </Button>
        </div>
      </div>
    </div>
  )
}
