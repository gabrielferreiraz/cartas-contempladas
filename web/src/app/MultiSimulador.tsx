'use client';

import { useEffect } from 'react';
import type { Carta } from './CartasClient';
import { SimPrintLayout } from './SimPrintLayout';

interface Props {
  cartas: Carta[];
  categoria: 'imovel' | 'automovel';
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
  const segs: Seg[] = [];
  if (carta.prazo && carta.valor_parcela) {
    segs.push({ startMonth: 1, endMonth: carta.prazo, monthly: carta.valor_parcela });
  }
  if (carta.prazo && carta.prazo_diluido && carta.parcela_diluida) {
    segs.push({
      startMonth: carta.prazo + 1,
      endMonth:   carta.prazo + carta.prazo_diluido,
      monthly:    carta.parcela_diluida,
    });
  }
  return segs;
}

export function MultiSimulador({ cartas, categoria, onClose }: Props) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const totalCredito    = cartas.reduce((s, c) => s + (c.credito_atualizado ?? 0), 0);
  const totalEntradaTSI = cartas.reduce((s, c) => s + (c.entrada            ?? 0), 0);
  const totalTransf     = cartas.reduce((s, c) => s + (c.taxa_transferencia ?? 0), 0);
  const totalComissao   = totalCredito * 0.05;
  const totalEntrada    = totalEntradaTSI + totalComissao;
  const saldoDevedor    = cartas.reduce((s, c) =>
    s + (c.valor_parcela   ?? 0) * (c.prazo         ?? 0)
      + (c.parcela_diluida ?? 0) * (c.prazo_diluido ?? 0), 0);
  const periods         = buildTimeline(cartas.flatMap(cartaSegs));

  return (
    <>
      <div className="sim-overlay" onClick={onClose} aria-hidden="true" />

      <div className="sim-modal" role="dialog" aria-modal="true" aria-label="Simulação Multi-Cota">
        <div className="sim-header">
          <div>
            <p className="sim-header-eyebrow">Simulação Multi-Cota</p>
            <h2 className="sim-header-title">
              {cartas.length} cotas · {fmt(totalCredito)}
            </h2>
          </div>
          <div className="sim-header-actions">
            <button className="sim-pdf-btn" onClick={() => window.print()} aria-label="Gerar PDF">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
              </svg>
              Gerar PDF
            </button>
            <button className="sim-close" onClick={onClose} aria-label="Fechar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="sim-body">

          <section className="sim-section">
            <div className="sim-grid-2">
              <div className="sim-field">
                <span className="sim-field-label">Crédito total</span>
                <span className="sim-field-value sim-value--hero">{fmt(totalCredito)}</span>
              </div>
              <div className="sim-field">
                <span className="sim-field-label">Entrada total</span>
                <span className="sim-field-value sim-value--hero">{fmt(totalEntrada)}</span>
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
                <span className="sim-field-value sim-value--emphasis">{fmt(totalTransf)}</span>
              </div>
              <div className="sim-field">
                <span className="sim-field-label">Saldo devedor</span>
                <span className="sim-field-value sim-value--emphasis">{fmt(saldoDevedor)}</span>
              </div>
            </div>
          </section>

          <div className="sim-divider" />

          <section className="sim-section">
            <h3 className="sim-section-title">Cotas selecionadas</h3>
            <div className="sim-cotas-list">
              {cartas.map(c => (
                <div key={c.referencia} className="sim-cota-item">
                  <span className="ref-badge">{c.referencia}</span>
                  <span className="sim-cota-parcela">{fmt(c.valor_parcela)}/mês</span>
                  <span className="sim-cota-credito">{fmt(c.credito_atualizado)}</span>
                </div>
              ))}
            </div>
          </section>

        </div>

        <SimPrintLayout
          titulo={`Simulação Multi-Cota — ${cartas.length} cotas`}
          categoria={categoria}
          credito={totalCredito}
          creditoLabel="Crédito total"
          entrada={totalEntrada}
          entradaLabel="Entrada total"
          transferencia={totalTransf}
          saldoDevedor={saldoDevedor}
          periods={periods}
          cotas={cartas.map(c => ({ referencia: c.referencia, prazo: c.prazo, credito: c.credito_atualizado, valor_parcela: c.valor_parcela }))}
        />
      </div>
    </>
  );
}
