import * as React from 'react'
import { OtpEmailLayout } from './_layout'

interface RecoveryEmailProps {
  siteName: string
  token: string
}

export const RecoveryEmail = ({ token }: RecoveryEmailProps) => (
  <OtpEmailLayout
    preview="Use este código para redefinir sua senha CobraEasy."
    title="Redefinir sua senha"
    intro="Use o código abaixo para redefinir sua senha no CobraEasy:"
    token={token}
    helperText="Se você não solicitou a redefinição, ignore este e-mail — sua senha continua a mesma."
  />
)

export default RecoveryEmail
