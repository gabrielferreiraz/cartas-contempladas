'use client';

import { useMemo, useState } from 'react';
import { CartasClient, type Carta } from './CartasClient';
import { IconSearch, IconCalendar, IconSliders, IconSortNeutral, IconSortUp, IconSortDown, IconX } from './Icons';
import { formatBRL } from './formatBRL';

export type CartaVendida = {
  referencia: string;
  credito_atualizado: number | null;
  entrada: number | null;
  prazo: number | null;
  valor_parcela: number | null;
  vencimento: string | null;
  vendido_em: string | null;
  primeira_vez_visto_em: string | null;
};

function fmt(v: number | null) {
  if (v === null) return '—';
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}
function fmtCompacto(v: number) {
  return 'R$ ' + v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}
function fmtData(d: string | null) {
  if (!d) return '—';
  const [y, m, day] = d.split('T')[0].split('-');
  return `${day}/${m}/${y}`;
}
function fmtDataHora(d: string | null) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function pctEntrada(credito: number | null, entrada: number | null): number | null {
  if (!credito || !entrada) return null;
  return (entrada / credito) * 100;
}

type SortCol = 'credito_atualizado' | 'entrada' | 'pct_entrada' | 'prazo' | 'valor_parcela' | 'vencimento' | 'vendido_em' | 'primeira_vez_visto_em';

interface FiltrosVendidas {
  busca: string;
  creditoMin: string;
  creditoMax: string;
  vendidoApos: string;
  vendidoAntes: string;
}

const VAZIO: FiltrosVendidas = { busca: '', creditoMin: '', creditoMax: '', vendidoApos: '', vendidoAntes: '' };

function SortIconV({ col, sortCol, sortDir }: { col: SortCol; sortCol: SortCol; sortDir: 'asc' | 'desc' }) {
  if (sortCol !== col) return <span className="sort-icon"><IconSortNeutral /></span>;
  return <span className="sort-icon active">{sortDir === 'asc' ? <IconSortUp /> : <IconSortDown />}</span>;
}

function VendidasTable({ cartas }: { cartas: CartaVendida[] }) {
  const [filtros, setFiltros] = useState<FiltrosVendidas>(VAZIO);
  const [sortCol, setSortCol] = useState<SortCol>('vendido_em');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showAdvanced, setShowAdvanced] = useState(false);

  function setF(key: keyof FiltrosVendidas, value: string) {
    setFiltros(f => ({ ...f, [key]: value }));
  }
  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  }

  const activeAdvancedCount = [
    filtros.creditoMin, filtros.creditoMax, filtros.vendidoApos, filtros.vendidoAntes,
  ].filter(Boolean).length;

  const temFiltro = Object.values(filtros).some(v => v !== '');

  const filtradas = useMemo(() => {
    const creditoMin   = filtros.creditoMin   ? +filtros.creditoMin   : null;
    const creditoMax   = filtros.creditoMax   ? +filtros.creditoMax   : null;
    const vendidoApos  = filtros.vendidoApos  ? new Date(filtros.vendidoApos).getTime()  : null;
    const vendidoAntes = filtros.vendidoAntes ? new Date(filtros.vendidoAntes).getTime() : null;
    const buscaValor   = filtros.busca.length >= 3 ? Number(filtros.busca) : null;

    return cartas
      .filter(c => {
        if (buscaValor !== null) {
          if (c.credito_atualizado === null) return false;
          if (c.credito_atualizado < buscaValor * 0.85) return false;
          if (c.credito_atualizado > buscaValor * 1.15) return false;
        }
        if (creditoMin !== null && (c.credito_atualizado ?? 0) < creditoMin) return false;
        if (creditoMax !== null && (c.credito_atualizado ?? 0) > creditoMax) return false;
        if (vendidoApos  !== null && new Date(c.vendido_em ?? 0).getTime() < vendidoApos)  return false;
        if (vendidoAntes !== null && new Date(c.vendido_em ?? 0).getTime() > vendidoAntes) return false;
        return true;
      })
      .sort((a, b) => {
        let av: string | number | null;
        let bv: string | number | null;
        if (sortCol === 'pct_entrada') {
          av = pctEntrada(a.credito_atualizado, a.entrada) ?? -1;
          bv = pctEntrada(b.credito_atualizado, b.entrada) ?? -1;
        } else {
          av = a[sortCol] ?? '';
          bv = b[sortCol] ?? '';
        }
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [cartas, filtros, sortCol, sortDir]);

  const chips: { label: string; key: keyof FiltrosVendidas }[] = [];
  if (filtros.busca) chips.push({
    label: `Créd. ~R$ ${Number(filtros.busca).toLocaleString('pt-BR')}`,
    key: 'busca',
  });
  if (filtros.creditoMin)   chips.push({ label: `Créd. ≥ ${fmtCompacto(+filtros.creditoMin)}`, key: 'creditoMin' });
  if (filtros.creditoMax)   chips.push({ label: `Créd. ≤ ${fmtCompacto(+filtros.creditoMax)}`, key: 'creditoMax' });
  if (filtros.vendidoApos)  chips.push({ label: `Após ${fmtData(filtros.vendidoApos)}`,         key: 'vendidoApos' });
  if (filtros.vendidoAntes) chips.push({ label: `Antes ${fmtData(filtros.vendidoAntes)}`,       key: 'vendidoAntes' });

  return (
    <div>
      {/* ── Barra unificada de busca ── */}
      <div className="search-filter-bar">
        <div className="search-input-area credit-mode">
          <span className="bar-search-icon"><IconSearch /></span>
          <span className="bar-live-prefix">R$</span>
          <input
            className="bar-search-input"
            type="text"
            inputMode="numeric"
            placeholder="Buscar por crédito (±15%)..."
            value={formatBRL(filtros.busca)}
            onChange={e => setF('busca', e.target.value.replace(/\D/g, ''))}
          />
        </div>
        <div className="bar-divider" />
        <button
          className={`btn-advanced-filters ${showAdvanced ? 'open' : ''} ${activeAdvancedCount > 0 ? 'has-active' : ''}`}
          onClick={() => setShowAdvanced(v => !v)}
        >
          <IconSliders />
          Filtros
          {activeAdvancedCount > 0 && (
            <span className="filter-active-badge">{activeAdvancedCount}</span>
          )}
        </button>
      </div>

      {/* ── Gaveta de filtros avançados ── */}
      <div className={`advanced-filters-drawer ${showAdvanced ? 'open' : ''}`}>
        <div className="drawer-grid">
          <div className="filter-range-group">
            <label>Faixa de Crédito</label>
            <div className="filter-range-row">
              <div className="filter-input-wrap">
                <span className="prefix">R$</span>
                <input type="text" inputMode="numeric" placeholder="Mín"
                  value={formatBRL(filtros.creditoMin)}
                  onChange={e => setF('creditoMin', e.target.value.replace(/\D/g, ''))} />
              </div>
              <span className="range-sep">—</span>
              <div className="filter-input-wrap">
                <span className="prefix">R$</span>
                <input type="text" inputMode="numeric" placeholder="Máx"
                  value={formatBRL(filtros.creditoMax)}
                  onChange={e => setF('creditoMax', e.target.value.replace(/\D/g, ''))} />
              </div>
            </div>
          </div>

          <div className="filter-group">
            <label>Vendido após</label>
            <div className="filter-input-wrap">
              <span className="input-icon"><IconCalendar /></span>
              <input type="date" value={filtros.vendidoApos}
                onChange={e => setF('vendidoApos', e.target.value)} />
            </div>
          </div>

          <div className="filter-group">
            <label>Vendido antes</label>
            <div className="filter-input-wrap">
              <span className="input-icon"><IconCalendar /></span>
              <input type="date" value={filtros.vendidoAntes}
                onChange={e => setF('vendidoAntes', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="drawer-footer">
          {activeAdvancedCount > 0 && (
            <button className="btn-limpar" onClick={() =>
              setFiltros(f => ({ ...f, creditoMin: '', creditoMax: '', vendidoApos: '', vendidoAntes: '' }))
            }>
              Limpar filtros
            </button>
          )}
          <button className="btn-close-drawer" onClick={() => setShowAdvanced(false)}>Fechar</button>
        </div>
      </div>

      {/* ── Chips de filtros ativos ── */}
      {chips.length > 0 && (
        <div className="filter-meta">
          <span className="result-count">
            {filtradas.length === cartas.length
              ? `${cartas.length} cartas vendidas`
              : `${filtradas.length} de ${cartas.length} cartas`}
          </span>
          <div className="chips">
            {chips.map(c => (
              <button key={c.key} className="chip" onClick={() => setF(c.key, '')}>
                {c.label} <span className="chip-x"><IconX /></span>
              </button>
            ))}
            {temFiltro && chips.length > 1 && (
              <button className="chip chip-clear-all" onClick={() => setFiltros(VAZIO)}>
                Limpar tudo <span className="chip-x"><IconX /></span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Tabela ── */}
      <div className="table-wrap">
        {filtradas.length === 0 ? (
          <div className="empty">Nenhuma carta vendida encontrada.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Ref.</th>
                <th className="right sortable" onClick={() => toggleSort('credito_atualizado')}>Crédito <SortIconV col="credito_atualizado" sortCol={sortCol} sortDir={sortDir} /></th>
                <th className="right sortable" onClick={() => toggleSort('entrada')}>Entrada <SortIconV col="entrada" sortCol={sortCol} sortDir={sortDir} /></th>
                <th className="right sortable" onClick={() => toggleSort('pct_entrada')}>% Entrada <SortIconV col="pct_entrada" sortCol={sortCol} sortDir={sortDir} /></th>
                <th className="right sortable" onClick={() => toggleSort('prazo')}>Prazo <SortIconV col="prazo" sortCol={sortCol} sortDir={sortDir} /></th>
                <th className="right sortable" onClick={() => toggleSort('valor_parcela')}>Parcela <SortIconV col="valor_parcela" sortCol={sortCol} sortDir={sortDir} /></th>
                <th className="sortable"       onClick={() => toggleSort('vencimento')}>Vencimento <SortIconV col="vencimento" sortCol={sortCol} sortDir={sortDir} /></th>
                <th className="sortable"       onClick={() => toggleSort('primeira_vez_visto_em')}>1ª vez visto <SortIconV col="primeira_vez_visto_em" sortCol={sortCol} sortDir={sortDir} /></th>
                <th className="sortable"       onClick={() => toggleSort('vendido_em')}>Vendido em <SortIconV col="vendido_em" sortCol={sortCol} sortDir={sortDir} /></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(c => {
                const pct = pctEntrada(c.credito_atualizado, c.entrada);
                return (
                  <tr key={c.referencia}>
                    <td><span className="ref-badge">{c.referencia}</span></td>
                    <td className="right">{fmt(c.credito_atualizado)}</td>
                    <td className="right">{fmt(c.entrada)}</td>
                    <td className="pct">{pct !== null ? `${pct.toFixed(1)}%` : '—'}</td>
                    <td className="right">{c.prazo ? `${c.prazo}m` : '—'}</td>
                    <td className="right">{fmt(c.valor_parcela)}</td>
                    <td>{fmtData(c.vencimento)}</td>
                    <td className="muted">{fmtDataHora(c.primeira_vez_visto_em)}</td>
                    <td className="vendido-em">{fmtDataHora(c.vendido_em)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function TabView({ disponiveis, vendidas }: { disponiveis: Carta[]; vendidas: CartaVendida[] }) {
  const [tab, setTab] = useState<'disponiveis' | 'vendidas'>('disponiveis');

  return (
    <div>
      <div className="segmented">
        <button className={`seg-btn ${tab === 'disponiveis' ? 'active' : ''}`} onClick={() => setTab('disponiveis')}>
          Disponíveis
          <span className="seg-badge">{disponiveis.length}</span>
        </button>
        <button className={`seg-btn ${tab === 'vendidas' ? 'active' : ''}`} onClick={() => setTab('vendidas')}>
          Vendidas
          <span className="seg-badge sold">{vendidas.length}</span>
        </button>
      </div>

      <div>
        {tab === 'disponiveis'
          ? <CartasClient cartas={disponiveis} />
          : <VendidasTable cartas={vendidas} />}
      </div>
    </div>
  );
}
