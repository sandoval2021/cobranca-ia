-- Fase C — Índices compostos por empresa para listagens de clientes.
-- Justificativa:
--   list_customers_admin filtra c.company_id e ordena por due_date/name; também aceita
--   filtro de status. Hoje existem idx_customers_company (apenas company_id),
--   customers_due_date_idx (apenas due_date, global) e customers_status_idx (apenas
--   status, global). Em multi-tenant, filtros tenant+coluna se beneficiam de índice
--   composto; os singletons globais perdem seletividade conforme a base cresce.
-- Idempotente (IF NOT EXISTS). Não altera dados. Não duplica índices existentes
--   (nomes distintos dos atuais e composições diferentes).

CREATE INDEX IF NOT EXISTS idx_customers_company_due_date
  ON public.customers (company_id, due_date);

CREATE INDEX IF NOT EXISTS idx_customers_company_status
  ON public.customers (company_id, status);
