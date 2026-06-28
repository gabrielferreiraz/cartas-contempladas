import Papa from 'papaparse';
import { CartaCSV, CartaNormalizada, HEADERS_CANONICOS } from './types.js';
import { logger } from './logger.js';

function parseMoeda(valor: string): number | null {
  if (!valor || valor.trim() === '') return null;
  const limpo = valor
    .replace('R$', '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const num = parseFloat(limpo);
  return isNaN(num) ? null : num;
}

function parsePrazo(valor: string): number | null {
  if (!valor || valor.trim() === '' || valor.trim().toUpperCase() === 'NÃO DILUI') return null;
  const num = parseInt(valor.trim(), 10);
  return isNaN(num) ? null : num;
}

function parseData(valor: string): string | null {
  if (!valor || valor.trim() === '') return null;
  // Formato esperado: DD/MM/YYYY → YYYY-MM-DD
  const match = valor.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, dia, mes, ano] = match;
  return `${ano}-${mes}-${dia}`;
}

function validarHeaders(headers: string[]): boolean {
  return HEADERS_CANONICOS.every((h) => headers.includes(h));
}

export interface ParseResult {
  cartas: CartaNormalizada[];
  headersValidos: boolean;
  totalLinhasBrutas: number;
  linhasIgnoradas: number;
}

export function parseCSV(csvContent: string): ParseResult {
  const resultado = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    // Normaliza quebras de linha nos nomes das colunas (Google Sheets exporta com \n)
    transformHeader: (h) => {
      const normalized = h.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
      // Aba de automóveis exporta "Referência" (acento no ê); normaliza para o nome canônico
      return normalized === 'Referência' ? 'Referencia' : normalized;
    },
  });

  const headers = resultado.meta.fields ?? [];
  if (!validarHeaders(headers)) {
    logger.error('headers_invalidos', {
      esperados: HEADERS_CANONICOS,
      recebidos: headers,
    });
    return {
      cartas: [],
      headersValidos: false,
      totalLinhasBrutas: 0,
      linhasIgnoradas: 0,
    };
  }

  const totalLinhasBrutas = resultado.data.length;
  let linhasIgnoradas = 0;
  const cartas: CartaNormalizada[] = [];

  for (const linha of resultado.data as unknown as CartaCSV[]) {
    const ref = linha.Referencia?.trim();
    if (!ref) {
      linhasIgnoradas++;
      logger.warn('linha_sem_referencia', { linha });
      continue;
    }

    cartas.push({
      referencia: ref,
      credito_atualizado: parseMoeda(linha['Crédito Atualizado']),
      entrada: parseMoeda(linha['Entrada']),
      prazo: parsePrazo(linha['Prazo']),
      valor_parcela: parseMoeda(linha['Valor de Parcela']),
      prazo_diluido: parsePrazo(linha['Prazo Diluído']),
      parcela_diluida: parseMoeda(linha['Parcela Diluída']),
      vencimento: parseData(linha['Vencimento']),
      taxa_transferencia: parseMoeda(linha['Taxa de Transferência']),
      raw_data: { ...linha },
    });
  }

  return {
    cartas,
    headersValidos: true,
    totalLinhasBrutas,
    linhasIgnoradas,
  };
}
