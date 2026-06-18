# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page **guided product-demo tour** of a GIS platform, built on MapLibre GL. There is no backend — all data is static sample data under `src/data/`, and "layers" are real map renders driven by a scripted step-by-step tour. UI text is in **French**. Dark mode is forced (`main.tsx` adds `dark` to `<html>`).

## Commands

- `npm run dev` — Vite dev server (HMR)
- `npm run build` — `tsc -b && vite build` (type-check then bundle)
- `npm run lint` — ESLint over the repo
- `npm run preview` — serve the production build

No test runner is configured. `bun.lock` and `package-lock.json` both exist; pick one and stay consistent.

Path alias: `@/` → `src/` (configured in both `vite.config.ts` and `tsconfig.app.json`).

## Architecture

### The tour is the spine

`src/tour/steps.ts` exports `STEPS: TourStep[]` — the single source of truth for the entire demo. Each step is fully declarative:

- `camera` (center/zoom/pitch/bearing, optional `padding` to offset the visual center above an overlay), optional `flyIn` for an animated zoom-in
- `basemap` — which basemap to switch to (see `src/map/basemaps.ts`)
- `chart` — which right-panel chart/card `ChartsPanel` renders (a `ChartKind` union)
- `onEnter(map, ctx)` / `onLeave(map)` — imperatively add/remove map layers and push data into the store

To add a demo feature: write an `addX`/`removeX` layer module, add a `ChartKind` + chart component, then add a `TourStep` wiring them via `onEnter`/`onLeave`. Step order in the array == tour order.

### Three layers of state/control

1. **driver.js** (`TourController.tsx`) renders the tour popovers/overlay and owns navigation (Next/Prev, the progress stepper, the "import gate" that blocks advancing until `importDone`).
2. **`tour-store`** (Zustand) mirrors driver.js position (`currentStep`, `started`, `basemap`, `cinematicActive`, `importDone`) so React components can react to it. `TourController` keeps the two in sync (both directions) and runs the camera flight + `onEnter`/`onLeave` on each step change.
3. **`map-data-store`** (Zustand) holds the data that layer `onEnter` hooks compute (building heights, measure points, draw stats, isochrone stats, POI status…) and that `ChartsPanel` charts read. This is how imperative map code talks to the React chart panel.

`STEPS[i].onEnter` typically calls `useMapDataStore.getState().setX(...)`; the matching `onLeave` clears it. Use `getState()` (not hooks) inside step callbacks and layer modules.

### Map instance access

`MapCanvas.tsx` creates the single MapLibre `Map` and provides it via `MapContext`. Children get it through `useMap()` (throws if outside) or `useMapMaybe()`. Children only mount after the map's `load` event fires.

### Layer modules (`src/map/layers/`)

Each module is **imperative**, not React — it exports `addX(map, …)` / `removeX(map)` (and sometimes a handle with `.detach()` for interactive tools like measure/draw/markers). Pattern: guard with `map.getSource`/`map.getLayer` before adding; remove layer then source on teardown. Many pull tiles from live IGN Géoportail / OpenFreeMap / Esri endpoints (see `cadastre.ts`, `wmsRaster.ts`, `basemaps.ts`).

### UI components

- `src/components/ui/` — shadcn components (style `radix-nova`, `components.json`). Add via shadcn CLI.
- `src/components/AppSidebar.tsx`, `src/charts/*` — app-specific. Charts use Recharts; the right panel is assembled in `ChartsPanel.tsx` keyed off the current step's `chart`.

## Conventions

- **React Compiler is enabled** (`babel-plugin-react-compiler` via `@rolldown/plugin-babel` in `vite.config.ts`) — do not hand-add `useMemo`/`useCallback` for memoization; let the compiler handle it.
- `tsconfig` is strict: `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax` (use `import type` for type-only imports), `erasableSyntaxOnly`.
- High `zIndex` values (~100100) on overlays sit above driver.js's overlay — keep new overlays consistent.
- `import.meta.env.DEV` gates the `DebugPanel` (tour step jumper).

## End-of-task checklist

At the end of **every** task, always:

1. Run `npm run lint` and fix any lint errors introduced by the changes.
2. Run `npm run format` to format the code.

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
