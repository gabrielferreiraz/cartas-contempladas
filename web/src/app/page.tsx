import { createClient } from '@supabase/supabase-js';
import { RefreshControl } from './RefreshControl';
import { CategoryView } from './CategoryView';

export const dynamic = 'force-dynamic';

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

const CAMPOS_DISPONIVEIS =
  'referencia,credito_atualizado,entrada,prazo,valor_parcela,prazo_diluido,parcela_diluida,vencimento,taxa_transferencia';
const CAMPOS_VENDIDAS =
  'referencia,credito_atualizado,entrada,prazo,valor_parcela,vencimento,vendido_em,primeira_vez_visto_em';

export default async function Page() {
  const client = getClient();

  const [
    dispImoveisRes,
    dispAutoRes,
    vendImoveisRes,
    vendAutoRes,
    stateRes,
    logRes,
  ] = await Promise.all([
    client.from('cartas_credito').select(CAMPOS_DISPONIVEIS)
      .eq('status', 'disponivel').eq('tipo', 'imovel')
      .order('credito_atualizado', { ascending: false }),
    client.from('cartas_credito').select(CAMPOS_DISPONIVEIS)
      .eq('status', 'disponivel').eq('tipo', 'automovel')
      .order('credito_atualizado', { ascending: false }),
    client.from('cartas_credito').select(CAMPOS_VENDIDAS)
      .eq('status', 'vendido').eq('tipo', 'imovel')
      .order('vendido_em', { ascending: false }).limit(500),
    client.from('cartas_credito').select(CAMPOS_VENDIDAS)
      .eq('status', 'vendido').eq('tipo', 'automovel')
      .order('vendido_em', { ascending: false }).limit(500),
    client.from('system_state').select('key,value'),
    client.from('sync_logs').select('status,finalizado_em')
      .order('created_at', { ascending: false }).limit(2),
  ]);

  const state: Record<string, string> = {};
  for (const row of stateRes.data ?? []) {
    state[row.key] = String(row.value).replace(/^"|"$/g, '');
  }

  const totais = {
    imovel: {
      disponivel: dispImoveisRes.data?.length ?? 0,
      vendido:    Number(state['total_vendido_imovel']    ?? vendImoveisRes.data?.length ?? 0),
    },
    automovel: {
      disponivel: dispAutoRes.data?.length ?? 0,
      vendido:    Number(state['total_vendido_automovel'] ?? vendAutoRes.data?.length ?? 0),
    },
  };

  // Timestamp mais recente entre os dois tipos para o header
  const syncImovel    = state['last_successful_sync_imovel']    ?? null;
  const syncAutomovel = state['last_successful_sync_automovel'] ?? null;
  const lastSync = [syncImovel, syncAutomovel]
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;

  // Pega o pior status entre os últimos 2 logs (cobre imovel + automovel, que rodam sequencialmente)
  const recentLogs = logRes.data ?? [];
  const lastSyncStatus: string | null =
    recentLogs.some((l) => l.status === 'erro')     ? 'erro'     :
    recentLogs.some((l) => l.status === 'sucesso')  ? 'sucesso'  :
    recentLogs.some((l) => l.status === 'ignorado') ? 'ignorado' : null;

  const badgeClass =
    lastSyncStatus === 'sucesso'  ? 'badge-sucesso'  :
    lastSyncStatus === 'erro'     ? 'badge-erro'      :
    lastSyncStatus === 'ignorado' ? 'badge-ignorado'  : '';
  const badgeLabel =
    lastSyncStatus === 'sucesso'  ? 'Atualizado'            :
    lastSyncStatus === 'erro'     ? 'Erro na sincronização' :
    lastSyncStatus === 'ignorado' ? 'Sem alterações'        : '';

  return (
    <>
      <header>
        <h1>Cartas Contempladas</h1>
        <div className="status-bar">
          {badgeLabel && (
            <span className={`status-badge ${badgeClass}`}>{badgeLabel}</span>
          )}
          <RefreshControl iso={lastSync} />
        </div>
      </header>

      <main>
        <CategoryView
          imoveis={{
            disponiveis: dispImoveisRes.data ?? [],
            vendidas:    vendImoveisRes.data ?? [],
          }}
          automoveis={{
            disponiveis: dispAutoRes.data ?? [],
            vendidas:    vendAutoRes.data ?? [],
          }}
          totais={totais}
        />
      </main>
    </>
  );
}
