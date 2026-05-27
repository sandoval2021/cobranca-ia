// Utilitário isomórfico para limpar respostas da IA antes de mostrar ao usuário.
// Remove UUIDs, JSON cru, stack traces e termos técnicos internos.

const UUID_RE = /\b[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}\b/gi;
const STACK_RE = /\s*at\s+\S+\s*\([^)]*:\d+:\d+\)/g;
const CODEBLOCK_RE = /```[\s\S]*?```/g;
const INTERNAL_TERMS = [
  /\bauth\.[a-z_]+\b/gi,
  /\bpublic\.[a-z_]+\b/gi,
  /\bSUPABASE[_A-Z]*\b/g,
  /\bRLS\b/g,
  /\bservice[_-]?role\b/gi,
];

export function sanitizeAiOutput(input: string): string {
  if (!input) return "";
  let out = input;
  out = out.replace(CODEBLOCK_RE, "[trecho técnico removido]");
  out = out.replace(UUID_RE, "[identificador]");
  out = out.replace(STACK_RE, "");
  for (const re of INTERNAL_TERMS) out = out.replace(re, "[detalhe interno]");
  // Normaliza espaços
  out = out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return out;
}
