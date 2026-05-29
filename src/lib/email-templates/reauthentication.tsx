import * as React from 'react'
import { OtpEmailLayout } from './_layout'

interface ReauthenticationEmailProps {
  siteName: string
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <OtpEmailLayout
    preview="Use este código para confirmar sua identidade no CobraEasy."
    title="Confirme sua identidade"
    intro="Use o código abaixo para confirmar sua identidade no CobraEasy:"
    token={token}
  />
)

export default ReauthenticationEmail
