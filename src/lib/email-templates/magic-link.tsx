import * as React from 'react'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'

interface MagicLinkEmailProps {
  siteName: string
  token: string
}

export const MagicLinkEmail = ({ siteName, token }: MagicLinkEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu código de acesso CobraEasy</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Seu código de acesso</Heading>
        <Text style={text}>
          Use o código abaixo para entrar no <strong>{siteName}</strong>:
        </Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          Este código expira em 1 hora. Se você não solicitou este acesso, pode
          ignorar este e-mail.
        </Text>
        <Text style={signature}>Equipe CobraEasy</Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '480px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0a0a0a', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.5', margin: '0 0 20px' }
const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '32px',
  fontWeight: 'bold' as const,
  letterSpacing: '8px',
  color: '#0a0a0a',
  backgroundColor: '#f4f4f5',
  padding: '16px 20px',
  borderRadius: '8px',
  textAlign: 'center' as const,
  margin: '0 0 24px',
}
const footer = { fontSize: '12px', color: '#999999', lineHeight: '1.5', margin: '24px 0 0' }
const signature = { fontSize: '12px', color: '#666666', margin: '16px 0 0' }
