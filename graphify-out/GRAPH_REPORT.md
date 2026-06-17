# Graph Report - . (2026-06-16)

## Corpus Check

- 219 files · ~212,617 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary

- 1016 nodes · 1219 edges · 96 communities (78 shown, 18 thin omitted)
- Extraction: 84% EXTRACTED · 16% INFERRED · 0% AMBIGUOUS · INFERRED: 198 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)

- [[_COMMUNITY_Point Cloud Choreography|Point Cloud Choreography]]
- [[_COMMUNITY_Realtime & Tour Cursor|Realtime & Tour Cursor]]
- [[_COMMUNITY_3D Airplane Layer|3D Airplane Layer]]
- [[_COMMUNITY_Point Cloud Prebake Script|Point Cloud Prebake Script]]
- [[_COMMUNITY_Layers Presentation Modal|Layers Presentation Modal]]
- [[_COMMUNITY_Sidebar UI Component|Sidebar UI Component]]
- [[_COMMUNITY_Basemap Prewarm|Basemap Prewarm]]
- [[_COMMUNITY_shadcn Config|shadcn Config]]
- [[_COMMUNITY_Traffic Flow Layer|Traffic Flow Layer]]
- [[_COMMUNITY_Project Architecture Docs|Project Architecture Docs]]
- [[_COMMUNITY_Runtime Dependencies|Runtime Dependencies]]
- [[_COMMUNITY_App TS Config|App TS Config]]
- [[_COMMUNITY_Tech Stack Diagram|Tech Stack Diagram]]
- [[_COMMUNITY_3D Buildings Layer|3D Buildings Layer]]
- [[_COMMUNITY_Dev Dependencies|Dev Dependencies]]
- [[_COMMUNITY_POI Status & Popups|POI Status & Popups]]
- [[_COMMUNITY_Sample Vector Data|Sample Vector Data]]
- [[_COMMUNITY_Node TS Config|Node TS Config]]
- [[_COMMUNITY_Ecosystem Bridge Animation|Ecosystem Bridge Animation]]
- [[_COMMUNITY_Dropdown Menu Component|Dropdown Menu Component]]
- [[_COMMUNITY_Chart Panel & Charts|Chart Panel & Charts]]
- [[_COMMUNITY_App Shell & Theme Sync|App Shell & Theme Sync]]
- [[_COMMUNITY_Kanban Panel|Kanban Panel]]
- [[_COMMUNITY_Chart Primitives|Chart Primitives]]
- [[_COMMUNITY_Airplane & Isochrone Cards|Airplane & Isochrone Cards]]
- [[_COMMUNITY_Sample Table Data|Sample Table Data]]
- [[_COMMUNITY_Map Data Store|Map Data Store]]
- [[_COMMUNITY_Demo Cursor Hooks|Demo Cursor Hooks]]
- [[_COMMUNITY_Data Table Panel|Data Table Panel]]
- [[_COMMUNITY_Layer Card Animations|Layer Card Animations]]
- [[_COMMUNITY_Debug & Start Screen|Debug & Start Screen]]
- [[_COMMUNITY_Package Overrides|Package Overrides]]
- [[_COMMUNITY_Dialog Component|Dialog Component]]
- [[_COMMUNITY_Sheet Component|Sheet Component]]
- [[_COMMUNITY_Theme Provider|Theme Provider]]
- [[_COMMUNITY_Styled Vector Layer|Styled Vector Layer]]
- [[_COMMUNITY_Point Cloud Split Script|Point Cloud Split Script]]
- [[_COMMUNITY_Stepper Component|Stepper Component]]
- [[_COMMUNITY_Sample Trail Data|Sample Trail Data]]
- [[_COMMUNITY_NPM Scripts|NPM Scripts]]
- [[_COMMUNITY_Tour Steps Spine|Tour Steps Spine]]
- [[_COMMUNITY_Table Component|Table Component]]
- [[_COMMUNITY_Swipe Compare View|Swipe Compare View]]
- [[_COMMUNITY_Realtime Chart|Realtime Chart]]
- [[_COMMUNITY_Incident Toasts|Incident Toasts]]
- [[_COMMUNITY_Isochrones Layer|Isochrones Layer]]
- [[_COMMUNITY_Preload Store & Bar|Preload Store & Bar]]
- [[_COMMUNITY_Card Component|Card Component]]
- [[_COMMUNITY_Point Cloud Card|Point Cloud Card]]
- [[_COMMUNITY_Sample Isochrone Data|Sample Isochrone Data]]
- [[_COMMUNITY_Sample POI Data|Sample POI Data]]
- [[_COMMUNITY_Sample Kanban Tasks|Sample Kanban Tasks]]
- [[_COMMUNITY_Sample Workspace Data|Sample Workspace Data]]
- [[_COMMUNITY_Avatar Component|Avatar Component]]
- [[_COMMUNITY_Layers Applied Card|Layers Applied Card]]
- [[_COMMUNITY_Gate Nudge & Mobile|Gate Nudge & Mobile]]
- [[_COMMUNITY_Import Simulation|Import Simulation]]
- [[_COMMUNITY_App Sidebar|App Sidebar]]
- [[_COMMUNITY_Hiking Chart|Hiking Chart]]
- [[_COMMUNITY_Sample Realtime Data|Sample Realtime Data]]
- [[_COMMUNITY_Post Hit Markers|Post Hit Markers]]
- [[_COMMUNITY_Point Cloud Debug Panel|Point Cloud Debug Panel]]
- [[_COMMUNITY_Tour Controller|Tour Controller]]
- [[_COMMUNITY_Traffic Flow Debug Panel|Traffic Flow Debug Panel]]
- [[_COMMUNITY_Animated Theme Toggler|Animated Theme Toggler]]
- [[_COMMUNITY_Smooth Cursor|Smooth Cursor]]
- [[_COMMUNITY_Tabs Component|Tabs Component]]
- [[_COMMUNITY_Sample Hike POIs|Sample Hike POIs]]
- [[_COMMUNITY_Sample Points Data|Sample Points Data]]
- [[_COMMUNITY_Web Manifest|Web Manifest]]
- [[_COMMUNITY_Airplane Debug Panel|Airplane Debug Panel]]
- [[_COMMUNITY_Tooltip Component|Tooltip Component]]
- [[_COMMUNITY_Buildings Height Chart|Buildings Height Chart]]
- [[_COMMUNITY_Sample Buildings Data|Sample Buildings Data]]
- [[_COMMUNITY_POI Popup Opener|POI Popup Opener]]
- [[_COMMUNITY_Sample Traffic Data|Sample Traffic Data]]
- [[_COMMUNITY_Onboarding Docs|Onboarding Docs]]
- [[_COMMUNITY_Hike POI Popup Opener|Hike POI Popup Opener]]
- [[_COMMUNITY_Image Preloader|Image Preloader]]
- [[_COMMUNITY_Tour Store|Tour Store]]
- [[_COMMUNITY_Base TS Config|Base TS Config]]
- [[_COMMUNITY_Badge Component|Badge Component]]
- [[_COMMUNITY_Button Component|Button Component]]
- [[_COMMUNITY_Scroll Area Component|Scroll Area Component]]
- [[_COMMUNITY_Readme Docs|Readme Docs]]
- [[_COMMUNITY_Input Component|Input Component]]
- [[_COMMUNITY_Progress Component|Progress Component]]
- [[_COMMUNITY_Separator Component|Separator Component]]
- [[_COMMUNITY_Skeleton Component|Skeleton Component]]
- [[_COMMUNITY_Slider Component|Slider Component]]

## God Nodes (most connected - your core abstractions)

1. `cn()` - 93 edges
2. `useTourStore` - 28 edges
3. `compilerOptions` - 18 edges
4. `compilerOptions` - 16 edges
5. `useMapDataStore` - 15 edges
6. `LayersPresentationModal()` - 11 edges
7. `useMap()` - 10 edges
8. `addAirplane3D()` - 10 edges
9. `scripts` - 9 edges
10. `PointCloudLayer` - 9 edges

## Surprising Connections (you probably didn't know these)

- `Solutions SIG (web application)` --semantically_similar_to--> `Guided Product-Demo Tour` [INFERRED] [semantically similar]
  index.html → CLAUDE.md
- `PlatformTile()` --calls--> `cn()` [INFERRED]
  src/charts/EcosystemBridge.tsx → src/lib/utils.ts
- `LayerCard()` --calls--> `cn()` [INFERRED]
  src/charts/LayersPresentationModal.tsx → src/lib/utils.ts
- `AnimatedThemeToggler()` --calls--> `cn()` [INFERRED]
  src/components/ui/animated-theme-toggler.tsx → src/lib/utils.ts
- `Avatar()` --calls--> `cn()` [INFERRED]
  src/components/ui/avatar.tsx → src/lib/utils.ts

## Import Cycles

- None detected.

## Hyperedges (group relationships)

- **Three layers of state/control** — claude_tour_controller, claude_tour_store, claude_map_data_store [EXTRACTED 1.00]
- **Incident storyline lifecycle** — context_poste_source, context_surcharge, context_fiche_intervention, context_retablissement [EXTRACTED 1.00]
- **Imperative map to React chart bridge** — claude_layer_modules, claude_map_data_store, claude_charts_panel [EXTRACTED 1.00]

## Communities (96 total, 18 thin omitted)

### Community 0 - "Point Cloud Choreography"

Cohesion: 0.06
Nodes (26): FOLLOW_START_LL, MODE_NAME, nearestT(), splineAt(), usePointCloudChoreography(), addPointCloud(), CLASS_INFO, CLASS_OTHER (+18 more)

### Community 1 - "Realtime & Tour Cursor"

Cohesion: 0.04
Nodes (32): createMeasureLabels(), Entry, MeasureLabels, Pt, createMeasureReveal(), MeasureReveal, createTourCursor(), createTourPulse() (+24 more)

### Community 2 - "3D Airplane Layer"

Cohesion: 0.09
Nodes (27): addAirplane3D(), addDayNight(), AirplaneHandle, AirplaneLayer, airplaneTuning, altitudeAt(), apexAt(), CDG (+19 more)

### Community 3 - "Point Cloud Prebake Script"

Cohesion: 0.05
Nodes (34): anchorLngLat, ASSET_DIR, cellCounts, cellOffsets, cells, classes, classHist, cursor (+26 more)

### Community 4 - "Layers Presentation Modal"

Cohesion: 0.06
Nodes (21): baseZones, CATEGORIES, Category, CATEGORY_LABELS, CATEGORY_LEGEND, CategoryId, cxMin, cxs (+13 more)

### Community 5 - "Sidebar UI Component"

Cohesion: 0.13
Nodes (28): cn(), Sidebar(), SidebarContent(), SidebarContext, SidebarContextProps, SidebarFooter(), SidebarGroup(), SidebarGroupAction() (+20 more)

### Community 6 - "Basemap Prewarm"

Cohesion: 0.09
Nodes (17): BasemapId, BASEMAPS, AnySource, CADASTRE_TPL, Camera, cancelPrewarm(), DEM_TPL, GLOBE_OVERVIEW_CAM (+9 more)

### Community 7 - "shadcn Config"

Cohesion: 0.09
Nodes (22): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+14 more)

### Community 8 - "Traffic Flow Layer"

Cohesion: 0.11
Nodes (15): buildRibbon(), catmullRom(), COLOR_FLUID, COLOR_JAM, COLOR_MED, compileShader(), composeMatrix(), createProgram() (+7 more)

### Community 9 - "Project Architecture Docs"

Cohesion: 0.11
Nodes (21): ChartsPanel, Guided Product-Demo Tour, Import Gate, Imperative Layer Modules, MapCanvas / MapContext, map-data-store (Zustand), TourController (driver.js), STEPS Tour Spine (+13 more)

### Community 10 - "Runtime Dependencies"

Cohesion: 0.09
Nodes (22): dependencies, class-variance-authority, clsx, driver.js, framer-motion, gsap, @gsap/react, lucide-react (+14 more)

### Community 11 - "App TS Config"

Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+12 more)

### Community 12 - "Tech Stack Diagram"

Cohesion: 0.12
Nodes (13): useTechStackReveal(), COS_X, COS_Z, diamondPoints(), face(), GlyphProps, Layer, LAYERS (+5 more)

### Community 13 - "3D Buildings Layer"

Cohesion: 0.13
Nodes (15): addBuildings3D(), BASE_COLOR_EXPR, BASEMAP_BUILDING_LAYERS, DIMMED_IDS, distanceMeters(), findBasemapPlanetSource(), geometryTouchesSpotlight(), HEIGHT_COLOR_EXPR (+7 more)

### Community 14 - "Dev Dependencies"

Cohesion: 0.11
Nodes (19): devDependencies, @babel/core, babel-plugin-react-compiler, @gltf-transform/cli, @loaders.gl/core, @loaders.gl/las, @math.gl/types, @rolldown/plugin-babel (+11 more)

### Community 15 - "POI Status & Popups"

Cohesion: 0.12
Nodes (11): usePoiGateNudge(), usePoiPopupReveal(), StatusRefs, usePoiStatusTransition(), HikePoiPopup(), DATE_FMT, formatDate(), POIPopup() (+3 more)

### Community 16 - "Sample Vector Data"

Cohesion: 0.16
Nodes (16): blockRing(), CATEGORIES, fieldRing(), makeRing(), makeRng(), naturalRing(), plotRing(), Pt (+8 more)

### Community 17 - "Node TS Config"

Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+9 more)

### Community 18 - "Ecosystem Bridge Animation"

Cohesion: 0.12
Nodes (10): useEcosystemBeams(), useEcosystemReveal(), Conduit, EcosystemBridge(), FORMATS, GlyphProps, Platform, PLATFORMS (+2 more)

### Community 19 - "Dropdown Menu Component"

Cohesion: 0.12
Nodes (9): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+1 more)

### Community 20 - "Chart Panel & Charts"

Cohesion: 0.18
Nodes (9): BasemapChart(), IDS, META, config, HeatmapChart(), FACTS, HighlightChart(), MeasureChart() (+1 more)

### Community 21 - "App Shell & Theme Sync"

Cohesion: 0.18
Nodes (8): useThemeFlipCursor(), MobileSidebarTourSync(), SIDEBAR_STEP_IDS, ThemeFlipCursor(), Overlays(), Shell(), TourTraceCursor(), useTourStore

### Community 22 - "Kanban Panel"

Cohesion: 0.15
Nodes (5): Opts, useKanbanCursor(), KanbanPanel(), LAYOUT_SPRING, STATUS_COLOR

### Community 23 - "Chart Primitives"

Cohesion: 0.18
Nodes (10): ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartTooltipContent(), INITIAL_DIMENSION, THEMES (+2 more)

### Community 24 - "Airplane & Isochrone Cards"

Cohesion: 0.17
Nodes (6): useRtScriptedCursor(), AirplaneCard(), BAND_COLOR, IsochroneChart(), RtScriptedCursor(), useMapDataStore

### Community 25 - "Sample Table Data"

Cohesion: 0.17
Nodes (10): allX, allY, ATTRS, centermost, DataRow, ORDERED_ZONES, RowAttrs, RowStatus (+2 more)

### Community 26 - "Map Data Store"

Cohesion: 0.17
Nodes (10): Actions, FlightStats, MeasurePoint, NEXT_STATUS, PointCloudClass, PointCloudColorMode, PointCloudDangerPoi, PointCloudStats (+2 more)

### Community 27 - "Demo Cursor Hooks"

Cohesion: 0.18
Nodes (6): Pt, useCursorAim(), useDemoCursorClick(), useDemoCursorDrop(), useLayersButtonCursor(), LayersButton()

### Community 28 - "Data Table Panel"

Cohesion: 0.18
Nodes (4): TARGET_IDS, useDataTableCursor(), DataTablePanel(), STATUS

### Community 29 - "Layer Card Animations"

Cohesion: 0.18
Nodes (6): useLayerCardsStagger(), useLayerSpotlight(), useModalExit(), useModalHeaderReveal(), useModalReveal(), LayersPresentationModal()

### Community 30 - "Debug & Start Screen"

Cohesion: 0.20
Nodes (9): useMapMaybe(), AirplaneDebugPanel(), CameraReadout(), CameraState, DebugPanel(), CAPS, StartScreen(), STEPS (+1 more)

### Community 31 - "Package Overrides"

Cohesion: 0.18
Nodes (10): allowScripts, sharp@0.34.5, name, overrides, vite, vitest, packageManager, private (+2 more)

### Community 32 - "Dialog Component"

Cohesion: 0.18
Nodes (6): DialogContent(), DialogDescription(), DialogFooter(), DialogHeader(), DialogOverlay(), DialogTitle()

### Community 33 - "Sheet Component"

Cohesion: 0.18
Nodes (6): SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetTitle()

### Community 34 - "Theme Provider"

Cohesion: 0.20
Nodes (7): initialState, Theme, ThemeProviderContext, ThemeProviderProps, ThemeProviderState, useTheme(), TourThemeSync()

### Community 35 - "Styled Vector Layer"

Cohesion: 0.20
Nodes (6): CATEGORY_COLORS, CATEGORY_STROKE, categoryColor, categoryStroke, DIM, HOVER

### Community 36 - "Point Cloud Split Script"

Cohesion: 0.20
Nodes (7): chunks, HERE, META, OUT_DIR, POINTS_PER_CHUNK, SRC, sum

### Community 37 - "Stepper Component"

Cohesion: 0.27
Nodes (9): StepItemContext, Stepper(), StepperContext, StepperIndicator(), StepperItem(), StepperSeparator(), StepperTitle(), StepState (+1 more)

### Community 38 - "Sample Trail Data"

Cohesion: 0.22
Nodes (8): CHAMONIX_TRAIL, COORDS, RAW, TRAIL_DPLUS_M, TRAIL_MIN_M, TRAIL_PROFILE, TRAIL_SUMMIT_M, TrailPoint

### Community 39 - "NPM Scripts"

Cohesion: 0.22
Nodes (9): scripts, build, build:plane, check, dev, fmt, format, lint (+1 more)

### Community 40 - "Tour Steps Spine"

Cohesion: 0.22
Nodes (7): AppliedLayerId, ChartKind, HTA_HOVER_IDS, HTA_IDS, StepContext, THEME_FLIP_INDEX, TourStep

### Community 41 - "Table Component"

Cohesion: 0.22
Nodes (8): Table(), TableBody(), TableCaption(), TableCell(), TableFooter(), TableHead(), TableHeader(), TableRow()

### Community 42 - "Swipe Compare View"

Cohesion: 0.29
Nodes (4): Opts, useSwipeAutoDrag(), SWIPE_VIEW, SwipeCompare()

### Community 43 - "Realtime Chart"

Cohesion: 0.32
Nodes (6): CEILING, chartConfig, prefersReduced(), RealtimeChart(), shortName(), STATUS_COLOR

### Community 44 - "Incident Toasts"

Cohesion: 0.29
Nodes (3): dismissRecoveryToast(), dismissSurchargeToast(), htaLeave()

### Community 45 - "Isochrones Layer"

Cohesion: 0.39
Nodes (6): addIsochrones(), BANDS, fillId(), IsochroneStats, lineId(), removeIsochrones()

### Community 46 - "Preload Store & Bar"

Cohesion: 0.25
Nodes (4): Actions, State, usePreloadStore, PreloadBar()

### Community 47 - "Card Component"

Cohesion: 0.25
Nodes (7): Card(), CardAction(), CardContent(), CardDescription(), CardFooter(), CardHeader(), CardTitle()

### Community 48 - "Point Cloud Card"

Cohesion: 0.33
Nodes (4): formatPoints(), MODES, PointCloudCard(), classInfo()

### Community 49 - "Sample Isochrone Data"

Cohesion: 0.29
Nodes (5): BANDS, ISOCHRONE_CENTER, IsochroneMinutes, IsochroneProps, ISOCHRONES

### Community 50 - "Sample POI Data"

Cohesion: 0.29
Nodes (6): CATEGORY_META, LineProps, POICategory, POIProps, SAMPLE_HTA_LINES, SAMPLE_POIS

### Community 51 - "Sample Kanban Tasks"

Cohesion: 0.29
Nodes (6): KANBAN_COLUMNS, SAMPLE_TASKS, Task, TaskPriority, TaskStatus, WEEK_DAYS

### Community 52 - "Sample Workspace Data"

Cohesion: 0.29
Nodes (6): CURRENT_USER, DATASETS, LAYERS, WORKSPACE, WorkspaceDataset, WorkspaceLayer

### Community 53 - "Avatar Component"

Cohesion: 0.29
Nodes (6): Avatar(), AvatarBadge(), AvatarFallback(), AvatarGroup(), AvatarGroupCount(), AvatarImage()

### Community 54 - "Layers Applied Card"

Cohesion: 0.33
Nodes (4): useAppliedCardReveal(), AppliedLayerDef, LayersAppliedCard(), REGISTRY

### Community 55 - "Gate Nudge & Mobile"

Cohesion: 0.33
Nodes (4): useGateUnlockNudge(), ChartsPanel(), useIsMobile(), TourController()

### Community 56 - "Import Simulation"

Cohesion: 0.33
Nodes (4): useImportPaneReveal(), ImportSimConfig, useImportSimulation(), ImportPane()

### Community 57 - "App Sidebar"

Cohesion: 0.33
Nodes (4): useSidebarReveal(), AppSidebar(), NAV, NavItem

### Community 58 - "Hiking Chart"

Cohesion: 0.40
Nodes (4): chartConfig, HikingChart(), prefersReduced(), altAtFraction()

### Community 59 - "Sample Realtime Data"

Cohesion: 0.33
Nodes (5): FleetRoute, PosteCfg, RT_POSTE_CONFIG, RT_ROUTES, RT_TOTAL_CAP_MVA

### Community 60 - "Post Hit Markers"

Cohesion: 0.40
Nodes (4): buildNode(), centered(), Node, PostHitMarkers

### Community 61 - "Point Cloud Debug Panel"

Cohesion: 0.33
Nodes (5): DEFAULTS, Knob, KNOBS, ParamKey, PointCloudDebugPanel()

### Community 62 - "Tour Controller"

Cohesion: 0.40
Nodes (3): applyBasemap(), DriverInstance, waitForStyle()

### Community 63 - "Traffic Flow Debug Panel"

Cohesion: 0.33
Nodes (4): DEFAULTS, Knob, KNOBS, ParamKey

### Community 64 - "Animated Theme Toggler"

Cohesion: 0.40
Nodes (5): AnimatedThemeToggler(), AnimatedThemeTogglerProps, getThemeTransitionClipPaths(), polygonCollapsed(), TransitionVariant

### Community 66 - "Tabs Component"

Cohesion: 0.40
Nodes (5): Tabs(), TabsContent(), TabsList(), tabsListVariants, TabsTrigger()

### Community 67 - "Sample Hike POIs"

Cohesion: 0.40
Nodes (4): HIKE_POIS, HikePoi, HikePoiResolved, RAW_POIS

### Community 68 - "Sample Points Data"

Cohesion: 0.40
Nodes (3): CLUSTERS, HEATMAP_CITY_COUNTS, SAMPLE_POINTS

### Community 69 - "Web Manifest"

Cohesion: 0.40
Nodes (4): chunks, count, encoding, version

### Community 70 - "Airplane Debug Panel"

Cohesion: 0.40
Nodes (4): DEFAULTS, Knob, KNOBS, ParamKey

### Community 72 - "Buildings Height Chart"

Cohesion: 0.50
Nodes (3): BUCKET_BLUES, BUCKETS, BuildingsHeightChart()

### Community 76 - "Onboarding Docs"

Cohesion: 0.67
Nodes (3): SEO / Structured Data Metadata, context7 MCP Server, DaVikingCode (team)

## Knowledge Gaps

- **424 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+419 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Sidebar UI Component` to `Layers Presentation Modal`, `Ecosystem Bridge Animation`, `Dropdown Menu Component`, `Chart Primitives`, `Layer Card Animations`, `Dialog Component`, `Sheet Component`, `Stepper Component`, `Table Component`, `Card Component`, `Avatar Component`, `Layers Applied Card`, `Animated Theme Toggler`, `Tabs Component`, `Tooltip Component`, `Badge Component`, `Button Component`, `Scroll Area Component`, `Input Component`, `Progress Component`, `Separator Component`, `Skeleton Component`, `Slider Component`?**
  _High betweenness centrality (0.150) - this node is a cross-community bridge._
- **Why does `useTourStore` connect `App Shell & Theme Sync` to `Point Cloud Choreography`, `Theme Provider`, `Tech Stack Diagram`, `Ecosystem Bridge Animation`, `Tour Store`, `Chart Panel & Charts`, `Point Cloud Debug Panel`, `Kanban Panel`, `Gate Nudge & Mobile`, `Airplane & Isochrone Cards`, `Layers Applied Card`, `Import Simulation`, `Demo Cursor Hooks`, `Data Table Panel`, `Layer Card Animations`, `Debug & Start Screen`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **Why does `LayersPresentationModal()` connect `Layer Card Animations` to `Layers Presentation Modal`, `Sidebar UI Component`, `Chart Panel & Charts`, `App Shell & Theme Sync`, `Demo Cursor Hooks`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Are the 92 inferred relationships involving `cn()` (e.g. with `PlatformTile()` and `LayersAppliedCard()`) actually correct?**
  _`cn()` has 92 INFERRED edges - model-reasoned connections that need verification._
- **Are the 27 inferred relationships involving `useTourStore` (e.g. with `useRtScriptedCursor()` and `useThemeFlipCursor()`) actually correct?**
  _`useTourStore` has 27 INFERRED edges - model-reasoned connections that need verification._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _425 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Point Cloud Choreography` be split into smaller, more focused modules?**
  _Cohesion score 0.055272108843537414 - nodes in this community are weakly interconnected._
