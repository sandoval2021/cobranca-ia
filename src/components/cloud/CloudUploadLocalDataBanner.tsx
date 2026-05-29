// Banner reutilizável para enviar dados locais para a conta na nuvem.
// DESATIVADO: módulos migrados agora fazem auto-upload silencioso e escrita
// espelhada imediata via useDbFirstSync. O usuário não precisa mais ver
// avisos técnicos sobre dados "salvos apenas neste aparelho".

export type CloudUploadModule = {
  /** Identificador único do módulo (usado para dismiss e dedupe). */
  key: string;
  /** Quantos itens locais ainda não foram para a nuvem. */
  getPendingCount: () => number;
  /** Evento global emitido quando o estado de sincronização muda. */
  syncEvent: string;
  /** Faz o upload dos dados locais. Pode retornar qualquer DTO. */
  upload: () => Promise<unknown>;
};

type Props = {
  modules: CloudUploadModule[];
  title?: string;
  subtitle?: string;
  /** Sufixo único do dismissedKey. Útil para banners de telas diferentes. */
  storageScope?: string;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function CloudUploadLocalDataBanner(_props: Props) {
  return null;
}
