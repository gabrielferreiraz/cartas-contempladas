export interface CartaCSV {
  Referencia: string;
  'Crédito Atualizado': string;
  Entrada: string;
  Prazo: string;
  'Valor de Parcela': string;
  'Prazo Diluído': string;
  'Parcela Diluída': string;
  Vencimento: string;
  'Taxa de Transferência': string;
}

export const HEADERS_CANONICOS: (keyof CartaCSV)[] = [
  'Referencia',
  'Crédito Atualizado',
  'Entrada',
  'Prazo',
  'Valor de Parcela',
  'Prazo Diluído',
  'Parcela Diluída',
  'Vencimento',
  'Taxa de Transferência',
];

export interface CartaNormalizada {
  referencia: string;
  credito_atualizado: number | null;
  entrada: number | null;
  prazo: number | null;
  valor_parcela: number | null;
  prazo_diluido: number | null;
  parcela_diluida: number | null;
  vencimento: string | null;
  taxa_transferencia: number | null;
  raw_data: Record<string, string>;
}

export interface CartaBanco {
  referencia: string;
  status: 'disponivel' | 'vendido';
  ausencias_consecutivas: number;
}

export interface DiffResult {
  novas: CartaNormalizada[];
  ausentes: string[];
  reaprecidas: string[];
  iguais: CartaNormalizada[];
}

export interface SyncResult {
  status: 'sucesso' | 'erro' | 'ignorado';
  linhas_recebidas?: number;
  novas_cartas?: number;
  marcadas_vendido?: number;
  sem_alteracao?: number;
  checksum_csv?: string;
  mensagem_erro?: string;
  stack_erro?: string;
  duracao_ms: number;
}

export interface SystemState {
  last_successful_sync: string;
  last_csv_checksum: string | null;
  total_disponivel: number;
  total_vendido: number;
}
