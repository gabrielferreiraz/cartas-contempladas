'use client';

import { useEffect, useRef, useState } from 'react';
import type { Carta } from './CartasClient';
import { formatBRL } from './formatBRL';

interface Props {
  carta: Carta;
  onClose: () => void;
}

function fmt(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '—';
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtData(d: string | null): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function SimuladorVenda({ carta, onClose }: Props) {
  const [valorStr, setValorStr] = useState('');
  const [pctStr,   setPctStr]   = useState('');
  const inputValorRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    inputValorRef.current?.focus();
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const entradaTSI       = carta.entrada           ?? 0;
  const credito          = carta.credito_atualizado ?? 0;
  const taxaTransf       = carta.taxa_transferencia ?? 0;
  const parcelaSemSeguro = carta.valor_parcela      ?? 0;

  // Sync: editar valor → recalcula % (armazena apenas dígitos)
  function onValorChange(rawInput: string) {
    const digits = rawInput.replace(/\D/g, '');
    setValorStr(digits);
    const v = parseInt(digits, 10);
    if (!isNaN(v) && credito > 0) {
      const pct = ((v - entradaTSI) / credito) * 100;
      setPctStr(pct >= 0 ? round2(pct).toString() : '');
    } else {
      setPctStr('');
    }
  }

  // Sync: editar % → recalcula valor (arredonda para inteiro)
  function onPctChange(raw: string) {
    setPctStr(raw);
    const p = parseFloat(raw);
    if (!isNaN(p) && p >= 0 && credito > 0) {
      const v = Math.round(entradaTSI + (p / 100) * credito);
      setValorStr(v.toString());
    } else {
      setValorStr('');
    }
  }

  const valorNum    = valorStr !== '' ? parseFloat(valorStr) : null;
  const valorValido = valorNum !== null && !isNaN(valorNum) && valorNum >= entradaTSI;
  const temEntrada  = valorStr !== '' || pctStr !== '';

  // Cálculos derivados
  const comissao        = valorValido && valorNum !== null ? valorNum - entradaTSI : null;
  const pctSobreCredito = comissao !== null && credito > 0 ? (comissao / credito) * 100 : null;
  const sinal           = entradaTSI * 0.30;
  const saldoRestante   = valorNum !== null ? valorNum - sinal : null;
  const seguroMensal    = credito * 0.0004;
  const parcelaTotal    = parcelaSemSeguro + seguroMensal;
  // Total que o cliente desembolsa antes das parcelas mensais (negociação + taxa na transferência)
  const totalAteTransf  = valorNum !== null ? valorNum + taxaTransf : null;

  const inputError = temEntrada && valorNum !== null && !valorValido;

  return (
    <>
      <div className="sim-overlay" onClick={onClose} aria-hidden="true" />

      <div className="sim-modal" role="dialog" aria-modal="true" aria-label="Simulação de Venda">

        {/* ── Header ── */}
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

        {/* ── Body ── */}
        <div className="sim-body">

          {/* Dados da cota */}
          <section className="sim-section">
            <h3 className="sim-section-title">Dados da Cota</h3>
            <div className="sim-grid-2">
              <div className="sim-field">
                <span className="sim-field-label">Crédito</span>
                <span className="sim-field-value sim-value--hero">{fmt(carta.credito_atualizado)}</span>
              </div>
              <div className="sim-field">
                <span className="sim-field-label">Entrada TSI</span>
                <span className="sim-field-value sim-value--hero">{fmt(carta.entrada)}</span>
              </div>
              <div className="sim-field">
                <span className="sim-field-label">Parcela (sem seguro)</span>
                <span className="sim-field-value">{fmt(carta.valor_parcela)}</span>
              </div>
              <div className="sim-field">
                <span className="sim-field-label">Taxa de Transferência</span>
                <span className="sim-field-value">{fmt(carta.taxa_transferencia)}</span>
              </div>
              <div className="sim-field">
                <span className="sim-field-label">Prazo</span>
                <span className="sim-field-value">{carta.prazo ? `${carta.prazo} meses` : '—'}</span>
              </div>
              <div className="sim-field">
                <span className="sim-field-label">Vencimento</span>
                <span className="sim-field-value">{fmtData(carta.vencimento)}</span>
              </div>
              {carta.prazo_diluido && (
                <div className="sim-field">
                  <span className="sim-field-label">Prazo Diluído</span>
                  <span className="sim-field-value">{carta.prazo_diluido} meses</span>
                </div>
              )}
              {carta.parcela_diluida && (
                <div className="sim-field">
                  <span className="sim-field-label">Parcela Diluída</span>
                  <span className="sim-field-value">{fmt(carta.parcela_diluida)}</span>
                </div>
              )}
            </div>
          </section>

          <div className="sim-divider" />

          {/* Negociação — dois campos linkados */}
          <section className="sim-section">
            <h3 className="sim-section-title">Negociação</h3>

            <div className="sim-negocia-grid">
              {/* Campo valor */}
              <div className="sim-input-group">
                <label className="sim-input-label" htmlFor="sim-valor">
                  Valor cobrado do cliente
                </label>
                <div className={`sim-input-wrap${inputError ? ' error' : ''}`}>
                  <span className="sim-input-prefix">R$</span>
                  <input
                    id="sim-valor"
                    ref={inputValorRef}
                    className="sim-input"
                    type="text"
                    inputMode="numeric"
                    placeholder={entradaTSI.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                    value={formatBRL(valorStr)}
                    onChange={e => onValorChange(e.target.value)}
                  />
                </div>
              </div>

              {/* Campo % */}
              <div className="sim-input-group">
                <label className="sim-input-label" htmlFor="sim-pct">
                  % s/ crédito
                </label>
                <div className={`sim-input-wrap${inputError ? ' error' : ''}`}>
                  <input
                    id="sim-pct"
                    className="sim-input sim-input--pct"
                    type="number"
                    min={0}
                    step={0.1}
                    placeholder="0,00"
                    value={pctStr}
                    onChange={e => onPctChange(e.target.value)}
                  />
                  <span className="sim-input-suffix">%</span>
                </div>
              </div>
            </div>

            {/* Legenda dos campos */}
            <p className="sim-negocia-hint">
              Comissão = % × crédito ({fmt(credito)}) adicionada sobre a entrada TSI.
              Edite qualquer campo — o outro atualiza automaticamente.
            </p>

            {inputError && (
              <p className="sim-input-error">
                Valor abaixo da entrada mínima TSI ({fmt(entradaTSI)})
              </p>
            )}
          </section>

          {/* Resultado */}
          {valorValido && comissao !== null && valorNum !== null && (
            <>
              <div className="sim-divider" />

              <section className="sim-section">
                <h3 className="sim-section-title">Resultado da Negociação</h3>
                <div className="sim-result-cards">
                  <div className="sim-result-card sim-result-card--highlight">
                    <span className="sim-result-label">Sua Comissão</span>
                    <span className="sim-result-value sim-result-value--emerald">{fmt(comissao)}</span>
                    {pctSobreCredito !== null && (
                      <span className="sim-result-sub">
                        {pctSobreCredito.toFixed(2)}% s/ crédito
                      </span>
                    )}
                  </div>
                  <div className="sim-result-card">
                    <span className="sim-result-label">Valor Negociado</span>
                    <span className="sim-result-value">{fmt(valorNum)}</span>
                    <span className="sim-result-sub">
                      entrada TSI + comissão
                    </span>
                  </div>
                </div>
              </section>

              <div className="sim-divider" />

              {/* Cronograma */}
              <section className="sim-section">
                <h3 className="sim-section-title">Cronograma do Cliente</h3>

                <div className="sim-timeline">
                  <div className="sim-step">
                    <div className="sim-step-badge">1</div>
                    <div className="sim-step-body">
                      <div className="sim-step-row">
                        <span className="sim-step-title">Sinal</span>
                        <span className="sim-step-value">{fmt(sinal)}</span>
                      </div>
                      <p className="sim-step-desc">
                        30% da entrada TSI — pago agora para iniciar o cadastro na administradora
                      </p>
                    </div>
                  </div>

                  <div className="sim-step">
                    <div className="sim-step-badge">2</div>
                    <div className="sim-step-body">
                      <div className="sim-step-row">
                        <span className="sim-step-title">Saldo restante</span>
                        <span className="sim-step-value">{fmt(saldoRestante)}</span>
                      </div>
                      <p className="sim-step-desc">
                        Após assinatura do contrato — prazo de 24h para liquidação
                      </p>
                    </div>
                  </div>

                  <div className="sim-step">
                    <div className="sim-step-badge">3</div>
                    <div className="sim-step-body">
                      <div className="sim-step-row">
                        <span className="sim-step-title">Taxa de transferência</span>
                        <span className="sim-step-value">{fmt(taxaTransf)}</span>
                      </div>
                      <p className="sim-step-desc">
                        1% sobre o valor original da carta — pago na transferência da cota
                      </p>
                    </div>
                  </div>

                  <div className="sim-step">
                    <div className="sim-step-badge sim-step-badge--muted">∞</div>
                    <div className="sim-step-body">
                      <div className="sim-step-row">
                        <span className="sim-step-title">Parcelas mensais</span>
                        <span className="sim-step-value">
                          {fmt(parcelaTotal)}<span className="sim-step-unit">/mês</span>
                        </span>
                      </div>
                      <p className="sim-step-desc">
                        Parcela {fmt(parcelaSemSeguro)} + seguro estimado {fmt(seguroMensal)} (0,04% s/ saldo devedor)
                      </p>
                    </div>
                  </div>
                </div>

                <div className="sim-summary">
                  <div className="sim-summary-row">
                    <span>Sinal para início do cadastro</span>
                    <span>{fmt(sinal)}</span>
                  </div>
                  <div className="sim-summary-row sim-summary-row--total">
                    <span>Total até a transferência (negociação + taxa)</span>
                    <span>{fmt(totalAteTransf)}</span>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* Estado vazio */}
          {!temEntrada && (
            <div className="sim-empty-hint">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{color:'var(--slate-300)', marginBottom:'0.5rem'}}>
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4l3 3"/>
              </svg>
              <p>Informe o valor ou a porcentagem desejada para ver a simulação completa.</p>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
