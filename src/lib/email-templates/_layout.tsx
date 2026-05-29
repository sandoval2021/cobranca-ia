import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

export const SITE_URL = 'https://www.cobraeasy.com.br'
export const LOGO_URL = 'https://cobraeasy.com.br/apple-touch-icon.png'

interface OtpEmailLayoutProps {
  preview: string
  title: string
  intro: string
  token: string
  expiryText?: string
  helperText?: string
}

export function OtpEmailLayout({
  preview,
  title,
  intro,
  token,
  expiryText = '⏳ Este código expira em 10 minutos.',
  helperText = 'Se você não solicitou este código, ignore este e-mail com segurança.',
}: OtpEmailLayoutProps) {
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={outer}>
          <Section style={logoWrap}>
            <Img
              src={LOGO_URL}
              width="56"
              height="56"
              alt="CobraEasy"
              style={logo}
            />
            <Text style={brand}>
              Cobra<span style={brandAccent}>Easy</span>
            </Text>
          </Section>

          <Container style={card}>
            <Heading style={h1}>{title}</Heading>
            <Text style={text}>{intro}</Text>

            <Section style={codeWrap}>
              <Text style={codeStyle}>{token}</Text>
            </Section>

            <Text style={expiry}>{expiryText}</Text>

            <Hr style={divider} />

            <Text style={helper}>{helperText}</Text>

            <Text style={ctaWrap}>
              <Link href={SITE_URL} style={cta}>
                Acessar CobraEasy →
              </Link>
            </Text>
          </Container>

          <Text style={footer}>
            Equipe CobraEasy 🚀
            <br />
            <Link href={SITE_URL} style={footerLink}>
              www.cobraeasy.com.br
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: '#f4f6fb',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  margin: 0,
  padding: '32px 12px',
}
const outer = { maxWidth: '520px', margin: '0 auto', padding: 0 }
const logoWrap = { textAlign: 'center' as const, marginBottom: '20px' }
const logo = { display: 'inline-block', borderRadius: '12px' }
const brand = {
  fontSize: '18px',
  fontWeight: 700 as const,
  color: '#0f172a',
  margin: '10px 0 0',
  letterSpacing: '-0.01em',
}
const brandAccent = { color: '#2563EB' }
const card = {
  backgroundColor: '#ffffff',
  border: '1px solid #e5e9f2',
  borderRadius: '16px',
  padding: '32px 28px',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
}
const h1 = {
  fontSize: '22px',
  fontWeight: 700 as const,
  color: '#0f172a',
  margin: '0 0 12px',
  lineHeight: '1.3',
}
const text = {
  fontSize: '15px',
  color: '#475569',
  lineHeight: '1.55',
  margin: '0 0 22px',
}
const codeWrap = {
  backgroundColor: '#eff5ff',
  border: '1px solid #dbe7fb',
  borderRadius: '12px',
  padding: '20px 16px',
  textAlign: 'center' as const,
  margin: '0 0 18px',
}
const codeStyle = {
  fontFamily: "'SF Mono', Menlo, Consolas, monospace",
  fontSize: '34px',
  fontWeight: 700 as const,
  letterSpacing: '10px',
  color: '#0f172a',
  margin: 0,
  lineHeight: '1.1',
}
const expiry = {
  fontSize: '13px',
  color: '#64748b',
  textAlign: 'center' as const,
  margin: '0 0 8px',
}
const divider = {
  border: 'none',
  borderTop: '1px solid #eef1f6',
  margin: '20px 0 18px',
}
const helper = {
  fontSize: '13px',
  color: '#94a3b8',
  lineHeight: '1.5',
  margin: '0 0 18px',
}
const ctaWrap = { textAlign: 'center' as const, margin: '4px 0 0' }
const cta = {
  display: 'inline-block',
  backgroundColor: '#2563EB',
  color: '#ffffff',
  textDecoration: 'none',
  padding: '12px 22px',
  borderRadius: '10px',
  fontSize: '14px',
  fontWeight: 600 as const,
}
const footer = {
  textAlign: 'center' as const,
  fontSize: '12px',
  color: '#94a3b8',
  lineHeight: '1.6',
  margin: '24px 0 0',
}
const footerLink = {
  color: '#2563EB',
  textDecoration: 'none',
  fontWeight: 600 as const,
}
