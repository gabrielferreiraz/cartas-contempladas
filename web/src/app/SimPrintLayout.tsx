'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface PrintPeriod { from: number; to: number; amount: number }
export interface PrintCota { referencia: string; prazo: number | null; credito: number | null; valor_parcela: number | null }

interface Props {
  titulo: string;
  categoria: 'imovel' | 'automovel';
  credito: number;
  creditoLabel?: string;
  entrada: number;
  entradaLabel?: string;
  transferencia: number;
  saldoDevedor: number;
  periods: PrintPeriod[];
  cotas?: PrintCota[];
}

function fmt(v: number | null | undefined): string {
  if (v == null || isNaN(v as number)) return '—';
  return 'R$ ' + (v as number).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(): string {
  return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function SimPrintLayout({
  titulo,
  categoria,
  credito,
  creditoLabel = 'Crédito',
  entrada,
  entradaLabel = 'Entrada',
  transferencia,
  saldoDevedor,
  periods,
  cotas,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  let n = 0;
  const sn = () => ++n;

  return createPortal(
    <div className="print-layout">

      {/* ── Cabeçalho ─────────────────────────────────── */}
      <div className="pl-head">
        <img src="/reobote-1.avif" alt="Reobote Consórcios" className="pl-logo" />
        {/* <div className="pl-rule-thin" /> */}
        <span className="pl-doc-title">Proposta de Carta Contemplada</span>
        <span className="pl-cat-label">
          <img src={categoria === 'imovel' ? '/home-2.svg' : '/car.svg'} alt="" className="pl-cat-icon-inline" aria-hidden="true" />
          {categoria === 'imovel' ? 'Imóvel' : 'Automóvel'}
        </span>
      </div>

      <div className="pl-rule" />

      {titulo && <div className="pl-deal-label">{titulo}</div>}

      {/* ── 1. Detalhamento financeiro ─────────────────── */}
      <h2 className="pl-h2">{sn()}. Detalhamento Financeiro</h2>
      <table className="pl-table">
        <colgroup>
          <col style={{ width: '62%' }} />
          <col style={{ width: '38%' }} />
        </colgroup>
        <thead>
          <tr><th>Descrição</th><th className="pl-r">Valor</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>{creditoLabel}</td>
            <td className="pl-r pl-num">{fmt(credito)}</td>
          </tr>
          <tr className="pl-alt">
            <td>{entradaLabel}</td>
            <td className="pl-r pl-num">{fmt(entrada)}</td>
          </tr>
          <tr>
            <td>Taxa de Transferência</td>
            <td className="pl-r pl-num">{fmt(transferencia)}</td>
          </tr>
          <tr className="pl-alt">
            <td>Saldo Devedor</td>
            <td className="pl-r pl-num">{fmt(saldoDevedor)}</td>
          </tr>
        </tbody>
      </table>

      {/* ── 2. Cronograma de parcelas ─────────────────── */}
      {periods.length > 0 && (
        <>
          <h2 className="pl-h2">{sn()}. Cronograma de Parcelas Mensais</h2>
          <table className="pl-table">
            <colgroup>
              <col style={{ width: '55%' }} />
              <col style={{ width: '45%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Período</th>
                <th className="pl-r">Parcela mensal</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p, i) => (
                <tr key={p.from} className={i % 2 === 1 ? 'pl-alt' : ''}>
                  <td>Meses {p.from} a {p.to}</td>
                  <td className="pl-r pl-num">{fmt(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* ── 3. Cotas incluídas (multi) ────────────────── */}
      {cotas && cotas.length > 1 && (
        <>
          <h2 className="pl-h2">{sn()}. Cotas Incluídas ({cotas.length})</h2>
          <table className="pl-table pl-table--sm">
            <colgroup>
              <col style={{ width: '18%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '32%' }} />
              <col style={{ width: '32%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Ref.</th>
                <th className="pl-r">Prazo</th>
                <th className="pl-r">Crédito</th>
                <th className="pl-r">Parcela/mês</th>
              </tr>
            </thead>
            <tbody>
              {cotas.map((c, i) => (
                <tr key={c.referencia} className={i % 2 === 1 ? 'pl-alt' : ''}>
                  <td>{c.referencia}</td>
                  <td className="pl-r">{c.prazo != null ? `${c.prazo} meses` : '—'}</td>
                  <td className="pl-r pl-num">{fmt(c.credito)}</td>
                  <td className="pl-r pl-num">{fmt(c.valor_parcela)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* ── Notas legais ──────────────────────────────── */}
      <div className="pl-footer">
        <p>1. Aprovação sujeita às regras de análise de crédito e comprovação de renda da administradora.</p>
        <p>2. Parcelas e saldo devedor sujeitos a reajustes anuais conforme contrato de adesão original.</p>
        <p>3. Esta proposta não constitui contrato formal de venda. Reobote Consórcios.</p>
        <p className="pl-footer-meta">Emissão: {fmtDate()} · Válida por 48 horas</p>
        <div className="pl-footer-logo-wrap">
          <img src="/reobote-1.avif" alt="" className="pl-footer-logo" />
        </div>
      </div>

    </div>,
    document.body,
  );
}
