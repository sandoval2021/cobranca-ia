REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.saas_plan_entitlements FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.user_company_preferences FROM authenticated, anon;
-- saas_plan_entitlements pode ser lida por anon (catálogo público de planos) ou não?
-- spec diz "leitura para authenticated" => revogar SELECT do anon.
REVOKE SELECT ON public.saas_plan_entitlements FROM anon;
REVOKE SELECT ON public.user_company_preferences FROM anon;
-- garantir GRANT correto
GRANT SELECT ON public.saas_plan_entitlements TO authenticated;
GRANT SELECT ON public.user_company_preferences TO authenticated;
GRANT ALL    ON public.saas_plan_entitlements TO service_role;
GRANT ALL    ON public.user_company_preferences TO service_role;
