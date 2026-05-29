# Persistência definitiva dos servidores no banco

## Causa raiz

O arquivo `src/lib/server-catalog.ts` é a fonte oficial de servidores hoje, e ele lê/grava **apenas em `localStorage`** (chave `cobranca_ia_server_catalog_v2__<companyId>`). Por isso:

- Cada dispositivo tem sua própria lista (desktop ≠ PWA celular).
- O aviso "Salvo apenas neste navegador" aparece porque é literalmente verdade.
- A tabela `public.servers` **já existe** no banco (com `company_id`, RLS por `has_company_access`, delete só para owner/super admin), mas o app nunca grava nem lê dela.

Nenhuma mudança de schema é necessária. SQL aplicado: **NÃO**.

## Estratégia

Trocar `server-catalog.ts` de "fonte" para "cache + adapter assíncrono" sobre a tabela `servers`, sem reescrever as 17 telas consumidoras de uma vez. Mantemos a mesma API síncrona (`listServers()`, `getServerById()`, `saveServer()`, etc.) que hoje todo mundo usa, e por baixo:

1. Um hook de boot (`useServersSync`) chama um server function que faz `SELECT * FROM servers WHERE company_id = ...`, hidrata o cache local e dispara o evento `SERVER_CATALOG_EVENT` já existente.
2. `saveServer / archiveServer / reactivateServer / deleteServer` viram **fire-and-forget para o banco** (server fn) e, no sucesso, refazem o sync. Em caso de erro de rede, mostram toast e revertem.
3. Cache local serve apenas como leitura instantânea / offline — nunca como verdade.
4. **Nunca** sobrescrever cache com lista vazia até a primeira resposta do servidor confirmar (flag `loaded`).

## Arquivos

**Novo:**
- `src/lib/servers/servers.functions.ts` — `listServersDb`, `upsertServerDb`, `setServerActiveDb`, `deleteServerDb` (createServerFn + `requireSupabaseAuth`, validação Zod, `company_id` recebido e checado por RLS).
- `src/lib/servers/useServersSync.ts` — hook que dispara sync no mount, em foco e em troca de empresa.

**Editado:**
- `src/lib/server-catalog.ts` — mantém a API atual, mas:
  - `writeRaw` agora também enfileira persistência no banco;
  - adiciona `hydrateFromDb(rows)` (chamada pelo hook);
  - adiciona flag `__loaded` para impedir que componentes salvem antes do primeiro sync;
  - remove qualquer fallback que crie defaults.
- `src/routes/__root.tsx` — monta `useServersSync()` dentro de `AppShell` (só quando autenticado).
- `src/routes/catalogo-servidores.tsx` — troca o aviso amarelo "Salvo apenas neste navegador" por "Salvo na sua conta. Disponível em qualquer dispositivo." e exibe estado de loading/erro de sync.

**Migração de dados locais:**
- Na primeira hidratação, se o banco voltar vazio **mas** existir lista no `localStorage`, exibir banner "Encontramos N servidores salvos neste navegador. Enviar para sua conta?" com botão que faz upsert em lote no banco. Nunca apagar o `localStorage` sem confirmação.

## Não-escopo (não muda nesta tarefa)

- Clientes, apps pagos, rotas DNS, planos, credenciais: o usuário pediu para informar — vou listar no entregável final quais ainda dependem de `localStorage` (vejo de bate-pronto: `dns-routes.ts`, `app-screens.ts`, `services-catalog.ts`, `customer-extras.ts`, `manual-renewals.ts`, `financeiro-local.ts`, `setup-wizard.ts`, etc.). Cada um precisa de tarefa própria — `customers`, `dns_routes`, `portal_apps` já existem no banco; outros (`services`, `app-screens` por cliente) talvez ainda não.

## Validação

1. Cadastrar servidor no desktop → confirmar `SELECT * FROM servers` no banco.
2. Abrir PWA no celular logado na mesma conta → servidor aparece.
3. Editar no celular → recarregar desktop → alteração reflete.
4. Inativar / excluir → confirma no banco.
5. Fechar e reabrir PWA → lista mantida.
6. Build OK.

## Riscos

- 17 arquivos consomem `listServers()` de forma síncrona. Manter a assinatura síncrona evita refactor em cascata; o trade-off é que na **primeira renderização** após login a lista pode aparecer vazia por ~200 ms até o sync responder. Mitigação: o cache local da sessão anterior já preenche imediatamente, e o sync só substitui depois.

Confirma este caminho? Se sim, executo as edições e o sync — sem PR, sem merge, sem nova migration.
