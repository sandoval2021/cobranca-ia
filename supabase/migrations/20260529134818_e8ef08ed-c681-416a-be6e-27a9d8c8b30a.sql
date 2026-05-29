
CREATE OR REPLACE FUNCTION public.set_vault_secret(p_name text, p_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_name IS NULL OR length(btrim(p_name)) = 0 THEN
    RAISE EXCEPTION 'name_required';
  END IF;
  IF p_value IS NULL OR length(p_value) = 0 THEN
    RAISE EXCEPTION 'value_required';
  END IF;

  SELECT id INTO v_id FROM vault.secrets WHERE name = p_name;
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(p_value, p_name);
  ELSE
    PERFORM vault.update_secret(v_id, p_value);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_vault_secret(text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_vault_secret(text, text) TO service_role;
