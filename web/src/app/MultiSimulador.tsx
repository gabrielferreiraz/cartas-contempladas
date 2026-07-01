'use client';

import { useEffect } from 'react';
import type { Carta } from './CartasClient';

interface Props {
  cartas: Carta[];
  onClose: () => void;
}

function fmt(v: number | null | undefined): string {
  if (v == null || isNaN(v as number)) return '—';
  return 'R$ ' + (v as number).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const COMISSAO_PCT = 5;

export function MultiSimulador({ cartas, onClose }: Props) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const resultados = cartas.map(carta => {
    const entradaTSI     = carta.entrada           ?? 0;
    const credito        = carta.credito_atualizado ?? 0;
    const taxaTransf     = carta.taxa_transferencia ?? 0;
    const parcelaSemSeg  = carta.valor_parcela      ?? 0;
    const seguroMensal   = credito * 0.0004;
    const parcelaTotal   = parcelaSemSeg + seguroMensal;
    const comissao       = credito * (COMISSAO_PCT / 100);
    const valorCobrado   = entradaTSI + comissao;
    const sinal          = entradaTSI * 0.30;
    const totalAteTransf = valorCobrado + taxaTransf;
    return { carta, entradaTSI, credito, taxaTransf, parcelaTotal, sinal, comissao, valorCobrado, totalAteTransf, seguroMensal, parcelaSemSeg };
  });

  const totalCredito    = cartas.reduce((s, c) => s + (c.credito_atualizado ?? 0), 0);
  const totalEntradaTSI = cartas.reduce((s, c) => s + (c.entrada ?? 0), 0);
  const totalComissao   = resultados.reduce((s, r) => s + r.comissao, 0);
  const totalSinal      = resultados.reduce((s, r) => s + r.sinal, 0);
  const totalParcelas   = resultados.reduce((s, r) => s + r.parcelaTotal, 0);
  const totalAteTransf  = resultados.reduce((s, r) => s + r.totalAteTransf, 0);

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

              <div className="multi-card-results">
                <div className="multi-card-result-item multi-card-result-item--highlight">
                  <span className="multi-card-result-label">Comissão ({COMISSAO_PCT}%)</span>
                  <span className="multi-card-result-value">{fmt(r.comissao)}</span>
                </div>
                <div className="multi-card-result-item">
                  <span className="multi-card-result-label">Valor cobrado</span>
                  <span className="multi-card-result-value">{fmt(r.valorCobrado)}</span>
                </div>
                <div className="multi-card-result-item">
                  <span className="multi-card-result-label">Sinal</span>
                  <span className="multi-card-result-value">{fmt(r.sinal)}</span>
                </div>
                <div className="multi-card-result-item">
                  <span className="multi-card-result-label">Parcela + seguro</span>
                  <span className="multi-card-result-value">{fmt(r.parcelaTotal)}<span className="multi-card-result-unit">/mês</span></span>
                </div>
              </div>
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
                <span className="multi-summary-label">Comissão total ({COMISSAO_PCT}%)</span>
                <span className="multi-summary-value multi-summary-value--emerald">{fmt(totalComissao)}</span>
              </div>
              <div className="multi-summary-item">
                <span className="multi-summary-label">Sinal total</span>
                <span className="multi-summary-value">{fmt(totalSinal)}</span>
              </div>
              <div className="multi-summary-item">
                <span className="multi-summary-label">Parcelas/mês</span>
                <span className="multi-summary-value">{fmt(totalParcelas)}</span>
              </div>
            </div>

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
          </section>

        </div>
      </aside>
    </>
  );
}
