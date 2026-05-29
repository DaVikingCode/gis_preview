import type { RefObject } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

type ImportSimConfig = {
  sizeKo: number
  features: number
  stageStatus: Record<string, string>
  sourceLineCount: number
}

// Scripted import simulation: upload → reprojection → schema → spatial index →
// render. Drives the tour gate (importDone) so "Suivant" only unlocks once the
// layer has "landed" on the map. Targets are queried within the pane via
// gsap.utils.selector and the live counters are written imperatively. Respects
// prefers-reduced-motion (jumps straight to the finished frame).
export function useImportSimulation(
  paneRef: RefObject<HTMLDivElement | null>,
  setImportDone: (v: boolean) => void,
  config: ImportSimConfig,
) {
  const { sizeKo, features, stageStatus, sourceLineCount } = config

  useGSAP(
    () => {
      const root = paneRef.current
      if (!root) return
      const q = gsap.utils.selector(root)
      const statusEl = q('[data-up-status]')[0] as HTMLElement | undefined
      const pctEl = q('[data-up-pct]')[0] as HTMLElement | undefined
      const sizeEl = q('[data-up-size]')[0] as HTMLElement | undefined
      const featEl = q('[data-feat]')[0] as HTMLElement | undefined
      const srcCountEl = q('[data-src-count]')[0] as HTMLElement | undefined
      const codeBody = q('[data-src-body]')[0] as HTMLElement | undefined

      const writeProgress = (v: number) => {
        if (pctEl) pctEl.textContent = `${Math.round(v)}%`
        if (sizeEl) sizeEl.textContent = `${Math.round((v / 100) * sizeKo)} / ${sizeKo} Ko`
      }
      const writeFeat = (v: number) => {
        if (featEl) featEl.textContent = `${Math.round(v)} entités`
      }
      const writeSrcCount = (v: number) => {
        if (srcCountEl) srcCountEl.textContent = `${Math.round(v)} entités`
      }

      setImportDone(false)

      const mm = gsap.matchMedia()
      mm.add(
        {
          motion: '(prefers-reduced-motion: no-preference)',
          reduced: '(prefers-reduced-motion: reduce)',
        },
        (context) => {
          if (context.conditions?.reduced) {
            gsap.set('[data-up-card]', { opacity: 1, y: 0, scale: 1 })
            gsap.set('[data-up-bar]', { scaleX: 1, backgroundColor: '#10b981' })
            gsap.set('[data-up-shimmer]', { opacity: 0 })
            gsap.set('[data-up-spinner]', { autoAlpha: 0 })
            gsap.set('[data-stage]', { opacity: 1 })
            gsap.set('[data-spin]', { display: 'none' })
            gsap.set('[data-check]', { opacity: 1, scale: 1 })
            gsap.set('[data-line]', { scaleY: 1 })
            gsap.set('[data-node]', { borderColor: 'rgba(16,185,129,0.55)' })
            gsap.set('[data-zone]', { strokeDashoffset: 0, fillOpacity: 0.5 })
            gsap.set('[data-row]', { opacity: 1, x: 0 })
            gsap.set('[data-success]', { opacity: 1, y: 0 })
            gsap.set('[data-src-line]', { opacity: 1, y: 0 })
            gsap.set('[data-src-caret]', { opacity: 0 })
            gsap.set('[data-src-done]', { opacity: 1, y: 0 })
            writeProgress(100)
            writeFeat(features)
            writeSrcCount(features)
            if (statusEl) statusEl.textContent = 'Couche ajoutée'
            setImportDone(true)
            return
          }

          // Idle frame.
          gsap.set('[data-up-card]', { opacity: 0, y: -10, scale: 0.98 })
          gsap.set('[data-up-bar]', {
            scaleX: 0,
            transformOrigin: 'left center',
            backgroundColor: '#d946ef',
          })
          gsap.set('[data-up-shimmer]', { opacity: 1, xPercent: -130 })
          gsap.set('[data-stage]', { opacity: 0.4 })
          gsap.set('[data-spin]', { display: 'none' })
          gsap.set('[data-check]', { opacity: 0, scale: 0.4 })
          gsap.set('[data-line]', { scaleY: 0, transformOrigin: 'top center' })
          gsap.set('[data-node]', { borderColor: 'rgba(255,255,255,0.12)' })
          gsap.set('[data-up-spinner]', { autoAlpha: 1 })
          gsap.set('[data-zone]', { strokeDasharray: 1, strokeDashoffset: 1, fillOpacity: 0 })
          gsap.set('[data-row]', { opacity: 0, x: -8 })
          gsap.set('[data-success]', { opacity: 0, y: 8 })
          gsap.set('[data-src-line]', { opacity: 0, y: 3 })
          gsap.set('[data-src-caret]', { opacity: 0 })
          gsap.set('[data-src-done]', { opacity: 0, y: 4 })
          if (codeBody) codeBody.scrollTop = 0
          writeProgress(0)
          writeFeat(0)
          writeSrcCount(0)
          if (statusEl) statusEl.textContent = 'En attente'

          const shimmer = gsap.to('[data-up-shimmer]', {
            xPercent: 130,
            duration: 0.9,
            ease: 'power1.inOut',
            repeat: -1,
            paused: true,
          })

          const caretBlink = gsap.to('[data-src-caret]', {
            opacity: 0,
            duration: 0.45,
            ease: 'none',
            repeat: -1,
            yoyo: true,
            paused: true,
          })

          const activate = (key: string) => {
            gsap.to(q(`[data-stage="${key}"]`), { opacity: 1, duration: 0.25 })
            gsap.set(q(`[data-spin="${key}"]`), { display: 'inline-flex' })
            gsap.to(q(`[data-node="${key}"]`), {
              borderColor: 'rgba(217,70,239,0.6)',
              duration: 0.2,
            })
            if (statusEl) statusEl.textContent = stageStatus[key] ?? ''
          }
          const complete = (key: string) => {
            gsap.set(q(`[data-spin="${key}"]`), { display: 'none' })
            gsap.to(q(`[data-check="${key}"]`), {
              opacity: 1,
              scale: 1,
              duration: 0.3,
              ease: 'back.out(2)',
            })
            gsap.to(q(`[data-node="${key}"]`), {
              borderColor: 'rgba(16,185,129,0.6)',
              duration: 0.3,
            })
            gsap.to(q(`[data-line="${key}"]`), { scaleY: 1, duration: 0.4, ease: 'power1.inOut' })
          }

          const prog = { v: 0 }
          const feat = { v: 0 }
          const srcCount = { v: 0 }
          const srcMaxScroll = codeBody
            ? Math.max(0, codeBody.scrollHeight - codeBody.clientHeight)
            : 0

          const tl = gsap.timeline({ delay: 0.35 })
          // file card drops in
          tl.to('[data-up-card]', {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.45,
            ease: 'back.out(1.6)',
          })
            // 1 — upload: bar fills + counter ticks + shimmer sweeps + raw file streams in
            .add(() => {
              activate('upload')
              shimmer.play()
              gsap.set('[data-src-caret]', { opacity: 1 })
              caretBlink.play()
              if (codeBody && srcMaxScroll > 0) {
                gsap.to(codeBody, { scrollTop: srcMaxScroll, duration: 1.7, ease: 'none' })
              }
            })
            .to('[data-up-bar]', { scaleX: 1, duration: 1.9, ease: 'power1.inOut' }, '<')
            .to(
              prog,
              {
                v: 100,
                duration: 1.9,
                ease: 'power1.inOut',
                onUpdate: () => writeProgress(prog.v),
              },
              '<',
            )
            .to(
              '[data-src-line]',
              { opacity: 1, y: 0, ease: 'none', duration: 0.2, stagger: 1.7 / sourceLineCount },
              '<',
            )
            .to(
              srcCount,
              {
                v: features,
                duration: 1.9,
                ease: 'power1.in',
                onUpdate: () => writeSrcCount(srcCount.v),
              },
              '<',
            )
            .add(() => {
              shimmer.pause()
              gsap.set('[data-up-shimmer]', { opacity: 0 })
              gsap.to('[data-up-bar]', { backgroundColor: '#10b981', duration: 0.3 })
              complete('upload')
            })
            // 2 — reprojection
            .add(() => activate('reproject'), '+=0.1')
            .to({}, { duration: 0.55 })
            .add(() => complete('reproject'))
            // 3 — schema validation — keys flicker as attributes are detected
            .add(() => activate('schema'), '+=0.05')
            .add(() =>
              gsap.fromTo(
                '[data-src-key]',
                { color: '#7dd3fc' },
                {
                  color: '#f0abfc',
                  duration: 0.22,
                  stagger: 0.012,
                  yoyo: true,
                  repeat: 1,
                  ease: 'sine.inOut',
                },
              ),
            )
            .to({}, { duration: 0.55 })
            .add(() => complete('schema'))
            // 4 — spatial index
            .add(() => activate('index'), '+=0.05')
            .to({}, { duration: 0.5 })
            .add(() => complete('index'))
            // 5 — render: zones draw in, feature counter, table rows stream in
            .add(() => activate('render'), '+=0.05')
            .to(
              '[data-zone]',
              { strokeDashoffset: 0, duration: 0.7, stagger: 0.06, ease: 'power2.out' },
              '<',
            )
            .to('[data-zone]', { fillOpacity: 0.5, duration: 0.5, stagger: 0.05 }, '<0.3')
            .to(
              feat,
              { v: features, duration: 0.8, ease: 'power1.out', onUpdate: () => writeFeat(feat.v) },
              '<',
            )
            .to(
              '[data-row]',
              { opacity: 1, x: 0, duration: 0.3, stagger: 0.07, ease: 'power2.out' },
              '<',
            )
            .add(() => complete('render'))
            // success
            .to(
              '[data-src-done]',
              { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' },
              '+=0.05',
            )
            .add(() => {
              caretBlink.pause()
              gsap.to('[data-src-caret]', { opacity: 0, duration: 0.2 })
            }, '<')
            .to(
              '[data-success]',
              { opacity: 1, y: 0, duration: 0.45, ease: 'back.out(1.7)' },
              '<0.05',
            )
            .add(() => {
              if (statusEl) statusEl.textContent = 'Couche ajoutée'
              gsap.to('[data-up-spinner]', { autoAlpha: 0, duration: 0.2 })
              setImportDone(true)
            })

          return () => {
            shimmer.kill()
            caretBlink.kill()
            tl.kill()
          }
        },
      )
      return () => mm.revert()
    },
    { scope: paneRef, dependencies: [setImportDone], revertOnUpdate: true },
  )
}
