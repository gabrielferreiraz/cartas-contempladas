import { fetchCSV } from './fetcher.js';
import { parseCSV } from './parser.js';
import { calcularDiff } from './differ.js';
import {
  getLockId,
  tryAdvisoryLock,
  releaseAdvisoryLock,
  getLastChecksum,
  getCartasDisponiveis,
  getCartasVendidas,
  sincronizarCartasCSV,
  incrementarAusencias,
  marcarVendidas,
  atualizarUltimoSync,
  atualizarSystemState,
  contarTotais,
  inserirSyncLog,
} from './database.js';
import { logger } from './logger.js';

export async function runSync(tipo: 'imovel' | 'automovel', csvUrl: string): Promise<void> {
  const iniciado_em = new Date().toISOString();
  const inicio = Date.now();
  const soldThreshold = parseInt(process.env.SOLD_THRESHOLD ?? '2', 10);
  const lockId = getLockId(tipo);

  // PASSO 1 — Advisory Lock (ID distinto por tipo)
  let lockAcquired = false;
  try {
    lockAcquired = await tryAdvisoryLock(lockId);
  } catch (err) {
    logger.warn('advisory_lock_falhou', { tipo, message: (err as Error).message });
    return;
  }

  if (!lockAcquired) {
    logger.info('sync_pulado_lock_ocupado', { tipo });
    return;
  }

  let checksum: string | undefined;

  try {
    // PASSO 2 — Fetch do CSV
    let csvContent: string;
    try {
      const fetched = await fetchCSV(csvUrl);
      csvContent = fetched.content;
      checksum = fetched.checksum;
    } catch (err) {
      const msg = (err as Error).message;
      const stack = (err as Error).stack;
      logger.error('fetch_falhou', { tipo, message: msg });
      await inserirSyncLog({
        iniciado_em,
        finalizado_em: new Date().toISOString(),
        status: 'erro',
        mensagem_erro: msg,
        stack_erro: stack,
      });
      return;
    }

    // PASSO 3 — Parse e Validação (antecipado para viabilizar checagem de ausentes)
    const { cartas, headersValidos, totalLinhasBrutas, linhasIgnoradas } = parseCSV(csvContent);

    if (!headersValidos) {
      const msg = 'Headers do CSV não correspondem ao schema esperado';
      logger.error('parse_falhou_headers', { tipo, msg });
      await inserirSyncLog({
        iniciado_em,
        finalizado_em: new Date().toISOString(),
        status: 'erro',
        checksum_csv: checksum,
        mensagem_erro: msg,
      });
      return;
    }

    if (cartas.length === 0) {
      const msg = 'CSV sem linhas de dados válidas após parsing';
      logger.error('parse_falhou_sem_linhas', { tipo, msg });
      await inserirSyncLog({
        iniciado_em,
        finalizado_em: new Date().toISOString(),
        status: 'erro',
        checksum_csv: checksum,
        mensagem_erro: msg,
      });
      return;
    }

    // PASSO 4 — Checksum (chave escopada por tipo)
    // Quando o CSV não mudou, ainda verificamos ausências: cotas que estavam
    // disponíveis no banco mas sumiram da planilha precisam ter o contador
    // incrementado mesmo sem conteúdo novo.
    const forceSync = process.env.FORCE_SYNC === '1';
    if (forceSync) {
      logger.warn('force_sync_ativo', { tipo });
    }

    const ultimoChecksum = await getLastChecksum(tipo);
    if (!forceSync && ultimoChecksum && ultimoChecksum === checksum) {
      const cartasDisponiveisBanco = await getCartasDisponiveis(tipo);
      const referenciasCSV = new Set(cartas.map((c) => c.referencia));
      const ausenteRefs = cartasDisponiveisBanco
        .filter((c) => !referenciasCSV.has(c.referencia))
        .map((c) => c.referencia);

      if (ausenteRefs.length === 0) {
        // Nenhuma divergência — atualiza só o timestamp para a UI mostrar "agora mesmo"
        logger.info('sync_ignorado_checksum_igual', { tipo, checksum });
        logger.info('db_vs_csv', {
          tipo,
          csv_count: cartas.length,
          db_disponivel: cartasDisponiveisBanco.length,
          diferenca: cartasDisponiveisBanco.length - cartas.length,
          status: cartasDisponiveisBanco.length === cartas.length ? 'em_dia' : 'divergente',
        });
        await atualizarUltimoSync(tipo);
        await inserirSyncLog({
          iniciado_em,
          finalizado_em: new Date().toISOString(),
          status: 'ignorado',
          checksum_csv: checksum,
        });
        return;
      }

      // Há cotas ausentes — contabiliza e marca vendidas se atingiu threshold
      logger.warn('ausentes_detectados', { tipo, refs: ausenteRefs, total: ausenteRefs.length });
      await incrementarAusencias(tipo, ausenteRefs);
      const totalMarcadas = await marcarVendidas(tipo, ausenteRefs, soldThreshold);

      if (totalMarcadas > 0) {
        const totais = await contarTotais(tipo);
        await atualizarSystemState({
          tipo,
          checksum: checksum!,
          totalDisponivel: totais.disponivel,
          totalVendido: totais.vendido,
        });
        logger.info('sync_ausentes_marcados_vendidos', { tipo, total: totalMarcadas, pendentes: ausenteRefs.length - totalMarcadas });
      } else {
        await atualizarUltimoSync(tipo);
        logger.info('sync_ausentes_contados', { tipo, refs: ausenteRefs, count: ausenteRefs.length, threshold_atual: soldThreshold });
      }

      const dbDisponivelPos = cartasDisponiveisBanco.length - totalMarcadas;
      logger.info('db_vs_csv', {
        tipo,
        csv_count: cartas.length,
        db_disponivel: dbDisponivelPos,
        diferenca: dbDisponivelPos - cartas.length,
        status: dbDisponivelPos === cartas.length ? 'em_dia' : 'aguardando_threshold',
      });
      await inserirSyncLog({
        iniciado_em,
        finalizado_em: new Date().toISOString(),
        status: 'ignorado',
        checksum_csv: checksum,
      });
      return;
    }

    if (linhasIgnoradas > 0) {
      logger.warn('linhas_ignoradas', { tipo, count: linhasIgnoradas });
    }

    // PASSO 5 — Diff (todas as queries já filtram por tipo)
    const cartasDisponiveisBanco = await getCartasDisponiveis(tipo);
    const referenciasCSV = cartas.map((c) => c.referencia);
    const cartasVendidasReaprecidas = await getCartasVendidas(tipo, referenciasCSV);

    const diff = calcularDiff(cartas, cartasDisponiveisBanco, cartasVendidasReaprecidas);

    logger.info('diff_calculado', {
      tipo,
      novas: diff.novas.length,
      ausentes: diff.ausentes.length,
      reaprecidas: diff.reaprecidas.length,
      iguais: diff.iguais.length,
      ...(diff.novas.length > 0     && { novas_refs: diff.novas.map(c => c.referencia) }),
      ...(diff.ausentes.length > 0  && { ausentes_refs: diff.ausentes }),
      ...(diff.reaprecidas.length > 0 && { reaprecidas_refs: diff.reaprecidas }),
    });

    // PASSO 6 — Operações no banco
    try {
      // Upsert de TODAS as cartas do CSV (novas + iguais + reaprecidas):
      // atualiza campos numéricos e zera ausencias para cartas que voltaram.
      await sincronizarCartasCSV(tipo, cartas);

      if (diff.reaprecidas.length > 0) {
        logger.warn('carta_reaprecida_apos_vendida', { tipo, referencias: diff.reaprecidas });
      }

      await incrementarAusencias(tipo, diff.ausentes);
      const totalMarcadas = await marcarVendidas(tipo, diff.ausentes, soldThreshold);

      const totais = await contarTotais(tipo);
      await atualizarSystemState({
        tipo,
        checksum: checksum!,
        totalDisponivel: totais.disponivel,
        totalVendido: totais.vendido,
      });

      // PASSO 7 — Log de auditoria (sucesso)
      const duracao_ms = Date.now() - inicio;
      await inserirSyncLog({
        iniciado_em,
        finalizado_em: new Date().toISOString(),
        status: 'sucesso',
        linhas_recebidas: totalLinhasBrutas,
        novas_cartas: diff.novas.length,
        marcadas_vendido: totalMarcadas,
        sem_alteracao: diff.iguais.length,
        checksum_csv: checksum,
      });

      logger.info('sync_completo', {
        tipo,
        novas: diff.novas.length,
        vendidas: totalMarcadas,
        ignoradas: diff.iguais.length,
        duracao_ms,
      });
      const diferenca = totais.disponivel - cartas.length;
      logger.info('db_vs_csv', {
        tipo,
        csv_count: cartas.length,
        db_disponivel: totais.disponivel,
        diferenca,
        status: diferenca === 0 ? 'em_dia' : 'aguardando_threshold',
      });
      if (diferenca !== 0) {
        // Itens do diff.ausentes que ainda não bateram o threshold ficam no banco como disponivel
        const pendentes = diff.ausentes.length - totalMarcadas;
        logger.warn('db_csv_divergencia', {
          tipo,
          csv_count: cartas.length,
          db_disponivel: totais.disponivel,
          extras_no_db: diferenca,
          ausentes_do_csv: diff.ausentes,
          marcados_vendido_agora: totalMarcadas,
          pendentes_proximo_sync: pendentes,
        });
      }
    } catch (err) {
      const msg = (err as Error).message;
      const stack = (err as Error).stack;
      logger.error('sync_erro_banco', { tipo, message: msg });
      await inserirSyncLog({
        iniciado_em,
        finalizado_em: new Date().toISOString(),
        status: 'erro',
        checksum_csv: checksum,
        mensagem_erro: msg,
        stack_erro: stack,
      });
    }
  } finally {
    // PASSO 8 — Libera lock SEMPRE
    await releaseAdvisoryLock(lockId);
  }
}
