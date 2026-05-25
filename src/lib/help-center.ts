// Central de Ajuda local — 100% frontend, sem chamadas externas.

export type HelpCategory =
  | "primeiros_passos"
  | "clientes"
  | "telas_apps"
  | "renovacao"
  | "servidores"
  | "dns_rotas"
  | "seguranca"
  | "backup"
  | "financeiro"
  | "testes"
  | "indicacoes"
  | "campanhas"
  | "pendencias"
  | "ia_base"
  | "backend_futuro";

export const HELP_CATEGORY_LABEL: Record<HelpCategory, string> = {
  primeiros_passos: "Primeiros passos",
  clientes: "Clientes",
  telas_apps: "Telas e aplicativos",
  renovacao: "Renovação",
  servidores: "Servidores",
  dns_rotas: "DNS e Rotas",
  seguranca: "Segurança",
  backup: "Backup",
  financeiro: "Financeiro",
  testes: "Testes",
  indicacoes: "Indicações",
  campanhas: "Campanhas",
  pendencias: "Pendências",
  ia_base: "IA / Base de conhecimento",
  backend_futuro: "Backend futuro",
};

export type HelpArticle = {
  id: string;
  titulo: string;
  categoria: HelpCategory;
  resumo: string;
  conteudo: string[];
  tags: string[];
  modulo?: string;
  link?: string;
  prioridade: "alta" | "media" | "baixa";
  atualizado_em: string;
};

export type HelpFaq = {
  id: string;
  pergunta: string;
  resposta: string;
};

export type HelpFlow = {
  id: string;
  titulo: string;
  descricao: string;
  passos: { label: string; link?: string }[];
};

const TODAY = "2026-05-25";

export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: "comecar_do_zero",
    titulo: "Como começar do zero",
    categoria: "primeiros_passos",
    resumo: "Fluxo recomendado para configurar tudo antes de usar o sistema.",
    conteudo: [
      "1. Abra a Configuração Inicial para ver o checklist.",
      "2. Preencha os dados em Minha Revenda.",
      "3. Ative a Segurança Local (PIN) neste navegador.",
      "4. Faça um Backup Geral inicial.",
      "5. Cadastre seus Servidores e painéis.",
      "6. Configure DNS e Rotas (apenas organização local).",
      "7. Cadastre ou importe seus clientes.",
      "8. Rode o Diagnóstico para validar o ambiente.",
    ],
    tags: ["início", "setup", "configuração"],
    modulo: "Configuração Inicial",
    link: "/configuracao-inicial",
    prioridade: "alta",
    atualizado_em: TODAY,
  },
  {
    id: "cadastrar_cliente",
    titulo: "Como cadastrar um cliente",
    categoria: "clientes",
    resumo: "Adicione cliente, telas, app e vencimento.",
    conteudo: [
      "1. Abra Clientes e clique em Novo cliente.",
      "2. Preencha nome e contato.",
      "3. Adicione uma tela/app na seção Telas e aplicativos.",
      "4. Vincule o servidor responsável pela tela.",
      "5. Informe o vencimento da tela.",
      "6. Salve. A tela aparece na Operação do dia conforme o vencimento.",
    ],
    tags: ["cliente", "tela", "cadastro"],
    modulo: "Clientes",
    link: "/clientes",
    prioridade: "alta",
    atualizado_em: TODAY,
  },
  {
    id: "cadastrar_app_pago",
    titulo: "Como cadastrar um app pago",
    categoria: "telas_apps",
    resumo: "Bob Player, IBO, Vu, Eagle e similares.",
    conteudo: [
      "Apps pagos têm vencimento próprio, separado da lista mensal.",
      "Informe o nome do app (Bob Player, IBO Player, Vu, Eagle, etc.).",
      "MAC e Key são opcionais — preencha quando o app exigir.",
      "O vencimento do app é controlado separadamente do vencimento da lista.",
      "A renovação do app é separada da renovação do servidor.",
    ],
    tags: ["app", "bob", "ibo", "vu", "eagle", "mac", "key"],
    modulo: "Telas e aplicativos",
    link: "/clientes",
    prioridade: "alta",
    atualizado_em: TODAY,
  },
  {
    id: "renovar_cliente",
    titulo: "Como renovar um cliente",
    categoria: "renovacao",
    resumo: "Renove uma ou várias telas de uma só vez.",
    conteudo: [
      "1. Abra o cliente e vá para a aba Telas.",
      "2. Clique em Renovar tela.",
      "3. Selecione uma ou várias telas.",
      "4. Abra o painel do servidor (link disponível na tela).",
      "5. Marque cada tela como renovado ou pulado.",
      "6. Finalize a renovação.",
      "7. Copie a confirmação para enviar ao cliente.",
    ],
    tags: ["renovação", "renovar", "telas"],
    modulo: "Clientes",
    link: "/clientes",
    prioridade: "alta",
    atualizado_em: TODAY,
  },
  {
    id: "usar_servidores",
    titulo: "Como usar Servidores",
    categoria: "servidores",
    resumo: "Cadastre painéis e vincule às telas dos clientes.",
    conteudo: [
      "1. Cadastre o servidor com nome e cor.",
      "2. Informe o painel (URL).",
      "3. Usuário e senha ficam protegidos pela Segurança Local.",
      "4. Vincule o servidor à tela do cliente.",
      "5. Cada tela mostra um badge com a cor do servidor.",
    ],
    tags: ["servidor", "painel", "badge"],
    modulo: "Servidores",
    link: "/catalogo-servidores",
    prioridade: "media",
    atualizado_em: TODAY,
  },
  {
    id: "usar_dns_rotas",
    titulo: "Como usar DNS e Rotas",
    categoria: "dns_rotas",
    resumo: "Organize domínios, subdomínios e rotas dos servidores.",
    conteudo: [
      "1. Cadastre o domínio (ex.: meudominio.com).",
      "2. Crie subdomínios (rotas) para cada servidor.",
      "3. Vincule a rota ao servidor correto.",
      "4. Marque uma rota como principal e outra como reserva.",
      "5. Use Usar rota principal para aplicar nas telas vinculadas.",
      "Importante: a alteração de DNS real continua manual no provedor.",
    ],
    tags: ["dns", "rota", "domínio", "subdomínio"],
    modulo: "DNS e Rotas",
    link: "/admin-dns-rotas",
    prioridade: "alta",
    atualizado_em: TODAY,
  },
  {
    id: "atendimento_rapido",
    titulo: "Como usar o Atendimento rápido",
    categoria: "clientes",
    resumo: "Copie mensagens prontas e abra painéis do servidor.",
    conteudo: [
      "1. Selecione a tela do cliente.",
      "2. Copie a mensagem pronta com 1 clique.",
      "3. Senha/Key só aparecem com a Segurança Local liberada.",
      "4. Abra portal, app ou painel do servidor quando necessário.",
      "Nada é enviado automaticamente — todas as mensagens são copiadas manualmente.",
    ],
    tags: ["atendimento", "mensagem", "copiar"],
    modulo: "Clientes",
    link: "/clientes",
    prioridade: "media",
    atualizado_em: TODAY,
  },
  {
    id: "campanhas_manuais",
    titulo: "Como usar Campanhas manuais",
    categoria: "campanhas",
    resumo: "Monte listas, copie mensagens em massa, sem envio automático.",
    conteudo: [
      "1. Escolha o público (vencendo, vencidos, ativos, etc.).",
      "2. Selecione os clientes desejados.",
      "3. Escolha um modelo de mensagem.",
      "4. Copie as mensagens uma a uma ou exporte a campanha.",
      "Nenhuma mensagem é enviada automaticamente.",
    ],
    tags: ["campanha", "mensagem", "lote"],
    modulo: "Campanhas",
    link: "/campanhas-manuais",
    prioridade: "media",
    atualizado_em: TODAY,
  },
  {
    id: "acompanhar_testes",
    titulo: "Como acompanhar testes",
    categoria: "testes",
    resumo: "Gerencie leads em teste até a conversão.",
    conteudo: [
      "1. Cadastre um novo teste com contato e data.",
      "2. Use a agenda para acompanhar o lead.",
      "3. Marque como Fechou ou Não fechou.",
      "4. Quando fechar, converta em cliente.",
      "5. Vincule a indicação responsável, se houver.",
    ],
    tags: ["teste", "lead", "conversão"],
    modulo: "Testes",
    link: "/testes",
    prioridade: "media",
    atualizado_em: TODAY,
  },
  {
    id: "indicacoes",
    titulo: "Como usar Indicações",
    categoria: "indicacoes",
    resumo: "Controle quem indicou e a bonificação aplicada.",
    conteudo: [
      "1. Cadastre a indicação informando quem indicou.",
      "2. Acompanhe o fechamento do indicado.",
      "3. Aplique a regra de bonificação configurada.",
      "4. Marque como bonificação aplicada quando concluir.",
    ],
    tags: ["indicação", "bonificação"],
    modulo: "Indicações",
    link: "/indicacoes",
    prioridade: "baixa",
    atualizado_em: TODAY,
  },
  {
    id: "financeiro",
    titulo: "Como usar o Financeiro",
    categoria: "financeiro",
    resumo: "Custos, entradas, objetivos e lucro líquido.",
    conteudo: [
      "1. Configure seus custos fixos e variáveis.",
      "2. Registre cada entrada (renovação, novo cliente, app).",
      "3. Defina objetivos mensais.",
      "4. A separação automática mostra quanto é custo e quanto é lucro.",
      "5. Acompanhe o lucro líquido em tempo real.",
    ],
    tags: ["financeiro", "lucro", "custo", "objetivo"],
    modulo: "Financeiro",
    link: "/financeiro",
    prioridade: "alta",
    atualizado_em: TODAY,
  },
  {
    id: "backup",
    titulo: "Como fazer Backup",
    categoria: "backup",
    resumo: "Exporte e importe o backup local de tudo.",
    conteudo: [
      "1. Abra Backup Geral.",
      "2. Use Exportar para baixar um arquivo .json completo.",
      "3. Para restaurar, use Importar e escolha mesclar ou substituir.",
      "4. Sempre faça backup antes de mudanças grandes.",
      "Dica: os dados ficam apenas neste navegador. Se limpar o cache, perde tudo.",
    ],
    tags: ["backup", "exportar", "importar"],
    modulo: "Backup Geral",
    link: "/backup-geral",
    prioridade: "alta",
    atualizado_em: TODAY,
  },
  {
    id: "seguranca_local",
    titulo: "Como usar Segurança Local",
    categoria: "seguranca",
    resumo: "PIN e modo protegido neste navegador.",
    conteudo: [
      "1. Crie um PIN local.",
      "2. Ative o modo protegido para esconder senhas e dados sensíveis.",
      "3. Ações sensíveis pedem confirmação com PIN.",
      "Importante: o PIN é apenas local — não substitui um login com backend real.",
    ],
    tags: ["pin", "segurança", "proteção"],
    modulo: "Segurança Local",
    link: "/seguranca-local",
    prioridade: "alta",
    atualizado_em: TODAY,
  },
  {
    id: "diagnostico",
    titulo: "Como interpretar o Diagnóstico",
    categoria: "primeiros_passos",
    resumo: "Alertas críticos, atenção e ações recomendadas.",
    conteudo: [
      "Críticos: precisam ser resolvidos antes de continuar.",
      "Atenção: revisar quando possível.",
      "Ações recomendadas: lista priorizada do que fazer agora.",
      "Use Exportar relatório para guardar um TXT do estado atual.",
    ],
    tags: ["diagnóstico", "alerta", "saúde"],
    modulo: "Diagnóstico",
    link: "/diagnostico",
    prioridade: "media",
    atualizado_em: TODAY,
  },
  {
    id: "backend_futuro",
    titulo: "Backend futuro (Supabase)",
    categoria: "backend_futuro",
    resumo: "Hoje tudo é local. Prepare antes de migrar.",
    conteudo: [
      "Hoje todos os dados ficam neste navegador (localStorage).",
      "No futuro, será necessário ativar Supabase/backend para multi-dispositivo.",
      "Use Preparação Backend para mapear entidades antes de migrar.",
      "Nunca crie migration no escuro — siga o checklist primeiro.",
    ],
    tags: ["backend", "supabase", "migração"],
    modulo: "Preparação Backend",
    link: "/preparacao-backend",
    prioridade: "baixa",
    atualizado_em: TODAY,
  },
];

export const HELP_FAQ: HelpFaq[] = [
  {
    id: "faq_envio_whatsapp",
    pergunta: "O sistema envia WhatsApp automaticamente?",
    resposta: "Não. Por enquanto tudo é manual/local. As mensagens são copiadas e enviadas por você.",
  },
  {
    id: "faq_dns_auto",
    pergunta: "O DNS é alterado automaticamente?",
    resposta: "Não. O módulo apenas organiza rotas. A alteração real deve ser feita no provedor (Cloudflare, Registro.br, etc.).",
  },
  {
    id: "faq_perder_dados",
    pergunta: "Posso perder os dados?",
    resposta: "Sim, se limpar cache/navegador. Por isso use Backup Geral com frequência.",
  },
  {
    id: "faq_pin_protege",
    pergunta: "O PIN protege tudo?",
    resposta: "Protege localmente neste navegador, mas não substitui um login com backend seguro.",
  },
  {
    id: "faq_app_vs_lista",
    pergunta: "App pago é a mesma coisa que lista mensal?",
    resposta: "Não. O app pago (Bob, IBO, Vu, Eagle) tem vencimento separado da lista mensal.",
  },
  {
    id: "faq_renovar_uma_tela",
    pergunta: "Posso renovar só uma tela?",
    resposta: "Sim. A renovação manual permite escolher uma ou várias telas do cliente.",
  },
  {
    id: "faq_indicacao",
    pergunta: "Um cliente indicou alguém. Como controlar?",
    resposta: "Use Indicações e vincule ao teste/lead correspondente.",
  },
  {
    id: "faq_lucro_real",
    pergunta: "Como saber o lucro real?",
    resposta: "Use o Financeiro com custos cadastrados e objetivos definidos.",
  },
];

export const HELP_FLOWS: HelpFlow[] = [
  {
    id: "fluxo_primeira_config",
    titulo: "Primeira configuração",
    descricao: "Tudo o que você precisa fazer antes de operar.",
    passos: [
      { label: "Minha Revenda", link: "/configuracoes-revenda" },
      { label: "Segurança Local", link: "/seguranca-local" },
      { label: "Backup Geral", link: "/backup-geral" },
      { label: "Servidores", link: "/catalogo-servidores" },
      { label: "DNS e Rotas", link: "/admin-dns-rotas" },
      { label: "Financeiro", link: "/financeiro" },
      { label: "Diagnóstico", link: "/diagnostico" },
    ],
  },
  {
    id: "fluxo_cadastrar_cliente",
    titulo: "Cadastrar cliente novo",
    descricao: "Do cadastro até estar pronto para atendimento.",
    passos: [
      { label: "Clientes", link: "/clientes" },
      { label: "Telas e aplicativos", link: "/clientes" },
      { label: "Servidor", link: "/catalogo-servidores" },
      { label: "App (se houver)", link: "/clientes" },
      { label: "Vencimento", link: "/clientes" },
      { label: "Atendimento rápido", link: "/clientes" },
    ],
  },
  {
    id: "fluxo_renovar_cliente",
    titulo: "Renovar cliente",
    descricao: "Renovação manual de uma ou várias telas.",
    passos: [
      { label: "Abrir cliente", link: "/clientes" },
      { label: "Renovar tela", link: "/clientes" },
      { label: "Abrir painel servidor", link: "/catalogo-servidores" },
      { label: "Marcar renovado", link: "/clientes" },
      { label: "Finalizar", link: "/clientes" },
      { label: "Registrar financeiro", link: "/financeiro" },
    ],
  },
  {
    id: "fluxo_pediu_teste",
    titulo: "Pessoa pediu teste",
    descricao: "Do lead ao cliente convertido.",
    passos: [
      { label: "Testes", link: "/testes" },
      { label: "Novo teste", link: "/testes" },
      { label: "Acompanhar", link: "/testes" },
      { label: "Marcar Fechou", link: "/testes" },
      { label: "Converter em cliente", link: "/clientes" },
      { label: "Registrar financeiro", link: "/financeiro" },
    ],
  },
  {
    id: "fluxo_trocar_rota",
    titulo: "Trocar rota / servidor",
    descricao: "Quando precisar mover telas para outra rota.",
    passos: [
      { label: "DNS e Rotas", link: "/admin-dns-rotas" },
      { label: "Ver impacto", link: "/admin-dns-rotas" },
      { label: "Alterar rota", link: "/admin-dns-rotas" },
      { label: "Usar rota principal", link: "/admin-dns-rotas" },
      { label: "Diagnóstico", link: "/diagnostico" },
    ],
  },
];

export function listHelpArticles(): HelpArticle[] {
  return [...HELP_ARTICLES];
}

export function getHelpArticleById(id: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.id === id);
}

export function getHelpArticlesByCategory(category: HelpCategory): HelpArticle[] {
  return HELP_ARTICLES.filter((a) => a.categoria === category);
}

export function searchHelpArticles(query: string): HelpArticle[] {
  const q = query.trim().toLowerCase();
  if (!q) return listHelpArticles();
  return HELP_ARTICLES.filter((a) => {
    return (
      a.titulo.toLowerCase().includes(q) ||
      a.resumo.toLowerCase().includes(q) ||
      a.conteudo.some((c) => c.toLowerCase().includes(q)) ||
      a.tags.some((t) => t.toLowerCase().includes(q)) ||
      (a.modulo ?? "").toLowerCase().includes(q) ||
      HELP_CATEGORY_LABEL[a.categoria].toLowerCase().includes(q)
    );
  });
}

export function exportHelpManualTxt(): void {
  if (typeof window === "undefined") return;
  const lines: string[] = [];
  const now = new Date();
  lines.push("MANUAL — COBRANÇA IA (uso local)");
  lines.push(`Gerado em: ${now.toLocaleString("pt-BR")}`);
  lines.push(
    "Observação: este manual explica o uso local do sistema. Nenhuma integração real está ativa.",
  );
  lines.push("");

  const cats = Object.keys(HELP_CATEGORY_LABEL) as HelpCategory[];
  for (const cat of cats) {
    const arts = getHelpArticlesByCategory(cat);
    if (arts.length === 0) continue;
    lines.push(`=== ${HELP_CATEGORY_LABEL[cat].toUpperCase()} ===`);
    for (const a of arts) {
      lines.push("");
      lines.push(`# ${a.titulo}`);
      lines.push(a.resumo);
      lines.push("");
      a.conteudo.forEach((c) => lines.push(c));
      if (a.modulo) lines.push(`Módulo: ${a.modulo}${a.link ? ` (${a.link})` : ""}`);
    }
    lines.push("");
  }

  lines.push("=== DÚVIDAS FREQUENTES ===");
  HELP_FAQ.forEach((f) => {
    lines.push("");
    lines.push(`P: ${f.pergunta}`);
    lines.push(`R: ${f.resposta}`);
  });
  lines.push("");

  lines.push("=== FLUXOS RECOMENDADOS ===");
  HELP_FLOWS.forEach((f) => {
    lines.push("");
    lines.push(`# ${f.titulo}`);
    lines.push(f.descricao);
    f.passos.forEach((p, i) =>
      lines.push(`  ${i + 1}. ${p.label}${p.link ? ` — ${p.link}` : ""}`),
    );
  });
  lines.push("");

  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  a.href = url;
  a.download = `manual-cobranca-ia-${yyyy}-${mm}-${dd}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
