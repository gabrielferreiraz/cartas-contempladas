import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CartaBanco, CartaNormalizada } from './types.js';
import { logger } from './logger.js';

let _client: SupabaseClient | null = null;

export function getClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias');
  }
  _client = createClient(url, key, {
    auth: { persistSession: false },
  });
  return _client;
}

// IDs distintos para que imóveis e automóveis possam ter locks independentes
const LOCK_IDS: Record<string, number> = {
  imovel:    777888,
  automovel: 777889,
};

export function getLockId(tipo: string): number {
  return LOCK_IDS[tipo] ?? 777999;
}

export async function tryAdvisoryLock(lockId: number): Promise<boolean> {
  const { data, error } = await getClient().rpc('try_advisory_lock', { lock_id: lockId });
  if (error) throw new Error(`Advisory lock falhou: ${error.message}`);
  return data as boolean;
}

export async function releaseAdvisoryLock(lockId: number): Promise<void> {
  const { error } = await getClient().rpc('advisory_unlock', { lock_id: lockId });
  if (error) logger.warn('advisory_unlock_erro', { message: error.message });
}

export async function getLastChecksum(tipo: string): Promise<string | null> {
  const { data, error } = await getClient()
    .from('system_state')
    .select('value')
    .eq('key', `last_csv_checksum_${tipo}`)
    .maybeSingle();
  if (error) throw new Error(`Erro ao ler checksum: ${error.message}`);
  const val = data?.value;
  return val == null || val === 'null' ? null : String(val).replace(/^"|"$/g, '');
}

export async function getCartasDisponiveis(tipo: string): Promise<CartaBanco[]> {
  const { data, error } = await getClient()
    .from('cartas_credito')
    .select('referencia, status, ausencias_consecutivas')
    .eq('status', 'disponivel')
    .eq('tipo', tipo);
  if (error) throw new Error(`Erro ao buscar cartas disponíveis: ${error.message}`);
  return (data ?? []) as CartaBanco[];
}

export async function getCartasVendidas(tipo: string, referencias: string[]): Promise<CartaBanco[]> {
  if (referencias.length === 0) return [];
  const { data, error } = await getClient()
    .from('cartas_credito')
    .select('referencia, status, ausencias_consecutivas')
    .eq('status', 'vendido')
    .eq('tipo', tipo)
    .in('referencia', referencias);
  if (error) throw new Error(`Erro ao buscar cartas vendidas: ${error.message}`);
  return (data ?? []) as CartaBanco[];
}

/**
 * Upsert em batch de TODAS as cartas presentes no CSV (novas + iguais + reaprecidas).
 * - Cartas novas: INSERT com primeira_vez_visto_em = DEFAULT (now())
 * - Cartas existentes: UPDATE de todos os campos numéricos + reset de ausencias
 * - Reaprecidas (vendido → disponivel): status e vendido_em são corrigidos
 * primeira_vez_visto_em é OMITIDO intencionalmente: no INSERT usa DEFAULT, no UPDATE fica intocado.
 */
export async function sincronizarCartasCSV(tipo: string, cartas: CartaNormalizada[]): Promise<void> {
  if (cartas.length === 0) return;
  const agora = new Date().toISOString();
  const rows = cartas.map((c) => ({
    referencia: c.referencia,
    tipo,
    status: 'disponivel' as const,
    ausencias_consecutivas: 0,
    vendido_em: null,
    credito_atualizado: c.credito_atualizado,
    entrada: c.entrada,
    prazo: c.prazo,
    valor_parcela: c.valor_parcela,
    prazo_diluido: c.prazo_diluido,
    parcela_diluida: c.parcela_diluida,
    vencimento: c.vencimento,
    taxa_transferencia: c.taxa_transferencia,
    raw_data: c.raw_data as unknown as object,
    ultima_vez_visto_em: agora,
    updated_at: agora,
  }));
  const { error } = await getClient()
    .from('cartas_credito')
    .upsert(rows, { onConflict: 'referencia,tipo' });
  if (error) throw new Error(`Erro ao sincronizar cartas do CSV: ${error.message}`);
}

export async function incrementarAusencias(tipo: string, referencias: string[]): Promise<void> {
  if (referencias.length === 0) return;
  const { error } = await getClient().rpc('incrementar_ausencias', { refs: referencias, p_tipo: tipo });
  if (error) throw new Error(`Erro ao incrementar ausências: ${error.message}`);
}

export async function marcarVendidas(tipo: string, referencias: string[], threshold: number): Promise<number> {
  if (referencias.length === 0) return 0;
  const { data, error } = await getClient()
    .from('cartas_credito')
    .update({ status: 'vendido', vendido_em: new Date().toISOString(), updated_at: new Date().toISOString() })
    .in('referencia', referencias)
    .eq('tipo', tipo)
    .gte('ausencias_consecutivas', threshold)
    .select('referencia');
  if (error) throw new Error(`Erro ao marcar vendidas: ${error.message}`);
  return (data ?? []).length;
}

export async function atualizarUltimoSync(tipo: string): Promise<void> {
  const agora = new Date().toISOString();
  const { error } = await getClient()
    .from('system_state')
    .upsert(
      { key: `last_successful_sync_${tipo}`, value: JSON.stringify(agora) as unknown as object, updated_at: agora },
      { onConflict: 'key' },
    );
  if (error) throw new Error(`Erro ao atualizar último sync: ${error.message}`);
}

export async function atualizarSystemState(params: {
  tipo: string;
  checksum: string;
  totalDisponivel: number;
  totalVendido: number;
}): Promise<void> {
  const { tipo } = params;
  const agora = new Date().toISOString();
  // Batch upsert — 1 request atômico em vez de 4 sequenciais
  const rows = [
    { key: `last_successful_sync_${tipo}`, value: JSON.stringify(agora) },
    { key: `last_csv_checksum_${tipo}`,    value: JSON.stringify(params.checksum) },
    { key: `total_disponivel_${tipo}`,     value: String(params.totalDisponivel) },
    { key: `total_vendido_${tipo}`,        value: String(params.totalVendido) },
  ].map((r) => ({ ...r, value: r.value as unknown as object, updated_at: agora }));

  const { error } = await getClient()
    .from('system_state')
    .upsert(rows, { onConflict: 'key' });
  if (error) throw new Error(`Erro ao atualizar system_state: ${error.message}`);
}

export async function contarTotais(tipo: string): Promise<{ disponivel: number; vendido: number }> {
  const { count: disponivel, error: e1 } = await getClient()
    .from('cartas_credito')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'disponivel')
    .eq('tipo', tipo);
  if (e1) throw new Error(`Erro ao contar disponíveis: ${e1.message}`);

  const { count: vendido, error: e2 } = await getClient()
    .from('cartas_credito')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'vendido')
    .eq('tipo', tipo);
  if (e2) throw new Error(`Erro ao contar vendidas: ${e2.message}`);

  return { disponivel: disponivel ?? 0, vendido: vendido ?? 0 };
}

export async function inserirSyncLog(params: {
  iniciado_em: string;
  finalizado_em: string;
  status: 'sucesso' | 'erro' | 'ignorado';
  linhas_recebidas?: number;
  novas_cartas?: number;
  marcadas_vendido?: number;
  sem_alteracao?: number;
  checksum_csv?: string;
  mensagem_erro?: string;
  stack_erro?: string;
}): Promise<void> {
  const { error } = await getClient().from('sync_logs').insert(params);
  if (error) logger.error('sync_log_insert_erro', { message: error.message });
}
