## Escopo

Construir somente o **design system premium** + **shell de navegação mobile-first** + **telas-esqueleto** (sem lógica, sem backend, sem dados reais). Você plugará a lógica das FASES anteriores depois.

Nada de backend, RLS, Mercado Pago, Evolution, IA ou regras de negócio será tocado (não existe nada disso aqui ainda).

---

## 1. Estratégia visual (referência Stripe / Linear / Notion)

- Fundo claro, neutro, com superfícies em camadas suaves.
- Tipografia: Inter (corpo) + Inter tight (títulos), tracking apertado em títulos.
- Raio padrão `0.75rem`, sombras suaves em 2 níveis (`elevation-1`, `elevation-2`).
- Paleta semântica em `oklch` no `src/styles.css`:
  - `--background`, `--surface`, `--surface-muted`
  - `--primary` (azul-violeta moderno tipo Linear), `--primary-soft`
  - `--success`, `--warning`, `--danger`, `--info` + variantes `-soft` para badges
  - `--border`, `--border-strong`
- Tokens extras: `--shadow-card`, `--shadow-pop`, `--radius-card`, gradiente sutil `--gradient-hero`.
- Animações curtas (150–220ms), `ease-out`, sem exageros.

## 2. Estratégia mobile-first

- Tudo desenhado primeiro em 360–414px.
- **Bottom nav fixa no mobile** (5 itens principais) + FAB opcional para ação primária.
- **Sidebar colapsável no desktop** (≥ md), recolhe pra ícones.
- **Header compacto** (56px mobile / 64px desktop) com título da rota + ação contextual.
- Conteúdo em `max-w-screen-sm` no mobile com padding 16px, sem tabelas — sempre cards.
- `overflow-x: hidden` no shell + `min-w-0` nos filhos flex pra zerar overflow horizontal.
- Safe-area iOS (`env(safe-area-inset-bottom)`) na bottom nav.

## 3. Estrutura de componentes

```text
src/
  styles.css                       # tokens premium (oklch)
  components/
    layout/
      AppShell.tsx                 # provider + grid responsivo
      AppSidebar.tsx               # desktop, colapsável
      MobileBottomNav.tsx          # mobile fixa
      AppHeader.tsx                # header compacto + breadcrumb leve
      PageContainer.tsx            # padding + max-width consistente
    ui-premium/
      StatCard.tsx                 # métricas dashboard
      ListCard.tsx                 # card compacto de cliente/cobrança
      StatusBadge.tsx              # status visual (cores semânticas)
      ColorDot.tsx                 # cor de app/servidor
      EmptyState.tsx               # estados vazios amigáveis
      SectionHeader.tsx            # título + ação + tooltip (?)
      HelpTip.tsx                  # ícone (?) com explicação curta
      QuickActionSheet.tsx         # bottom sheet de ações no mobile
      Skeletons.tsx                # skeleton loaders por tipo
      LoadingDots.tsx              # loading elegante
  routes/
    __root.tsx                     # injeta AppShell + Sonner + meta PWA
    index.tsx                      # Dashboard Dono (esqueleto premium)
    clientes.tsx                   # Gestão de clientes (busca + cards)
    cobrancas.tsx                  # Cobranças/vencimentos
    whatsapp.tsx                   # WhatsApp
    ia.tsx                         # IA
    pagamentos.tsx                 # Pagamentos
    servidores.tsx                 # Servidores
    aplicativos.tsx                # Aplicativos
    metricas.tsx                   # Métricas
    admin.index.tsx                # /admin — visão geral
    admin.empresas.tsx
    admin.receita.tsx
    admin.filas.tsx
    admin.falhas.tsx
```

Todas as telas vêm com: header, `SectionHeader`, skeleton enquanto "carrega" (mock 400ms), `EmptyState` amigável, e cards compactos — prontas para receber dados reais.

## 4. Português simples + tooltips

- Termos: "Clientes", "Vencimentos", "Cobranças", "Mensagens", "Assistente", "Pagamentos", "Servidores", "Aplicativos", "Resultados".
- Sem "dashboard", "queue", "log", "endpoint", "webhook" visíveis ao usuário final.
- Cada seção sensível ganha `<HelpTip>` com 1 frase explicando.

## 5. Performance visual

- Zero libs pesadas novas. Animações via Tailwind + CSS.
- `content-visibility: auto` nas listas longas, `will-change` só onde necessário.
- Skeletons evitam layout shift (alturas fixas).
- Code-split natural por rota (TanStack file-based).
- Sem re-render global: estado de UI local nos componentes.

## 6. PWA premium

- `public/manifest.json` com nome, theme-color combinando com `--primary`, ícones 192/512, `display: "standalone"`.
- Meta tags iOS (`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style: black-translucent`) no `__root.tsx`.
- Splash via theme-color + ícone. **Sem service worker** (evita travar preview Lovable — conforme guideline PWA).
- Safe-area respeitada em header e bottom nav.

## 7. Checklist de validação (após build)

- [ ] Sem overflow horizontal em 360/375/414px
- [ ] Bottom nav não cobre conteúdo (padding-bottom no container)
- [ ] Sidebar colapsa e expande em ≥ md
- [ ] Header fixo compacto, sem corte de título
- [ ] Cards não quebram em telas estreitas
- [ ] Skeletons aparecem antes do conteúdo mock
- [ ] EmptyState em todas as telas sem dados
- [ ] Tooltips (?) funcionando
- [ ] Tap targets ≥ 44px
- [ ] Contraste AA em texto principal
- [ ] PWA instalável (manifest válido, theme-color, ícones)
- [ ] Safe-area iOS aplicada

## Fora deste plano (explícito)

- Backend, Cloud, Mercado Pago, Evolution, IA, RLS, lógica de negócio.
- Dados reais — tudo mock visual.
- Service worker / offline.

Confirma que posso seguir nesse formato?
