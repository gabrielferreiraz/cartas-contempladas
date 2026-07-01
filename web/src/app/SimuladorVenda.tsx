'use client';

import { useEffect } from 'react';
import type { Carta } from './CartasClient';

interface Props {
  carta: Carta;
  onClose: () => void;
}

function fmt(v: number | null | undefined): string {
  if (v == null || isNaN(v as number)) return '—';
  return 'R$ ' + (v as number).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Seg = { startMonth: number; endMonth: number; monthly: number };

function buildTimeline(segs: Seg[]): { from: number; to: number; amount: number }[] {
  if (segs.length === 0) return [];
  const pts = new Set<number>();
  for (const s of segs) { pts.add(s.startMonth); pts.add(s.endMonth + 1); }
  const sorted = [...pts].sort((a, b) => a - b);
  const result: { from: number; to: number; amount: number }[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const from = sorted[i], to = sorted[i + 1] - 1;
    const amount = segs
      .filter(s => s.startMonth <= to && s.endMonth >= from)
      .reduce((sum, s) => sum + s.monthly, 0);
    if (amount > 0) result.push({ from, to, amount });
  }
  return result;
}

function cartaSegs(carta: Carta): Seg[] {
  const seguro = (carta.credito_atualizado ?? 0) * 0.0004;
  const segs: Seg[] = [];
  if (carta.prazo && carta.valor_parcela) {
    segs.push({ startMonth: 1, endMonth: carta.prazo, monthly: carta.valor_parcela + seguro });
  }
  if (carta.prazo && carta.prazo_diluido && carta.parcela_diluida) {
    segs.push({
      startMonth: carta.prazo + 1,
      endMonth:   carta.prazo + carta.prazo_diluido,
      monthly:    carta.parcela_diluida + seguro,
    });
  }
  return segs;
}

export function SimuladorVenda({ carta, onClose }: Props) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const credito      = carta.credito_atualizado ?? 0;
  const entradaTSI   = carta.entrada            ?? 0;
  const taxaTransf   = carta.taxa_transferencia ?? 0;
  const comissao     = credito * 0.05;
  const entrada      = entradaTSI + comissao;       // entrada exibida já inclui comissão
  const fundoComum   = credito - entradaTSI;        // fundo comum usa entrada TSI pura
  const saldoDevedor = (carta.valor_parcela  ?? 0) * (carta.prazo         ?? 0)
                     + (carta.parcela_diluida ?? 0) * (carta.prazo_diluido ?? 0);
  const periods      = buildTimeline(cartaSegs(carta));

  return (
    <>
      <div className="sim-overlay" onClick={onClose} aria-hidden="true" />

      <div className="sim-modal" role="dialog" aria-modal="true" aria-label="Simulação de Venda">
        <div className="sim-header">
          <div>
            <p className="sim-header-eyebrow">Simulação de Venda</p>
            <h2 className="sim-header-title">Cota {carta.referencia}</h2>
          </div>
          <button className="sim-close" onClick={onClose} aria-label="Fechar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="sim-body">

          <section className="sim-section">
            <div className="sim-grid-2">
              <div className="sim-field">
                <span className="sim-field-label">Crédito</span>
                <span className="sim-field-value sim-value--hero">{fmt(credito)}</span>
              </div>
              <div className="sim-field">
                <span className="sim-field-label">Entrada</span>
                <span className="sim-field-value sim-value--hero">{fmt(entrada)}</span>
              </div>
            </div>
          </section>

          {periods.length > 0 && (
            <>
              <div className="sim-divider" />
              <section className="sim-section">
                <h3 className="sim-section-title">Parcelamento</h3>
                <div className="sim-parcel-section">
                  {periods.map(p => (
                    <div key={p.from} className="sim-parcel-row">
                      <span className="sim-parcel-range">{p.from} à {p.to}</span>
                      <span className="sim-parcel-val">{fmt(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          <div className="sim-divider" />

          <section className="sim-section">
            <div className="sim-grid-2">
              <div className="sim-field">
                <span className="sim-field-label">Transferência</span>
                <span className="sim-field-value">{fmt(taxaTransf)}</span>
              </div>
              <div className="sim-field">
                <span className="sim-field-label">Saldo devedor</span>
                <span className="sim-field-value">{fmt(saldoDevedor)}</span>
              </div>
              <div className="sim-field">
                <span className="sim-field-label">Fundo comum</span>
                <span className="sim-field-value">{fmt(fundoComum)}</span>
              </div>
            </div>
          </section>

        </div>
      </div>
    </>
  );
}
