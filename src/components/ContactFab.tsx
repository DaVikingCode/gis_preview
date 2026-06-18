import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Mail, Send, X, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useContactReveal } from '@/hooks/animations/useContactReveal'
import { useContactExit } from '@/hooks/animations/useContactExit'
import { CalibrationCorners, ContourField } from '@/components/survey/Survey'

const ENDPOINT = import.meta.env.VITE_CONTACT_ENDPOINT ?? '/api/contact'

// Coordonnées du studio DVC (Dijon) — signature : le contact est un point réel
// sur la carte, en écho au sujet SIG de la démo.
const DVC_COORDS = '47.3220° N · 5.0415° E — DIJON'

type Status = 'idle' | 'sending' | 'sent'

export function ContactFab() {
  const [open, setOpen] = useState(false)
  const [exiting, setExiting] = useState(false)

  // L'écran de fin (OutroScreen) ouvre le contact à distance, sans store partagé.
  useEffect(() => {
    const openPanel = () => {
      setExiting(false)
      setOpen(true)
    }
    window.addEventListener('gp:open-contact', openPanel)
    return () => window.removeEventListener('gp:open-contact', openPanel)
  }, [])

  function requestClose() {
    if (exiting) return
    setExiting(true)
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Démarrer un projet"
          className="gp-contact group/fab fixed right-5 bottom-5 flex h-14 items-center gap-0 overflow-hidden rounded-full bg-primary pr-0 pl-0 text-primary-foreground shadow-lg shadow-black/30 ring-1 ring-black/10 transition-[width,padding,box-shadow] duration-300 ease-out hover:shadow-xl hover:shadow-primary/20 focus-visible:ring-3 focus-visible:ring-primary/50 focus-visible:outline-none sm:right-6 sm:bottom-6"
          style={{ zIndex: 100210 }}
        >
          <span className="relative grid h-14 w-14 shrink-0 place-items-center">
            <Mail className="size-5" />
            <span className="pointer-events-none absolute inset-1 rounded-full ring-2 ring-primary/40 motion-safe:animate-ping" />
          </span>
          <span className="max-w-0 overflow-hidden pr-0 text-sm font-semibold whitespace-nowrap transition-[max-width,padding] duration-300 ease-out group-hover/fab:max-w-[200px] group-hover/fab:pr-5">
            Parlons de votre projet
          </span>
        </button>
      )}

      {open &&
        createPortal(
          <ContactPanel
            exiting={exiting}
            onRequestClose={requestClose}
            onExited={() => {
              setOpen(false)
              setExiting(false)
            }}
          />,
          document.body,
        )}
    </>
  )
}

function ContactPanel({
  exiting,
  onRequestClose,
  onExited,
}: {
  exiting: boolean
  onRequestClose: () => void
  onExited: () => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<Status>('idle')

  useContactReveal(rootRef)
  useContactExit(rootRef, exiting, onExited)

  useEffect(() => {
    nameRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onRequestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onRequestClose])

  // Confirmation envoyée : on laisse l'état « envoyé » visible un instant, puis on ferme.
  useEffect(() => {
    if (status !== 'sent') return
    const t = setTimeout(onRequestClose, 2600)
    return () => clearTimeout(t)
  }, [status, onRequestClose])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (status === 'sending') return
    const data = new FormData(e.currentTarget)
    const field = (key: string): string => {
      const value = data.get(key)
      return typeof value === 'string' ? value : ''
    }
    const payload = {
      name: field('name').trim(),
      email: field('email').trim(),
      message: field('message').trim(),
      company: field('company'), // honeypot
    }

    setStatus('sending')
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.status === 404) {
        toast.info('Endpoint indisponible en dev Vite — lancez `npm run dev:pages`.')
        setStatus('idle')
        return
      }
      if (!res.ok) throw new Error(String(res.status))
      setStatus('sent')
    } catch {
      toast.error("L'envoi a échoué. Réessayez dans un instant.")
      setStatus('idle')
    }
  }

  return (
    <div
      ref={rootRef}
      className="gp-contact fixed inset-0"
      style={{ zIndex: 100210 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-title"
    >
      <div
        data-contact-backdrop
        onClick={onRequestClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />

      <div
        data-contact-card
        className="absolute right-4 bottom-4 left-4 mx-auto w-auto max-w-[400px] overflow-hidden rounded-2xl border border-border bg-card/95 text-card-foreground shadow-2xl shadow-black/50 backdrop-blur-md sm:right-6 sm:bottom-6 sm:left-auto sm:w-[380px]"
      >
        {/* Bandeau d'accent marque */}
        <div className="h-1 w-full bg-primary" />

        {/* Écho cartographique : relief discret derrière l'en-tête + repères de calage,
            en cohérence avec le splash et l'écran de fin. `gp-deco` : décoration jamais
            cliquable, même sous `.gp-contact *` qui force pointer-events:auto (cf. index.css). */}
        <div className="gp-deco">
          <ContourField
            cx={320}
            cy={18}
            radii={[18, 34, 54, 80, 112, 150]}
            viewBox={{ w: 380, h: 130 }}
            animate={false}
            className="absolute inset-x-0 top-0 h-32 w-full opacity-70"
          />
          <CalibrationCorners offset={2} tone="bg-foreground/15" />
        </div>

        {status === 'sent' ? (
          <div className="flex flex-col items-center gap-3 px-6 pt-8 pb-9 text-center">
            <div className="grid size-14 place-items-center rounded-full bg-primary text-primary-foreground duration-500 animate-in fade-in zoom-in-50 motion-reduce:animate-none">
              <Check className="size-7" strokeWidth={2.5} />
            </div>
            <div className="duration-500 animate-in fade-in slide-in-from-bottom-1 motion-reduce:animate-none">
              <h2 id="contact-title" className="text-lg font-extrabold">
                Demande envoyée !
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Merci, on vous recontacte très vite pour en discuter.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 px-5 pt-4">
              <div data-contact-field>
                <p className="font-mono text-[11px] tracking-wide text-muted-foreground">
                  {DVC_COORDS}
                </p>
                <h2 id="contact-title" className="mt-1 text-lg leading-tight font-extrabold">
                  Parlons de votre projet
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  On conçoit votre application cartographique sur mesure. Dites-nous votre besoin,
                  on vous recontacte vite.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onRequestClose}
                aria-label="Fermer"
                className="-mr-1 shrink-0"
              >
                <X />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3 px-5 pt-4 pb-5">
              <Field label="Nom" htmlFor="contact-name">
                <Input
                  ref={nameRef}
                  id="contact-name"
                  name="name"
                  required
                  maxLength={120}
                  autoComplete="name"
                  placeholder="Votre nom"
                  className="h-9"
                />
              </Field>

              <Field label="E-mail" htmlFor="contact-email">
                <Input
                  id="contact-email"
                  name="email"
                  type="email"
                  required
                  maxLength={200}
                  autoComplete="email"
                  placeholder="vous@entreprise.com"
                  className="h-9"
                />
              </Field>

              <Field label="Votre projet" htmlFor="contact-message">
                <Textarea
                  id="contact-message"
                  name="message"
                  required
                  maxLength={5000}
                  rows={4}
                  placeholder="Décrivez votre projet cartographique en quelques mots…"
                />
              </Field>

              {/* Honeypot anti-spam : invisible et hors tabulation. */}
              <input
                type="text"
                name="company"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute -left-[9999px] h-0 w-0 opacity-0"
              />

              <div data-contact-field className="pt-1">
                <Button type="submit" className="w-full" disabled={status === 'sending'}>
                  {status === 'sending' ? (
                    <>
                      <Loader2 className="animate-spin" /> Envoi…
                    </>
                  ) : (
                    <>
                      <Send /> Envoyer ma demande
                    </>
                  )}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div data-contact-field className={cn('flex flex-col gap-1')}>
      <label
        htmlFor={htmlFor}
        className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
      >
        {label}
      </label>
      {children}
    </div>
  )
}
