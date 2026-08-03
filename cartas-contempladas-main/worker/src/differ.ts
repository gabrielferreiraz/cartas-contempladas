import { CartaBanco, CartaNormalizada, DiffResult } from './types.js';

export function calcularDiff(
  cartasCSV: CartaNormalizada[],
  cartasBanco: CartaBanco[],
  cartasVendidasNoCSV: CartaBanco[],
): DiffResult {
  const refCSV = new Set(cartasCSV.map((c) => c.referencia));
  const refBancoDisponivel = new Set(cartasBanco.map((c) => c.referencia));
  const refBancoVendido = new Set(cartasVendidasNoCSV.map((c) => c.referencia));

  // Novas: estão no CSV mas não existem no banco em nenhum status
  const novas = cartasCSV.filter(
    (c) => !refBancoDisponivel.has(c.referencia) && !refBancoVendido.has(c.referencia),
  );

  // Ausentes: estavam disponíveis no banco mas sumiram do CSV
  const ausentes = cartasBanco
    .filter((c) => !refCSV.has(c.referencia))
    .map((c) => c.referencia);

  // Reaparecidas: estavam como 'vendido' no banco e voltaram ao CSV (anomalia)
  const reaprecidas = cartasVendidasNoCSV
    .filter((c) => refCSV.has(c.referencia))
    .map((c) => c.referencia);

  // Iguais: disponíveis no banco e presentes no CSV — retorna os dados do CSV
  // para que o sync possa atualizar os campos (crédito, parcela, etc.) na próxima upsert
  const iguais = cartasCSV.filter((c) => refBancoDisponivel.has(c.referencia));

  return { novas, ausentes, reaprecidas, iguais };
}
