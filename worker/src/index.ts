import 'dotenv/config';
import http from 'node:http';
import cron from 'node-cron';
import { runSync } from './sync.js';
import { logger } from './logger.js';

const REQUIRED_ENV = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SHEETS_IMOVEIS_CSV_URL',
  'SHEETS_AUTOMOVEIS_CSV_URL',
] as const;

function validateEnv(): void {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    logger.error('env_faltando', { variaveis: missing });
    process.exit(1);
  }
}

let syncRunning = false;

async function runAllSyncs(): Promise<void> {
  if (syncRunning) {
    logger.info('sync_ignorado_ja_em_andamento');
    return;
  }
  syncRunning = true;
  try {
    const imoveisUrl   = process.env.SHEETS_IMOVEIS_CSV_URL!;
    const automovelUrl = process.env.SHEETS_AUTOMOVEIS_CSV_URL!;

    await runSync('imovel', imoveisUrl).catch((err: Error) => {
      logger.error('sync_imovel_erro_inesperado', { message: err.message });
    });

    await runSync('automovel', automovelUrl).catch((err: Error) => {
      logger.error('sync_automovel_erro_inesperado', { message: err.message });
    });
  } finally {
    syncRunning = false;
  }
}

function iniciarServidorHTTP(): void {
  // Easypanel (e plataformas similares) injetam PORT automaticamente.
  // TRIGGER_PORT serve de fallback para desenvolvimento local.
  const port = parseInt(process.env.PORT ?? process.env.TRIGGER_PORT ?? '3001', 10);

  const server = http.createServer((req, res) => {
    const url    = req.url ?? '/';
    const method = req.method ?? 'GET';

    // Health check
    if (method === 'GET' && url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // Trigger manual de sync
    if (method === 'POST' && url === '/sync') {
      logger.info('sync_manual_solicitado');
      runAllSyncs()
        .then(() => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        })
        .catch((err: Error) => {
          logger.error('sync_manual_erro', { message: err.message });
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: err.message }));
        });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(port, () => {
    logger.info('trigger_server_iniciado', { port });
  });
}

async function iniciar(): Promise<void> {
  validateEnv();

  const intervalMinutes = parseInt(process.env.SYNC_INTERVAL_MINUTES ?? '5', 10);
  const cronExpression  = `*/${intervalMinutes} * * * *`;

  logger.info('worker_iniciado', { intervalo_minutos: intervalMinutes });

  iniciarServidorHTTP();

  logger.info('sync_inicial');
  await runAllSyncs();

  cron.schedule(cronExpression, () => {
    runAllSyncs();
  });

  logger.info('cron_agendado', { expressao: cronExpression });
}

iniciar();
