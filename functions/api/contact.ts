import { render } from '@react-email/render'
import { ContactEmail } from '../../src/emails/ContactEmail'

// Pages Function : relais sécurisé navigateur → Daviking-Mailer.
// Le navigateur n'appelle JAMAIS le mailer directement (la clé serait exposée).
// Il poste sur /api/contact (même origine) ; cette fonction détient MAILER_KEY
// (secret d'env Pages) et relaie vers le worker mailer.
// Réf. contrat : Daviking-Mailer/docs/API.md (§ "Depuis un front").

interface Env {
  MAILER_KEY: string
  MAILER_URL?: string
  ALLOWED_ORIGIN?: string
}

type EventContext = {
  request: Request
  env: Env
}

const DEFAULT_MAILER_URL = 'https://daviking-mailer.blue-tree-8b17.workers.dev'
const RECIPIENT = 'hello@davikingcode.com'

const MAX = { name: 120, email: 200, message: 5000 } as const
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Allowlist : localhost (dev), *.pages.dev (preview/prod CF), + override d'env.
function isAllowedOrigin(request: Request, env: Env): boolean {
  const origin = request.headers.get('Origin') ?? request.headers.get('Referer')
  if (!origin) return false
  let host: string
  try {
    host = new URL(origin).hostname
  } catch {
    return false
  }
  if (host === 'localhost' || host === '127.0.0.1') return true
  if (host.endsWith('.pages.dev')) return true
  if (env.ALLOWED_ORIGIN) {
    try {
      if (host === new URL(env.ALLOWED_ORIGIN).hostname) return true
    } catch {
      if (host === env.ALLOWED_ORIGIN) return true
    }
  }
  return false
}

export const onRequestPost = async ({ request, env }: EventContext): Promise<Response> => {
  if (!isAllowedOrigin(request, env)) return json({ error: 'forbidden_origin' }, 403)
  if (!env.MAILER_KEY) return json({ error: 'server_misconfigured' }, 500)

  let payload: Record<string, unknown>
  try {
    payload = (await request.json()) as Record<string, unknown>
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  // Honeypot : un bot remplit le champ caché « company » → on accuse réception
  // sans rien envoyer (200 silencieux pour ne pas signaler le piège).
  if (typeof payload.company === 'string' && payload.company.trim() !== '') {
    return json({ status: 'ok' }, 200)
  }

  const name = typeof payload.name === 'string' ? payload.name.trim() : ''
  const email = typeof payload.email === 'string' ? payload.email.trim() : ''
  const message = typeof payload.message === 'string' ? payload.message.trim() : ''

  if (!name || name.length > MAX.name) return json({ error: 'invalid_name' }, 400)
  if (!email || email.length > MAX.email || !EMAIL_RE.test(email))
    return json({ error: 'invalid_email' }, 400)
  if (!message || message.length > MAX.message) return json({ error: 'invalid_message' }, 400)

  const html = await render(ContactEmail({ name, email, message }))
  const text = await render(ContactEmail({ name, email, message }), { plainText: true })

  const mailerUrl = env.MAILER_URL ?? DEFAULT_MAILER_URL
  let mailerRes: Response
  try {
    mailerRes = await fetch(`${mailerUrl}/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.MAILER_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: RECIPIENT,
        replyTo: { email, name },
        fromName: 'GIS Preview — Demande projet',
        content: {
          type: 'html',
          subject: `Nouvelle demande projet — ${name}`,
          html,
          text,
        },
      }),
    })
  } catch {
    return json({ error: 'mailer_unreachable' }, 502)
  }

  if (!mailerRes.ok) return json({ error: 'mailer_error' }, 502)
  return json({ status: 'ok' }, 200)
}
