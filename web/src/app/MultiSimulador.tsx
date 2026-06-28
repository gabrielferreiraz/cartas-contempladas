'use client';

import { useEffect, useState } from 'react';
import type { Carta } from './CartasClient';
import { formatBRL } from './formatBRL';

interface Props {
  cartas: Carta[];
  onClose: () => void;
}

function fmt(v: number | null | undefined): string {
  if (v == null || isNaN(v as number)) return '—';
  return 'R$ ' + (v as number).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type SimState = { valorStr: string; pctStr: string };

export function MultiSimulador({ cartas, onClose }: Props) {
  const [estados, setEstados] = useState<Record<string, SimState>>(() =>
    Object.fromEntries(cartas.map(c => [c.referencia, { valorStr: '', pctStr: '' }]))
  );

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  function onValorChange(carta: Carta, rawInput: string) {
    const digits = rawInput.replace(/\D/g, '');
    const entradaTSI = carta.entrada ?? 0;
    const credito = carta.credito_atualizado ?? 0;
    const v = parseInt(digits, 10);
    let pctStr = '';
    if (!isNaN(v) && credito > 0) {
      const pct = ((v - entradaTSI) / credito) * 100;
      pctStr = pct >= 0 ? round2(pct).toString() : '';
    }
    setEstados(prev => ({ ...prev, [carta.referencia]: { valorStr: digits, pctStr } }));
  }

  function onPctChange(carta: Carta, raw: string) {
    const entradaTSI = carta.entrada ?? 0;
    const credito = carta.credito_atualizado ?? 0;
    let valorStr = '';
    const p = parseFloat(raw);
    if (!isNaN(p) && p >= 0 && credito > 0) {
      valorStr = Math.round(entradaTSI + (p / 100) * credito).toString();
    }
    setEstados(prev => ({ ...prev, [carta.referencia]: { valorStr, pctStr: raw } }));
  }

  const resultados = cartas.map(carta => {
    const { valorStr, pctStr } = estados[carta.referencia] ?? { valorStr: '', pctStr: '' };
    const entradaTSI      = carta.entrada           ?? 0;
    const credito         = carta.credito_atualizado ?? 0;
    const taxaTransf      = carta.taxa_transferencia ?? 0;
    const parcelaSemSeg   = carta.valor_parcela      ?? 0;
    const seguroMensal    = credito * 0.0004;
    const parcelaTotal    = parcelaSemSeg + seguroMensal;
    const sinal           = entradaTSI * 0.30;
    const valorNum        = valorStr !== '' ? parseFloat(valorStr) : null;
    const valorValido     = valorNum !== null && !isNaN(valorNum) && valorNum >= entradaTSI;
    const comissao        = valorValido && valorNum !== null ? valorNum - entradaTSI : null;
    const totalAteTransf  = valorNum !== null ? valorNum + taxaTransf : null;
    const temEntrada      = valorStr !== '' || pctStr !== '';
    return { carta, valorStr, pctStr, entradaTSI, credito, taxaTransf, parcelaTotal, sinal, valorNum, valorValido, comissao, totalAteTransf, temEntrada, seguroMensal, parcelaSemSeg };
  });

  // Totais combinados
  const totalCredito    = cartas.reduce((s, c) => s + (c.credito_atualizado ?? 0), 0);
  const totalSinal      = cartas.reduce((s, c) => s + (c.entrada ?? 0) * 0.30, 0);
  const totalEntradaTSI = cartas.reduce((s, c) => s + (c.entrada ?? 0), 0);
  const allValidos      = resultados.every(r => r.valorValido);
  const totalComissao   = allValidos ? resultados.reduce((s, r) => s + (r.comissao ?? 0), 0) : null;
  const totalParcelas   = allValidos ? resultados.reduce((s, r) => s + r.parcelaTotal, 0) : null;
  const totalAteTransf  = allValidos ? resultados.reduce((s, r) => s + (r.totalAteTransf ?? 0), 0) : null;

  return (
    <>
      <div className="sim-overlay" onClick={onClose} aria-hidden="true" />

      <aside className="sim-drawer sim-drawer--wide" role="dialog" aria-modal="true" aria-label="Simulação Multi-Cota">

        {/* ── Header ── */}
        <div className="sim-header">
          <div>
            <p className="sim-header-eyebrow">Simulação Multi-Cota</p>
            <h2 className="sim-header-title">
              {cartas.length} cotas · Crédito total {fmt(totalCredito)}
            </h2>
          </div>
          <button className="sim-close" onClick={onClose} aria-label="Fechar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div className="sim-body">

          {/* Card individual por cota */}
          {resultados.map((r, i) => (
            <section key={r.carta.referencia} className="multi-card">
              <div className="multi-card-header">
                <span className="multi-card-num">{i + 1}</span>
                <div className="multi-card-title-group">
                  <span className="multi-card-ref">Cota {r.carta.referencia}</span>
                  <span className="multi-card-meta">
                    Crédito {fmt(r.credito)} · Entrada TSI {fmt(r.entradaTSI)}
                  </span>
                </div>
              </div>

              <div className="sim-negocia-grid">
                <div className="sim-input-group">
                  <label className="sim-input-label">Valor cobrado</label>
                  <div className={`sim-input-wrap${r.temEntrada && !r.valorValido ? ' error' : ''}`}>
                    <span className="sim-input-prefix">R$</span>
                    <input
                      className="sim-input"
                      type="text"
                      inputMode="numeric"
                      placeholder={r.entradaTSI.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                      value={formatBRL(r.valorStr)}
                      onChange={e => onValorChange(r.carta, e.target.value)}
                    />
                  </div>
                </div>
                <div className="sim-input-group">
                  <label className="sim-input-label">% s/ crédito</label>
                  <div className={`sim-input-wrap${r.temEntrada && !r.valorValido ? ' error' : ''}`}>
                    <input
                      className="sim-input sim-input--pct"
                      type="number"
                      min={0}
                      step={0.1}
                      placeholder="0,00"
                      value={r.pctStr}
                      onChange={e => onPctChange(r.carta, e.target.value)}
                    />
                    <span className="sim-input-suffix">%</span>
                  </div>
                </div>
              </div>

              {r.temEntrada && !r.valorValido && (
                <p className="sim-input-error">Valor abaixo da entrada mínima TSI ({fmt(r.entradaTSI)})</p>
              )}

              {r.valorValido && r.comissao !== null && (
                <div className="multi-card-results">
                  <div className="multi-card-result-item multi-card-result-item--highlight">
                    <span className="multi-card-result-label">Comissão</span>
                    <span className="multi-card-result-value">{fmt(r.comissao)}</span>
                  </div>
                  <div className="multi-card-result-item">
                    <span className="multi-card-result-label">Sinal</span>
                    <span className="multi-card-result-value">{fmt(r.sinal)}</span>
                  </div>
                  <div className="multi-card-result-item">
                    <span className="multi-card-result-label">Parcela + seguro</span>
                    <span className="multi-card-result-value">{fmt(r.parcelaTotal)}<span className="multi-card-result-unit">/mês</span></span>
                  </div>
                  <div className="multi-card-result-item">
                    <span className="multi-card-result-label">Total até transf.</span>
                    <span className="multi-card-result-value">{fmt(r.totalAteTransf)}</span>
                  </div>
                </div>
              )}
            </section>
          ))}

          {/* ── Resumo combinado ── */}
          <div className="sim-divider" />

          <section className="sim-section">
            <h3 className="sim-section-title">Resumo Combinado</h3>

            <div className="multi-summary-grid">
              <div className="multi-summary-item">
                <span className="multi-summary-label">Crédito total</span>
                <span className="multi-summary-value">{fmt(totalCredito)}</span>
              </div>
              <div className="multi-summary-item">
                <span className="multi-summary-label">Entrada TSI total</span>
                <span className="multi-summary-value">{fmt(totalEntradaTSI)}</span>
              </div>
              <div className="multi-summary-item multi-summary-item--highlight">
                <span className="multi-summary-label">Comissão total</span>
                <span className={`multi-summary-value ${allValidos ? 'multi-summary-value--emerald' : 'multi-summary-value--muted'}`}>
                  {allValidos && totalComissao !== null ? fmt(totalComissao) : '—'}
                </span>
              </div>
              <div className="multi-summary-item">
                <span className="multi-summary-label">Sinal total</span>
                <span className="multi-summary-value">{fmt(totalSinal)}</span>
              </div>
              <div className="multi-summary-item">
                <span className="multi-summary-label">Parcelas/mês</span>
                <span className={`multi-summary-value ${!allValidos ? 'multi-summary-value--muted' : ''}`}>
                  {allValidos && totalParcelas !== null ? fmt(totalParcelas) : '—'}
                </span>
              </div>
            </div>

            {allValidos && totalAteTransf !== null && (
              <div className="sim-summary" style={{ marginTop: '1rem' }}>
                <div className="sim-summary-row">
                  <span>Sinal total para início dos cadastros</span>
                  <span>{fmt(totalSinal)}</span>
                </div>
                <div className="sim-summary-row sim-summary-row--total">
                  <span>Total até a transferência (todas as cotas)</span>
                  <span>{fmt(totalAteTransf)}</span>
                </div>
              </div>
            )}

            {!allValidos && (
              <p className="multi-summary-hint">
                Preencha o valor de todas as {cartas.length} cotas para ver o resumo combinado.
              </p>
            )}
          </section>

        </div>
      </aside>
    </>
  );
}
