## O que já existe no projeto

- **Templates automáticos da categoria "Teste"** (já cadastrados, com mensagem editável):
  - Após 1h, 6h, 12h, 24h, 2 dias, 3 dias, 5 dias, 7 dias
  - Cada template tem: ativo/desativado, corpo da mensagem, janela de horário permitido (sendStart / sendEnd)
  - Página de edição: `/templates-automaticos`
- **Regras de disparo** com horário global: `/regras-disparo`
- **Fila de disparo automático**: `src/lib/auto-dispatch.ts` (já existe, hoje usada para cobrança)

## O que falta (e é o que você está pedindo)

1. Tirar o card estático "Modo manual: nenhuma mensagem será enviada automaticamente"
2. Substituir por um painel real de **automação dos testes** na tela `/testes`
3. Plugar o motor de auto-dispatch para também processar leads de teste

## Mudanças propostas

### 1. UI nova na tela `/testes` (substitui o card "Modo manual")

Card "Automação dos testes" mostrando:

- **Status global**: chave liga/desliga "Enviar mensagens automaticamente"
- **Lista compacta** dos 8 templates de teste, cada linha com:
  - Nome (ex.: "Após 1 hora")
  - Switch ativo/inativo
  - Hora permitida (ex.: "08:00 → 20:00") — editável inline
  - Botão "Editar mensagem" → abre dialog com o corpo do template e variáveis ({nome}, {empresa}, {dias_restantes})
- Link "Ver todos / configuração avançada" → `/templates-automaticos`

Tudo já usa o storage existente de `auto-templates`. Sem tabela nova, sem migration.

### 2. Motor de disparo (`src/lib/auto-dispatch.ts`)

Hoje varre clientes para cobrança. Vou estender para também varrer `trial_leads`:

- Para cada lead com `status = em_teste`, calcular horas desde o início
- Casar com os templates "teste" ativos cuja `offsetHours` bate
- Respeitar a janela de horário (sendStart / sendEnd)
- Marcar enviado na fila local (`SENT_KEY`) para não duplicar
- Lead com `status = fechou` ou `cancelado` é ignorado

### 3. Aviso simples se WhatsApp não estiver conectado

Se não houver instância WhatsApp ativa, o card mostra: "Conecte o WhatsApp para ativar os envios automáticos" + botão para `/whatsapp`. Sem isso, switch fica desabilitado.

## Fora do escopo (não vou mexer)

- Lógica de envio real do WhatsApp (uazapi/Evolution) — já existe e continua igual
- Regras financeiras / cobrança
- Banco de dados — nada de SQL
- Templates de outras categorias (cobrança / renovação / app)
- package.json / nenhum pacote novo

## Detalhes técnicos

- Arquivos alterados:
  - `src/routes/testes.tsx` — troca o card warning por `<TrialAutomationPanel />`
  - `src/components/testes/TrialAutomationPanel.tsx` — **novo** componente
  - `src/lib/auto-dispatch.ts` — adiciona varredura de `trial_leads`
- Sem migração, sem secrets novos, sem dependência nova.
- Reuso de: `useAutoTemplatesSync`, `useTrialLeadsSync`, `previewTemplate`, dialog/switch existentes.

## Confirma para eu seguir?

Se preferir menor escopo, posso fazer só o item 1 + 2 agora (UI + persistência da config), deixando o motor de envio (item 2 do "Motor") para uma próxima etapa. Me diz qual caminho.
