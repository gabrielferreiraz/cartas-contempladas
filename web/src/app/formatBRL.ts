/**
 * Formata dígitos brutos como número brasileiro sem casas decimais.
 * Ex.: "50000" → "50.000"
 */
export function formatBRL(rawDigits: string): string {
  const digits = rawDigits.replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10);
  return isNaN(num) ? '' : num.toLocaleString('pt-BR');
}
