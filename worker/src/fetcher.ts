import { createHash } from 'crypto';
import { logger } from './logger.js';

const FETCH_TIMEOUT_MS = 15_000;
const MIN_BODY_BYTES = 100;

export interface FetchResult {
  content: string;
  checksum: string;
}

export async function fetchCSV(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const bustUrl = new URL(url);
  bustUrl.searchParams.set('_t', Date.now().toString());

  let response: Response;
  try {
    response = await fetch(bustUrl.toString(), { signal: controller.signal });
  } catch (err) {
    throw new Error(`Falha na requisição HTTP: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }

  if (response.status !== 200) {
    throw new Error(`HTTP ${response.status} ao buscar CSV`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/csv')) {
    logger.warn('content_type_inesperado', { contentType });
    // Google Sheets às vezes retorna text/plain ou application/octet-stream — aceita os dois como fallback
    if (!contentType.includes('text/plain') && !contentType.includes('application/')) {
      throw new Error(`Content-Type inválido: ${contentType}`);
    }
  }

  const content = await response.text();

  if (!content || content.length < MIN_BODY_BYTES) {
    throw new Error(`CSV vazio ou muito pequeno (${content?.length ?? 0} bytes)`);
  }

  const checksum = createHash('sha256').update(content).digest('hex');

  logger.info('csv_baixado', { bytes: content.length, checksum });

  return { content, checksum };
}
