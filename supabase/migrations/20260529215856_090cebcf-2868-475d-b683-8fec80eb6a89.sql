-- Idempotência de criação de indicações: previne duplicatas por chave de negócio
-- (mesma empresa + mesmo telefone do indicador + mesmo telefone do indicado, normalizados).
-- Partial: aplica somente quando ambos os telefones estão presentes; registros antigos
-- sem telefone não são afetados. Não destrói dados.
CREATE UNIQUE INDEX IF NOT EXISTS customer_referrals_business_key_uidx
ON public.customer_referrals (
  company_id,
  regexp_replace(referrer_phone, '\D', '', 'g'),
  regexp_replace(referred_phone, '\D', '', 'g')
)
WHERE referrer_phone IS NOT NULL
  AND referred_phone IS NOT NULL
  AND length(regexp_replace(referrer_phone, '\D', '', 'g')) > 0
  AND length(regexp_replace(referred_phone, '\D', '', 'g')) > 0;