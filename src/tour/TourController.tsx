import { useEffect, useRef } from 'react'
import { driver } from 'driver.js'
import { useMap } from '@/map/MapContext'
import { useTourStore } from '@/store/tour-store'
import { STEPS } from './steps'
import { BASEMAPS, type BasemapId } from '@/map/basemaps'
import { startPrewarm, cancelPrewarm } from '@/map/prewarm'
import { useGateUnlockNudge } from '@/hooks/animations/useGateUnlockNudge'

type DriverInstance = ReturnType<typeof driver>

// Gates that block the Next button until a step's interaction completes.
function isStepLocked(
  idx: number,
  st: {
    importDone: boolean
    dropDone: boolean
    drawDone: boolean
    measureDone: boolean
    layersPanelOpen: boolean
    incidentClicked: boolean
    flying: boolean
  },
): boolean {
  // Pendant un vol caméra, « Suivant » est verrouillé partout : pas de zapping
  // tant que la caméra n'a pas atterri sur l'étape.
  if (st.flying) return true
  const id = STEPS[idx]?.id
  if (id === 'layers-import') return !st.importDone
  // Verrouillé tant que le faux curseur n'a pas déposé le fichier (avance auto).
  if (id === 'layers-import-pick') return !st.dropDone
  if (id === 'draw-analysis') return !st.drawDone
  if (id === 'measure') return !st.measureDone
  // Bloque « Suivant » tant que le faux curseur n'a pas ouvert le panneau Couches.
  if (id === 'layers-overview') return !st.layersPanelOpen
  // Bloque tant que le faux curseur n'a pas cliqué le poste en surcharge (fiche).
  if (id === 'rt-todo') return !st.incidentClicked
  return false
}

function waitForStyle(map: maplibregl.Map): Promise<void> {
  return new Promise((resolve) => {
    if (map.isStyleLoaded()) return resolve()
    map.once('idle', () => resolve())
  })
}

export async function applyBasemap(map: maplibregl.Map, id: BasemapId) {
  map.setStyle(BASEMAPS[id].style as never, { diff: false })
  await new Promise<void>((resolve) => map.once('styledata', () => resolve()))
  await waitForStyle(map)
}

export function TourController() {
  const map = useMap()
  const started = useTourStore((s) => s.started)
  const currentStep = useTourStore((s) => s.currentStep)
  const setStep = useTourStore((s) => s.setStep)
  const setBasemapStore = useTourStore((s) => s.setBasemap)
  const driverRef = useRef<DriverInstance | null>(null)
  const prevStepRef = useRef<number>(-1)
  const drivingRef = useRef<boolean>(false)
  const nudge = useGateUnlockNudge()

  useEffect(() => {
    if (driverRef.current) return
    const d = driver({
      showProgress: true,
      allowClose: false,
      overlayOpacity: 0.35,
      stagePadding: 6,
      popoverClass: 'gp-tour',
      progressText: 'Étape {{current}} / {{total}}',
      nextBtnText: 'Suivant',
      prevBtnText: 'Précédent',
      doneBtnText: 'Terminer',
      steps: STEPS.map((s) => ({
        element: s.element ?? '#map-canvas',
        popover: {
          title: s.title,
          description: s.description,
          side: 'right',
          align: 'start',
          // The import modal is centered and the popover would land on top of
          // its content — pin this step's popover to the bottom-center instead.
          // Same for the ecosystem/interop and techstack diagrams (also centered
          // full-screen overlays whose content the popover would otherwise cover).
          ...(s.id === 'layers-import' || s.id === 'ecosystem' || s.id === 'techstack'
            ? { popoverClass: 'gp-tour gp-tour-bottom' }
            : {}),
        },
      })),
      // Gate: block advancing past gated steps until their interaction finishes
      // (import demo done, or auto-draw zone closed). Fires for both the Suivant
      // button and the ArrowRight key, so it's the single source of truth.
      onNextClick: (_el, _step, opts) => {
        const idx = opts.state.activeIndex ?? 0
        const blocked = isStepLocked(idx, useTourStore.getState())
        if (blocked) return
        const d = driverRef.current
        if (!d) return
        if (d.hasNextStep()) d.moveNext()
        else d.destroy()
      },
      onPopoverRender: (popover, opts) => {
        const total = STEPS.length
        const active = opts.state.activeIndex ?? 0
        // Lock the Next button on entry to a gated step.
        const locked = isStepLocked(active, useTourStore.getState())
        popover.nextButton.disabled = locked
        popover.nextButton.classList.toggle('driver-popover-btn-disabled', locked)
        // Step Catalogue : popover masquée tant que « Suivant » est verrouillé
        // (le faux curseur ouvre d'abord le panneau), révélée au déverrouillage.
        popover.wrapper.classList.toggle(
          'gp-tour-await',
          STEPS[active]?.id === 'layers-overview' && locked,
        )
        const bar = document.createElement('div')
        bar.className = 'gp-tour-stepper'
        bar.setAttribute('role', 'progressbar')
        bar.setAttribute('aria-valuemin', '1')
        bar.setAttribute('aria-valuemax', String(total))
        bar.setAttribute('aria-valuenow', String(active + 1))
        for (let i = 0; i < total; i++) {
          const dot = document.createElement('span')
          dot.className = 'gp-tour-stepper-dot'
          dot.dataset.state = i < active ? 'completed' : i === active ? 'active' : 'inactive'
          bar.appendChild(dot)
        }
        popover.wrapper.insertBefore(bar, popover.footer)
      },
      onHighlightStarted: (_el, _step, opts) => {
        const idx = opts.state.activeIndex ?? 0
        // Verrouille « Suivant » dès l'entrée (avant onPopoverRender) ; le vol
        // déclenché par l'effet de transition lèvera le verrou à l'atterrissage
        // (moveend), ou immédiatement pour une transition instantanée.
        useTourStore.getState().setFlying(true)
        setStep(idx)
        // Re-lock on (re-)entering a gated step so a stale "done" from a previous
        // visit can't leave Next unlocked before the demo/animation replays.
        if (STEPS[idx]?.id === 'layers-import') useTourStore.getState().setImportDone(false)
        if (STEPS[idx]?.id === 'layers-import-pick') useTourStore.getState().setDropDone(false)
        if (STEPS[idx]?.id === 'draw-analysis') useTourStore.getState().setDrawDone(false)
        if (STEPS[idx]?.id === 'measure') useTourStore.getState().setMeasureDone(false)
        // Re-ferme le panneau Couches au (re)passage sur le step pour rejouer le
        // faux curseur (comme le re-lock measure/draw au retour arrière).
        if (STEPS[idx]?.id === 'layers-overview') useTourStore.getState().setLayersPanelOpen(false)
        // Re-verrouille le clic du poste en surcharge pour rejouer le faux curseur.
        if (STEPS[idx]?.id === 'rt-todo') useTourStore.getState().setIncidentClicked(false)
      },
      onHighlighted: (_el, _step, opts) => {
        // Backup: ensure Zustand step stays in sync even on same-element transitions
        // (driver.js may skip a full transition cycle when 2 consecutive steps share the same element)
        const idx = opts.state.activeIndex ?? 0
        if (useTourStore.getState().currentStep !== idx) setStep(idx)
      },
      onDestroyed: () => {
        drivingRef.current = false
        useTourStore.getState().reset()
      },
    })
    driverRef.current = d
  }, [setStep])

  // Bridge the dev DebugPanel's "jump to step" buttons to driver.js. This lives in
  // its own effect — NOT the driver-creation effect above — because that one
  // early-returns on re-run (its `if (driverRef.current) return` guard). Under
  // StrictMode's mount→unmount→mount, the first mount registers the bridge, the
  // unmount cleanup nulls it, then the second mount's guard bails before
  // re-registering — leaving `jumpToStep` null and every DebugPanel button
  // `disabled`. A dedicated effect always re-registers after the remount.
  useEffect(() => {
    const d = driverRef.current
    if (!d) return
    useTourStore.getState().setJumpToStep((i: number) => {
      if (!drivingRef.current) {
        drivingRef.current = true
        d.drive(i)
        return
      }
      useTourStore.getState().setStep(i)
      try {
        d.moveTo(i)
      } catch (e) {
        console.warn('[debug] driver.moveTo failed', e)
      }
    })
    return () => {
      useTourStore.getState().setJumpToStep(null)
    }
  }, [])

  useEffect(() => {
    const d = driverRef.current
    if (!d) return
    if (started && !drivingRef.current) {
      drivingRef.current = true
      d.drive(0)
      // Background-warm the HTTP cache for every upcoming step so the camera
      // flights land instantly instead of fetching tiles on "Suivant".
      startPrewarm(map, STEPS)
    } else if (!started && drivingRef.current) {
      d.destroy()
      drivingRef.current = false
      cancelPrewarm()
    }
  }, [started, map])

  // Stop any in-flight prewarming when the controller unmounts.
  useEffect(() => () => cancelPrewarm(), [])

  // Keep the Next button lock in sync as a gated step completes (or the step
  // changes), and nudge it with a pulse the moment it unlocks.
  useEffect(() => {
    if (!started) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let prevLocked = false
    const apply = (
      st: {
        importDone: boolean
        dropDone: boolean
        drawDone: boolean
        measureDone: boolean
        layersPanelOpen: boolean
        incidentClicked: boolean
        flying: boolean
      },
      step: number,
    ) => {
      const id = STEPS[step]?.id
      const isGated =
        id === 'layers-import' ||
        id === 'draw-analysis' ||
        id === 'measure' ||
        id === 'layers-overview' ||
        id === 'rt-todo'
      const locked = isStepLocked(step, st)
      const btn = document.querySelector<HTMLButtonElement>('.driver-popover-next-btn')
      if (btn) {
        btn.disabled = locked
        btn.classList.toggle('driver-popover-btn-disabled', locked)
        if (!reduced && prevLocked && !locked && isGated) {
          nudge(btn)
        }
      }
      // Révèle / re-masque la popover du step Catalogue selon l'état du verrou.
      document
        .querySelector('.driver-popover')
        ?.classList.toggle('gp-tour-await', id === 'layers-overview' && locked)
      prevLocked = locked
    }
    const st = useTourStore.getState()
    apply(st, st.currentStep)
    return useTourStore.subscribe((s) => apply(s, s.currentStep))
  }, [started, nudge])

  useEffect(() => {
    if (!started) return
    const prev = prevStepRef.current
    const cur = currentStep
    if (prev === cur) return

    let cancelled = false
    // Teardown of the previous step deferred until a pan flight lands; run on
    // cleanup too so an interrupted flight never leaks its layers.
    let leaveOnCleanup: (() => void) | null = null
    const setCinematic = useTourStore.getState().setCinematic
    ;(async () => {
      // Pause idle rotation while we're traveling.
      setCinematic(false)

      const prevStep = prev >= 0 && prev < STEPS.length ? STEPS[prev] : undefined
      const step = STEPS[cur]
      // Reset padding each step (it persists on the map) so only steps that
      // opt in get an offset center.
      const padding = {
        top: step.camera.padding?.top ?? 0,
        bottom: step.camera.padding?.bottom ?? 0,
        left: step.camera.padding?.left ?? 0,
        right: step.camera.padding?.right ?? 0,
      }
      const desiredBm = step.basemap
      const bmWillChange = !!desiredBm && useTourStore.getState().basemap !== desiredBm
      // Going backward (Prev) should glide back to the previous step rather than
      // replay its zoom-in intro. We pan instead — but only when no basemap swap
      // is needed, since a swap means setStyle() (a visible reload flash).
      const backPan = prev > cur && !bmWillChange
      const fly = backPan ? undefined : step.flyIn
      const pan = step.pan ?? (backPan ? { duration: step.flyIn?.duration ?? 4200 } : undefined)

      // Non-pan transitions tear down the previous step now. Pan flights keep its
      // layers up during the flight and remove them on arrival (moveend) so
      // nothing pops out before the camera starts moving.
      if (!pan) prevStep?.onLeave?.(map)

      // Jump to the destination BEFORE switching basemap so the new style streams
      // in at the right location — otherwise the previous step's location flashes
      // briefly under the new style before we snap away. `pan` is the exception:
      // it animates FROM the current camera, so we must not pre-jump.
      if (!pan) {
        map.jumpTo({
          center: step.camera.center,
          zoom: fly ? fly.fromZoom : step.camera.zoom,
          pitch: step.camera.pitch ?? 0,
          bearing: step.camera.bearing ?? 0,
          padding,
        })
      }

      if (bmWillChange && desiredBm) {
        await applyBasemap(map, desiredBm)
        setBasemapStore(desiredBm)
      }
      if (cancelled) return

      if (pan) {
        // Smooth eased flight from wherever the previous step left the camera.
        await waitForStyle(map)
        if (cancelled) return

        // Opt-in: tear down the previous step BEFORE the flight (e.g. cadastre,
        // whose parcel lines shouldn't drag across the whole pan). Otherwise the
        // teardown is deferred to moveend below so layers stay up during the vol.
        if (prevStep?.leaveBeforePan) prevStep.onLeave?.(map)

        // Scripted-animation steps (enterOnSettle) must start once the camera has
        // landed, otherwise the trace plays mid-flight (off-screen) and looks like
        // it never replayed. Their onEnter runs in the moveend handler below.
        if (!step.enterOnSettle) step.onEnter?.(map, { setBasemap: setBasemapStore })
        prevStepRef.current = cur
        map.flyTo({
          center: step.camera.center,
          zoom: step.camera.zoom,
          pitch: step.camera.pitch ?? 0,
          bearing: step.camera.bearing ?? 0,
          padding,
          duration: pan.duration ?? 4200,
          curve: 1.42,
          essential: true,
        })
        // Tear down the previous step (and start the idle orbit) only once we
        // land — removing its layers up front pops them out before the camera
        // moves, and setBearing mid-flight would fight the flyTo. (Skipped when
        // leaveBeforePan already cleaned it up above.)
        if (!prevStep?.leaveBeforePan) leaveOnCleanup = () => prevStep?.onLeave?.(map)
        map.once('moveend', () => {
          leaveOnCleanup = null
          // Clean the previous step FIRST so a deferred onEnter rebuilds onto a
          // clean slate (e.g. the shared gp-tour-pulse layer).
          if (!prevStep?.leaveBeforePan) prevStep?.onLeave?.(map)
          if (cancelled) return
          // Atterri : déverrouille « Suivant ».
          useTourStore.getState().setFlying(false)
          if (step.enterOnSettle) step.onEnter?.(map, { setBasemap: setBasemapStore })
          if (step.cinematic) setCinematic(true)
        })
        return
      }

      if (fly) {
        // Add the layer wide, then fly in so it pops in across zoom levels.
        await waitForStyle(map)
        if (cancelled) return

        step.onEnter?.(map, { setBasemap: setBasemapStore })
        map.flyTo({
          center: step.camera.center,
          zoom: step.camera.zoom,
          pitch: step.camera.pitch ?? 0,
          bearing: step.camera.bearing ?? 0,
          padding,
          duration: fly.duration ?? 4000,
          curve: 1.4,
          essential: true,
        })
        prevStepRef.current = cur
        if (step.cinematic) setCinematic(true)
        // Atterri : déverrouille « Suivant ».
        map.once('moveend', () => {
          if (cancelled) return
          useTourStore.getState().setFlying(false)
        })
        return
      }

      await waitForStyle(map)
      if (cancelled) return

      step.onEnter?.(map, { setBasemap: setBasemapStore })
      prevStepRef.current = cur
      // Transition instantanée (jumpTo) : rien à attendre, déverrouille tout de suite.
      useTourStore.getState().setFlying(false)

      // Resume idle rotation if the destination step requested it.
      if (step.cinematic) setCinematic(true)
    })()

    return () => {
      cancelled = true
      leaveOnCleanup?.()
    }
  }, [currentStep, started, map, setBasemapStore])

  return null
}
