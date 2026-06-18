import { ArrowRight, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTourStore } from '@/store/tour-store'
import { STEPS } from '@/tour/steps'
import {
  CalibrationCorners,
  ContourField,
  CoordLabel,
  PrimitivesLegend,
} from '@/components/survey/Survey'
import dvcWordmark from '@/assets/dvc-wordmark.svg?inline'

const ORIGIN = { lon: 2.5, lat: 46.5 }

// Relief calé en haut-droite, profil légèrement différent du splash : un écho, pas un clone.
const CONTOUR = {
  cx: 430,
  cy: 90,
  radii: [20, 38, 60, 88, 122, 162, 208, 262, 326],
  viewBox: { w: 560, h: 420 },
}

// Écran de fin : le bookend du StartScreen. Même langage « feuille de relevé », mais c'est
// ici qu'on referme la boucle (« voici tout ce qu'on a parcouru ») et qu'on porte le CTA.
export function OutroScreen() {
  const currentStep = useTourStore((s) => s.currentStep)
  const step = STEPS[currentStep]

  return (
    <div
      className="pointer-events-none fixed inset-0 flex items-center justify-center p-4 sm:p-6"
      style={{ zIndex: 100050 }}
    >
      <div className="pointer-events-auto absolute inset-0 bg-black/55 backdrop-blur-sm" />

      <div
        id="outro-screen"
        className="pointer-events-auto relative w-full max-w-[30rem] overflow-hidden rounded-[14px] bg-gradient-to-b from-[#353535] to-[#1a1a1a] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.85)] ring-1 ring-[#4a4a4a]/70"
      >
        <ContourField
          cx={CONTOUR.cx}
          cy={CONTOUR.cy}
          radii={CONTOUR.radii}
          viewBox={CONTOUR.viewBox}
          className="absolute inset-0 h-full w-full"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(105deg, #1a1a1a 18%, rgba(26,26,26,0.78) 46%, rgba(26,26,26,0.2) 72%, transparent 100%)',
          }}
        />

        <CalibrationCorners />

        {/* gp-sheet-body : réactive les pointer-events que driver.js coupe hors élément
            actif (cf. index.css). La décoration ci-dessus reste non cliquable. */}
        <div className="gp-sheet-body relative flex flex-col gap-6 p-7 sm:p-9">
          <header
            className="gp-rise flex items-start justify-between gap-4"
            style={{ animationDelay: '60ms' }}
          >
            <img src={dvcWordmark} alt="DaVikingCode" className="h-[22px] w-auto" />
            <div className="text-right font-mono text-[10.5px] leading-relaxed tracking-wide">
              <CoordLabel lat={ORIGIN.lat} lon={ORIGIN.lon} className="text-[#00b5e1]/85" />
              <div className="text-white/35">FIN · {STEPS.length} ÉTAPES</div>
            </div>
          </header>

          <div className="gp-rise flex flex-col gap-3" style={{ animationDelay: '150ms' }}>
            <span className="flex items-center gap-2.5 font-mono text-[10.5px] font-medium tracking-[0.22em] text-white/45 uppercase">
              <span className="h-px w-5 bg-[#00b5e1]" />
              Fin de la visite
            </span>
            <h1 className="font-heading text-[2rem] leading-[1.05] font-black tracking-[-0.025em] text-white sm:text-[2.4rem]">
              {step?.title ?? 'Et bien plus encore'}
              <span className="text-[#ffeb04]">.</span>
            </h1>
            <p className="max-w-[42ch] text-sm leading-relaxed text-white/55">
              {step?.description ??
                'Nuages de points, mesures de surfaces, intégrations sur mesure… et bien plus.'}
            </p>
          </div>

          {/* On referme la boucle : la même légende qu'à l'ouverture, vue cette fois en action. */}
          <div className="gp-rise flex flex-col gap-3" style={{ animationDelay: '240ms' }}>
            <span className="font-mono text-[10px] tracking-[0.22em] text-white/35 uppercase">
              Ce que vous venez de parcourir
            </span>
            <PrimitivesLegend />
          </div>

          <div className="gp-rise flex flex-col gap-2.5" style={{ animationDelay: '330ms' }}>
            <Button
              size="lg"
              onClick={() => window.dispatchEvent(new CustomEvent('gp:open-contact'))}
              className="h-11 w-full gap-2 rounded-lg text-[15px] font-semibold transition-transform hover:-translate-y-0.5"
            >
              On en discute ? <ArrowRight className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => window.dispatchEvent(new CustomEvent('gp:restart-tour'))}
              className="h-10 w-full gap-2 rounded-lg text-sm font-medium text-white/55 hover:bg-white/5 hover:text-white/85"
            >
              <RotateCcw className="size-4" /> Revoir la visite
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
