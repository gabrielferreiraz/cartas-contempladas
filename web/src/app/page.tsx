import { createClient } from '@supabase/supabase-js';
import { RefreshControl } from './RefreshControl';
import { CategoryView } from './CategoryView';

export const dynamic = 'force-dynamic';

function getClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

const CAMPOS =
  'referencia,credito_atualizado,entrada,prazo,valor_parcela,prazo_diluido,parcela_diluida,vencimento,taxa_transferencia';

export default async function Page() {
  const client = getClient();

  const [dispImoveisRes, dispAutoRes, stateRes, logRes] = await Promise.all([
    client.from('cartas_credito').select(CAMPOS)
      .eq('status', 'disponivel').eq('tipo', 'imovel')
      .order('credito_atualizado', { ascending: false }),
    client.from('cartas_credito').select(CAMPOS)
      .eq('status', 'disponivel').eq('tipo', 'automovel')
      .order('credito_atualizado', { ascending: false }),
    client.from('system_state').select('key,value'),
    client.from('sync_logs').select('status,finalizado_em')
      .order('created_at', { ascending: false }).limit(2),
  ]);

  const state: Record<string, string> = {};
  for (const row of stateRes.data ?? []) {
    state[row.key] = String(row.value).replace(/^"|"$/g, '');
  }

  const totais = {
    imovel:    { disponivel: dispImoveisRes.data?.length ?? 0 },
    automovel: { disponivel: dispAutoRes.data?.length   ?? 0 },
  };

  const syncImovel    = state['last_successful_sync_imovel']    ?? null;
  const syncAutomovel = state['last_successful_sync_automovel'] ?? null;
  const lastSync = [syncImovel, syncAutomovel].filter(Boolean).sort().at(-1) ?? null;

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
        <div className="header-brand">
          <img src="/logo reobote.png" alt="Reobote" className="header-logo" />
          <div className="header-brand-divider" />
          <img src="/logo-servopa.svg" alt="Servopa" className="header-logo header-logo--servopa" />
        </div>
        <div className="header-right">
          <div className="status-bar">
            {badgeLabel && (
              <span className={`status-badge ${badgeClass}`}>{badgeLabel}</span>
            )}
            <RefreshControl iso={lastSync} />
          </div>
        </div>
      </header>

      <main>
        <CategoryView
          imoveis={{ disponiveis: dispImoveisRes.data ?? [] }}
          automoveis={{ disponiveis: dispAutoRes.data ?? [] }}
          totais={totais}
        />
      </main>
    </>
  );
}
