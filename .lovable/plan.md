# Importação robusta para bases grandes — plano em fases

A página `src/routes/importar-clientes.tsx` (1.448 linhas) já tem boa parte do fluxo: upload, parse PDF/Excel, dedup via RPC `get_import_customer_dedup_admin`, prévia, confirmação por lotes via `staging_import_customers_from_rows`, força/skip por linha, `imported-due-dates` para vencimentos reais. **Não vou reescrever do zero** — vou estender em camadas, sem migration e sem PR/merge.

Como a tarefa é grande e mexe com dados reais de cliente, divido em 4 PRs lógicos (todos só no branch atual, sem PR de verdade) para conseguir validar cada etapa antes de seguir:

## Fase 1 — Segurança imediata e base para escala
Objetivo: remover travas artificiais e preparar terreno sem mudar comportamento visível ainda.

- Remover `MAX_BYTES = 10 * 1024 * 1024` em `importar-clientes.tsx:89`. Substituir por:
  - aviso suave acima de 25MB ("arquivo grande, processamento em lotes pode levar alguns minutos");
  - sem bloqueio.
- Parse em chunks: mover `parseRowsFromText` / `extractPdfText` para um Web Worker (`src/workers/import-parser.ts`) para não travar a UI. Fallback síncrono se Worker indisponível.
- Adicionar barra de progresso real (linhas parseadas / total estimado) e botão **Cancelar** durante parse.
- `CHUNK_SIZE = 250` ao chamar `staging_import_customers_from_rows` (hoje manda tudo de uma vez); progresso por chunk; cancelável entre chunks.

## Fase 2 — WhatsApp repetido = múltiplas telas no mesmo cliente
- Em `src/lib/import-mapping.ts`, novo passo `groupRowsByWhatsApp(rows)` que agrupa por `whatsapp_e164` e produz:
  - 1 cliente lógico por número;
  - array `screens[]` com cada linha original (plano, valor, servidor, app, usuário, observações);
  - `notes` consolidadas no formato "Tela 1: <plano R$X> | Tela 2: <plano R$Y>".
- Prévia mostra "X clientes únicos · Y telas detectadas" e expansão por linha mostrando cada tela.
- Backend: tentativa 1 — encaixar via colunas extras no payload existente da RPC. Se a RPC não suportar `screens[]`, **paro e aviso** antes de propor migration (regra do brief: "se precisar ajustar RPC, avisar antes").

## Fase 3 — Erros separados, retry e export
- Estado dedicado `errorRows[]` separado de `pendingRows[]`. Após confirmar, aprovados somem da lista, só erros ficam.
- Cada erro mostra: número da linha original, campo problemático, motivo em português, botão "corrigir" (edição inline) e "tentar novamente só os erros".
- Export via `xlsx` (já deve estar no bundle ou instalo `xlsx` ~600KB):
  - `Exportar relatório completo` (preserva colunas originais + status_importacao, motivo_erro, cliente_id, whatsapp_normalizado, telas_detectadas, plano_detectado, mensagem_detectada, vencimento_detectado);
  - `Exportar só erros`;
  - `Exportar só conflitos`;
  - mantém ordem original via índice preservado em `raw_row_index`.
- PDF de origem → exporta relatório Excel (mais útil que regerar PDF).

## Fase 4 — Performance da prévia e proteção de dados
- Virtualização da prévia com `@tanstack/react-virtual` (já vem com TanStack) — renderiza só ~30 linhas visíveis mesmo com 10k.
- Filtros: "todos / novos / existentes / conflitos / erros / duplicados".
- Conflito = cliente existente cujo nome/valor/vencimento difere → modal "manter atual / sobrescrever / mesclar" antes de confirmar. Nunca sobrescreve silenciosamente.
- Bloco de auditoria: salvar `raw_row` original em `customer_notes` ou tabela de auditoria (se não houver, registro só em `notes` com timestamp do bloco de importação).
- Idempotência: hash SHA-256 do conteúdo do arquivo + tamanho guardado em `localStorage` por empresa; ao reimportar, aviso "este arquivo já foi importado em DD/MM HH:MM — continuar?".

## O que NÃO faço nesta tarefa
- Não crio PR, não faço merge.
- Não rodo migration. Se a RPC precisar mudar (provável na Fase 2 para `screens[]`), paro e apresento o SQL para você aprovar antes — assim como combinamos no MVP.
- Não toco em WhatsApp real, IA, Mercado Pago, banco `ajeyimujgtukcbadyash`.
- Não apago nem sobrescrevo cliente existente sem confirmação na UI.

## Detalhes técnicos
- Web Worker: `new Worker(new URL('../workers/import-parser.ts', import.meta.url), { type: 'module' })` — Vite suporta nativo.
- PDF grande: `pdfjs-dist` em streaming page-by-page; libera memória de cada página após extrair texto.
- Excel grande: `xlsx` com `{ dense: true, sheetRows: 0 }` e iteração linha-a-linha em vez de `sheet_to_json` em bloco.
- Chunk de upload: `for (const chunk of chunks) { await rpc(chunk); setProgress(...); if (cancelled) break; }`.

## Pergunta antes de começar
Quer que eu execute **as 4 fases nesta resposta** (vai gerar ~15 arquivos novos/alterados, sem como você validar etapa por etapa), ou prefere que eu faça **só a Fase 1 agora** — remover o limite de 10MB, Worker de parse e chunking — e você testa antes de eu seguir para a Fase 2 (agrupamento por WhatsApp, que é a parte mais sensível para dados reais)?

Minha recomendação: **Fase 1 agora**, validar com arquivo real seu, depois Fase 2.