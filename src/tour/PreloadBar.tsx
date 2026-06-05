import { usePreloadStore, selectFraction } from '@/store/preload-store'

// Ligne de progression fine en bas du panneau splash : agrège le préchargement des
// assets (LiDAR, glb, tuiles, images). Purement informative — le gate des boutons est
// géré par `done` côté StartScreen. À 100 %, fondu doux puis retrait.
export function PreloadBar() {
  const fraction = usePreloadStore(selectFraction)
  const done = usePreloadStore((s) => s.done)

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] overflow-hidden rounded-b-2xl bg-white/5 transition-opacity duration-[400ms]"
      style={{ opacity: done ? 0 : 1 }}
    >
      <div
        className="h-full origin-left transition-[width] duration-300 ease-out"
        style={{
          width: `${Math.round(fraction * 100)}%`,
          background: 'linear-gradient(to right,#00b5e1,#ffeb04)',
        }}
      />
    </div>
  )
}
