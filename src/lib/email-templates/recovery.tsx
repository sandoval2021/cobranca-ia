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

interface RecoveryEmailProps {
  siteName: string
  token: string
}

export const RecoveryEmail = ({ siteName, token }: RecoveryEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Seu código para redefinir a senha CobraEasy</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Redefinir senha</Heading>
        <Text style={text}>
          Recebemos um pedido para redefinir sua senha no{' '}
          <strong>{siteName}</strong>. Use o código abaixo para continuar:
        </Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          Este código expira em 1 hora. Se você não solicitou esta redefinição,
          pode ignorar este e-mail — sua senha permanecerá a mesma.
        </Text>
        <Text style={signature}>Equipe CobraEasy</Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '480px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#0a0a0a',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#55575d',
  lineHeight: '1.5',
  margin: '0 0 20px',
}
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
const footer = {
  fontSize: '12px',
  color: '#999999',
  lineHeight: '1.5',
  margin: '24px 0 0',
}
const signature = {
  fontSize: '12px',
  color: '#666666',
  margin: '16px 0 0',
}
