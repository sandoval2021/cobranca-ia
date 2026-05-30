// Race a promise against a timeout. Used by DB-first hydrate callers para
// não segurar o connection pool indefinidamente quando um listXxxDb fica
// preso. Em timeout, rejeita com Error("timeout") — chamador trata como
// falha transitória e PRESERVA o cache local existente (não apaga lista,
// não sobrescreve banco).
export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`[timeout] ${label} excedeu ${ms}ms`);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  label = "operation",
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
  });
  return Promise.race([p, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}
