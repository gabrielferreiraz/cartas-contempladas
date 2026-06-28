import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env vars não configuradas');
  return createClient(url, key);
}

export async function GET() {
  try {
    const client = getClient();

    const [stateResult, logResult] = await Promise.all([
      client.from('system_state').select('key, value'),
      client
        .from('sync_logs')
        .select('status, finalizado_em')
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
    ]);

    if (stateResult.error) {
      return NextResponse.json(
        { error: 'Erro ao ler system_state' },
        { status: 500 },
      );
    }

    const state: Record<string, unknown> = {};
    for (const row of stateResult.data ?? []) {
      state[row.key] = row.value;
    }

    const lastSync = String(state['last_successful_sync'] ?? 'never').replace(/^"|"$/g, '');
    const totalDisponivel = Number(state['total_disponivel'] ?? 0);
    const totalVendido = Number(state['total_vendido'] ?? 0);

    let lastSyncAgoMinutes: number | null = null;
    if (lastSync && lastSync !== 'never') {
      const diff = Date.now() - new Date(lastSync).getTime();
      lastSyncAgoMinutes = Math.floor(diff / 60_000);
    }

    const lastSyncStatus = logResult.data?.status ?? null;

    return NextResponse.json({
      last_successful_sync: lastSync === 'never' ? null : lastSync,
      total_disponivel: totalDisponivel,
      total_vendido: totalVendido,
      last_sync_status: lastSyncStatus,
      last_sync_ago_minutes: lastSyncAgoMinutes,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
