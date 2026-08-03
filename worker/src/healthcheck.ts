/**
 * Script autônomo — sem imports do worker.
 * Executado pelo Docker healthcheck: node dist/healthcheck.js
 * Sai com código 1 se o último sync bem-sucedido passou do threshold.
 */
import { createClient } from '@supabase/supabase-js';

async function check(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const intervalMinutes = parseInt(process.env.SYNC_INTERVAL_MINUTES ?? '5', 10);
  const thresholdMinutes = intervalMinutes * 3;

  if (!url || !key) {
    process.stderr.write('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidas\n');
    process.exit(1);
  }

  const client = createClient(url, key, { auth: { persistSession: false } });

  // Consulta os dois tipos e usa o sync mais antigo como referência de saúde:
  // se QUALQUER tipo parou de sincronizar, o container é unhealthy.
  const { data, error } = await client
    .from('system_state')
    .select('key,value')
    .in('key', ['last_successful_sync_imovel', 'last_successful_sync_automovel']);

  if (error) {
    process.stderr.write(`Erro ao consultar system_state: ${error.message}\n`);
    process.exit(1);
  }

  const rows = (data ?? []) as { key: string; value: unknown }[];
  const syncs = rows.map((r) => {
    const raw = typeof r.value === 'string' ? r.value.replace(/^"|"$/g, '') : String(r.value ?? '');
    return raw;
  }).filter(Boolean);

  // Nenhum registro ainda — aguarda o primeiro sync
  if (syncs.length === 0) {
    process.stdout.write('Aguardando primeiro sync\n');
    process.exit(0);
  }

  // Usa a data MAIS ANTIGA para detectar qual tipo está mais atrasado
  const lastSync = syncs.sort()[0];

  if (!lastSync || lastSync === 'never') {
    // Ainda não houve nenhum sync — dá uma janela de tolerância de 2x o threshold
    process.stdout.write('Aguardando primeiro sync\n');
    process.exit(0);
  }

  const lastSyncDate = new Date(lastSync);
  if (isNaN(lastSyncDate.getTime())) {
    process.stderr.write(`Data inválida em last_successful_sync: ${lastSync}\n`);
    process.exit(1);
  }

  const diffMinutes = (Date.now() - lastSyncDate.getTime()) / 60_000;

  if (diffMinutes > thresholdMinutes) {
    process.stderr.write(
      `Unhealthy: último sync há ${diffMinutes.toFixed(1)} min (threshold: ${thresholdMinutes} min)\n`,
    );
    process.exit(1);
  }

  process.stdout.write(`OK: último sync há ${diffMinutes.toFixed(1)} min\n`);
  process.exit(0);
}

check().catch((err: Error) => {
  process.stderr.write(`Healthcheck inesperado: ${err.message}\n`);
  process.exit(1);
});
