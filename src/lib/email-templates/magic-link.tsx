import * as React from 'react'
import { OtpEmailLayout } from './_layout'

interface MagicLinkEmailProps {
  siteName: string
  token: string
}

export const MagicLinkEmail = ({ token }: MagicLinkEmailProps) => (
  <OtpEmailLayout
    preview="Use este código para entrar no CobraEasy com segurança."
    title="Seu código de acesso"
    intro="Use o código abaixo para entrar no CobraEasy com segurança:"
    token={token}
  />
)

export default MagicLinkEmail
