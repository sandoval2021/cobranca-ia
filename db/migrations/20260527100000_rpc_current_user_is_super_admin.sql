-- ============================================================
-- 20260527100000_rpc_current_user_is_super_admin.sql
-- Wrapper seguro para o frontend perguntar "sou super admin?"
-- sem precisar passar o uid (o backend usa auth.uid()).
--
-- IMPORTANTE: apenas versionamento. NÃO aplicar automaticamente.
-- Aplicar manualmente no banco correto (pkghjzbvmifmztqvpdeu),
-- NUNCA em ajeyimujgtukcbadyash.
--
-- Pré-requisito: já deve existir public.is_super_admin(uuid)
-- referenciada pelas RPCs *_admin existentes
-- (renew_customer_admin, list_customers_admin, etc).
-- ============================================================

create or replace function public.current_user_is_super_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_super boolean := false;
begin
  if v_uid is null then
    return false;
  end if;
  execute 'select public.is_super_admin($1)' into v_is_super using v_uid;
  return coalesce(v_is_super, false);
end;
$$;

revoke all on function public.current_user_is_super_admin() from public, anon;
grant execute on function public.current_user_is_super_admin() to authenticated;

comment on function public.current_user_is_super_admin() is
  'Wrapper somente-leitura para o frontend perguntar se o usuário autenticado é super admin. NÃO é a fonte da verdade da segurança — apenas espelha is_super_admin(auth.uid()) para uso de UX. Toda RPC sensível continua chamando is_super_admin() diretamente.';
