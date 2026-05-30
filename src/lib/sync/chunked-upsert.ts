// Helper para upsert em lote sem deadlock.
//
// Causa raiz dos erros "deadlock detected" / "statement timeout" /
// "Timed out acquiring connection from connection pool" nas funções
// bulkUpsert* (trial_leads, trial_followups, auto_templates, customer_extras):
// duas chamadas concorrentes (abas/dispositivos diferentes) faziam upsert
// das MESMAS linhas em ORDEM DIFERENTE → Postgres adquiria locks de linha
// em ordens distintas → deadlock → uma transação abortada, a outra ainda
// segurando a conexão → próximas leituras estouravam o pool.
//
// Correção:
//  1. ordena as linhas por uma chave estável ANTES do upsert (mesma ordem
//     em todas as chamadas → ordem de aquisição de lock previsível);
//  2. quebra em chunks pequenos (200) executados sequencialmente, para
//     reduzir tempo de cada transação e janela de lock;
//  3. mantém contagem total para o retorno.
//
// Não altera o schema, não altera o RLS, não altera assinatura das server fns.

const DEFAULT_CHUNK_SIZE = 200;

export type ChunkedUpsertOptions = {
  /** Cláusula onConflict do PostgREST (ex.: "id" ou "company_id,template_id"). */
  onConflict: string;
  /**
   * Colunas usadas para ordenar as linhas antes do upsert. Devem coincidir
   * com a chave de conflito para garantir ordem determinística entre chamadas
   * concorrentes na MESMA tabela.
   */
  sortKeys: string[];
  /** Tamanho do chunk. Default 200. */
  chunkSize?: number;
};

function compareByKeys<T extends Record<string, unknown>>(
  keys: string[],
): (a: T, b: T) => number {
  return (a, b) => {
    for (const k of keys) {
      const av = a[k];
      const bv = b[k];
      const as = av == null ? "" : String(av);
      const bs = bv == null ? "" : String(bv);
      if (as < bs) return -1;
      if (as > bs) return 1;
    }
    return 0;
  };
}

/**
 * Faz upsert em lote ordenado e particionado para evitar deadlocks.
 * Retorna a soma de `count` dos chunks (ou o total de linhas enviadas
 * quando o driver não retorna count).
 */
export async function chunkedOrderedUpsert<T extends Record<string, unknown>>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  table: string,
  rows: T[],
  opts: ChunkedUpsertOptions,
): Promise<number> {
  if (rows.length === 0) return 0;
  const chunkSize = Math.max(1, opts.chunkSize ?? DEFAULT_CHUNK_SIZE);
  const sorted = [...rows].sort(compareByKeys<T>(opts.sortKeys));
  let total = 0;
  for (let i = 0; i < sorted.length; i += chunkSize) {
    const slice = sorted.slice(i, i + chunkSize);
    const { error, count } = await supabase
      .from(table)
      .upsert(slice, { onConflict: opts.onConflict, count: "exact" });
    if (error) throw new Error(error.message);
    total += count ?? slice.length;
  }
  return total;
}
