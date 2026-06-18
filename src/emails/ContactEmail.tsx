// `import * as React` est requis : wrangler/esbuild compile ce fichier avec le
// runtime JSX classique (React.createElement) — sans cet import, la fonction
// plante avec « React is not defined » à l'exécution. Vite (runtime automatique)
// l'utilise quand même via les annotations React.CSSProperties → pas d'avertissement.
import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

export interface ContactEmailProps {
  name: string
  email: string
  phone: string
  message: string
}

// E-mail reçu par DVC à chaque nouvelle demande commerciale via la démo GIS.
// Responsive : container fluide (width 100% / max-width 600), mono-colonne, meta
// viewport + media query qui réduit le padding sur petit écran.
// Palette marque : jaune #FFEB04 / encre #232323 / accent cyan #00B5E1.
export function ContactEmail({ name, email, phone, message }: ContactEmailProps) {
  return (
    <Html lang="fr">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{MEDIA_QUERY}</style>
      </Head>
      <Preview>{`Nouvelle demande projet — ${name}`}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={accentBar} />

          <Section className="gp-pad" style={pad}>
            <Text style={eyebrow}>DA VIKING CODE · NOUVELLE DEMANDE</Text>
            <Heading className="gp-title" style={title}>
              Nouvelle demande de projet
            </Heading>
            <Text style={lead}>
              Un prospect souhaite être recontacté au sujet d&apos;une application cartographique.
            </Text>

            <Section style={card}>
              <Text style={fieldLabel}>Nom</Text>
              <Text style={fieldValue}>{name}</Text>

              <Hr style={divider} />

              <Text style={fieldLabel}>E-mail</Text>
              <Text style={fieldValue}>
                <Link href={`mailto:${email}`} style={emailLink}>
                  {email}
                </Link>
              </Text>

              {phone ? (
                <>
                  <Hr style={divider} />

                  <Text style={fieldLabel}>Téléphone</Text>
                  <Text style={fieldValue}>
                    <Link href={`tel:${phone}`} style={emailLink}>
                      {phone}
                    </Link>
                  </Text>
                </>
              ) : null}

              <Hr style={divider} />

              <Text style={fieldLabel}>Projet</Text>
              <Text style={messageValue}>{message}</Text>
            </Section>

            <Text style={footer}>
              Répondez directement à cet e-mail pour recontacter {name}. · 47.3220° N, 5.0415° E —
              Dijon
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default ContactEmail

const MEDIA_QUERY = `@media only screen and (max-width:480px){
  .gp-pad{padding-left:20px!important;padding-right:20px!important}
  .gp-title{font-size:20px!important;line-height:26px!important}
}`

const body: React.CSSProperties = {
  backgroundColor: '#f4f4f5',
  margin: 0,
  padding: '24px 12px',
  fontFamily:
    "'Aeonik', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
}

const container: React.CSSProperties = {
  width: '100%',
  maxWidth: '600px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
  borderRadius: '14px',
  overflow: 'hidden',
  border: '1px solid #e4e4e7',
}

const accentBar: React.CSSProperties = {
  height: '6px',
  lineHeight: '6px',
  fontSize: '1px',
  backgroundColor: '#FFEB04',
}

const pad: React.CSSProperties = {
  padding: '28px 32px',
}

const eyebrow: React.CSSProperties = {
  margin: 0,
  fontSize: '11px',
  letterSpacing: '0.14em',
  fontWeight: 700,
  color: '#71717a',
}

const title: React.CSSProperties = {
  margin: '6px 0 0',
  fontSize: '22px',
  lineHeight: '28px',
  fontWeight: 800,
  color: '#232323',
}

const lead: React.CSSProperties = {
  margin: '6px 0 0',
  fontSize: '14px',
  lineHeight: '20px',
  color: '#52525b',
}

const card: React.CSSProperties = {
  margin: '20px 0 4px',
  padding: '4px 20px',
  backgroundColor: '#fafafa',
  border: '1px solid #ececef',
  borderRadius: '12px',
}

const fieldLabel: React.CSSProperties = {
  margin: '16px 0 2px',
  fontSize: '11px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  fontWeight: 700,
  color: '#a1a1aa',
}

const fieldValue: React.CSSProperties = {
  margin: '0 0 4px',
  fontSize: '15px',
  fontWeight: 600,
  color: '#232323',
  wordBreak: 'break-word',
}

const messageValue: React.CSSProperties = {
  margin: '0 0 16px',
  fontSize: '15px',
  lineHeight: '24px',
  color: '#3f3f46',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}

const emailLink: React.CSSProperties = {
  color: '#0094b8',
  fontWeight: 600,
  textDecoration: 'none',
}

const divider: React.CSSProperties = {
  borderColor: '#ececef',
  margin: '0',
}

const footer: React.CSSProperties = {
  margin: '20px 0 0',
  fontSize: '12px',
  lineHeight: '18px',
  color: '#a1a1aa',
}
