
ALTER TABLE public.renewal_tasks
  ADD CONSTRAINT renewal_tasks_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE,
  ADD CONSTRAINT renewal_tasks_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD CONSTRAINT renewal_tasks_server_id_fkey
    FOREIGN KEY (server_id) REFERENCES public.servers(id) ON DELETE SET NULL,
  ADD CONSTRAINT renewal_tasks_credential_id_fkey
    FOREIGN KEY (credential_id) REFERENCES public.customer_iptv_credentials(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
