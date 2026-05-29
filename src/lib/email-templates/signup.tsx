import * as React from 'react'
import { OtpEmailLayout } from './_layout'

interface SignupEmailProps {
  siteName: string
  token: string
}

export const SignupEmail = ({ token }: SignupEmailProps) => (
  <OtpEmailLayout
    preview="Use este código para concluir seu acesso com segurança."
    title="Seu código chegou 👋"
    intro="Use o código abaixo para concluir seu cadastro no CobraEasy com segurança:"
    token={token}
  />
)

export default SignupEmail
