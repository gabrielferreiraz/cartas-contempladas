'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { IconSearch, IconSliders, IconSortNeutral, IconSortUp, IconSortDown, IconX, IconCalculator } from './Icons';
import { SimuladorVenda } from './SimuladorVenda';
import { MultiSimulador } from './MultiSimulador';
import { formatBRL } from './formatBRL';

export type Carta = {
  referencia: string;
  credito_atualizado: number | null;
  entrada: number | null;
  prazo: number | null;
  valor_parcela: number | null;
  prazo_diluido: number | null;
  parcela_diluida: number | null;
  vencimento: string | null;
  taxa_transferencia: number | null;
};

type SortCol =
  | 'credito_atualizado'
  | 'entrada'
  | 'pct_entrada'
  | 'prazo'
  | 'valor_parcela'
  | 'parcela_diluida'
  | 'vencimento'
  | 'taxa_transferencia';

interface Filtros {
  busca: string;
  creditoMin: string;
  creditoMax: string;
  entradaMax: string;
  parcelaMax: string;
  prazoMax: string;
}

const VAZIO: Filtros = { busca: '', creditoMin: '', creditoMax: '', entradaMax: '', parcelaMax: '', prazoMax: '' };

function fmt(v: number | null): string {
  if (v === null) return '—';
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}
function fmtCompacto(v: number): string {
  return 'R$ ' + v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}
function fmtData(d: string | null): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}
function entradaCalc(c: Carta): number | null {
  if (c.credito_atualizado === null && c.entrada === null) return null;
  return (c.entrada ?? 0) + (c.credito_atualizado ?? 0) * 0.05;
}

function pctEntrada(c: Carta): number | null {
  if (!c.credito_atualizado || !c.entrada) return null;
  const calc = entradaCalc(c);
  if (calc === null) return null;
  return (calc / c.credito_atualizado) * 100;
}

function SortIcon({ col, sortCol, sortDir }: { col: SortCol; sortCol: SortCol; sortDir: 'asc' | 'desc' }) {
  if (sortCol !== col) return <span className="sort-icon"><IconSortNeutral /></span>;
  return <span className="sort-icon active">{sortDir === 'asc' ? <IconSortUp /> : <IconSortDown />}</span>;
}

export function CartasClient({ cartas }: { cartas: Carta[] }) {
  const [filtros, setFiltros] = useState<Filtros>(VAZIO);
  const [sortCol, setSortCol] = useState<SortCol>('credito_atualizado');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cartaSelecionada, setCartaSelecionada] = useState<Carta | null>(null);
  const [cartasSelecionadas, setCartasSelecionadas] = useState<Carta[]>([]);
  const [mostrarMulti, setMostrarMulti] = useState(false);

  const selecionadasRefs = useMemo(
    () => new Set(cartasSelecionadas.map(c => c.referencia)),
    [cartasSelecionadas],
  );

  function toggleSelecao(carta: Carta) {
    setCartasSelecionadas(prev => {
      const prevRefs = new Set(prev.map(c => c.referencia));
      return prevRefs.has(carta.referencia)
        ? prev.filter(c => c.referencia !== carta.referencia)
        : [...prev, carta];
    });
  }

  function abrirSimulacao() {
    if (cartasSelecionadas.length === 1) {
      setCartaSelecionada(cartasSelecionadas[0]);
      setCartasSelecionadas([]);
    } else {
      setMostrarMulti(true);
    }
  }

  const totalSelecionado = cartasSelecionadas.reduce(
    (s, c) => s + (c.credito_atualizado ?? 0), 0,
  );
  const totalParcela = cartasSelecionadas.reduce(
    (s, c) => s + (c.valor_parcela ?? 0), 0,
  );

  const masterRef      = useRef<HTMLInputElement>(null);
  const lastAnchorRef  = useRef<number | null>(null);

  function setF(key: keyof Filtros, value: string) {
    setFiltros(f => ({ ...f, [key]: value }));
  }
  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  }

  const activeAdvancedCount = [
    filtros.creditoMin, filtros.creditoMax, filtros.entradaMax, filtros.parcelaMax, filtros.prazoMax,
  ].filter(Boolean).length;

  const temFiltro = Object.values(filtros).some(v => v !== '');

  const filtradas = useMemo(() => {
    const creditoMin = filtros.creditoMin ? +filtros.creditoMin : null;
    const creditoMax = filtros.creditoMax ? +filtros.creditoMax : null;
    const entradaMax = filtros.entradaMax ? +filtros.entradaMax : null;
    const parcelaMax = filtros.parcelaMax ? +filtros.parcelaMax : null;
    const prazoMax   = filtros.prazoMax   ? +filtros.prazoMax   : null;
    const buscaValor = filtros.busca.length >= 3 ? Number(filtros.busca) : null;

    return cartas
      .filter(c => {
        if (buscaValor !== null) {
          if (c.credito_atualizado === null) return false;
          if (c.credito_atualizado < buscaValor * 0.85) return false;
          if (c.credito_atualizado > buscaValor * 1.15) return false;
        }
        if (creditoMin !== null && (c.credito_atualizado ?? 0) < creditoMin) return false;
        if (creditoMax !== null && (c.credito_atualizado ?? 0) > creditoMax) return false;
        if (entradaMax !== null && (entradaCalc(c) ?? Infinity) > entradaMax) return false;
        if (parcelaMax !== null && (c.valor_parcela ?? Infinity) > parcelaMax) return false;
        if (prazoMax   !== null && (c.prazo ?? Infinity) > prazoMax) return false;
        return true;
      })
      .sort((a, b) => {
        let av: string | number | null;
        let bv: string | number | null;
        if (sortCol === 'pct_entrada') {
          av = pctEntrada(a) ?? -1;
          bv = pctEntrada(b) ?? -1;
        } else if (sortCol === 'entrada') {
          av = entradaCalc(a) ?? (sortDir === 'asc' ? Infinity : -Infinity);
          bv = entradaCalc(b) ?? (sortDir === 'asc' ? Infinity : -Infinity);
        } else {
          av = a[sortCol] ?? (sortDir === 'asc' ? Infinity : -Infinity);
          bv = b[sortCol] ?? (sortDir === 'asc' ? Infinity : -Infinity);
        }
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [cartas, filtros, sortCol, sortDir]);

  // Reset âncora quando filtros/sort mudam (índices mudam)
  useEffect(() => {
    lastAnchorRef.current = null;
  }, [filtradas]);

  function handleSel(carta: Carta, idx: number, e: React.MouseEvent) {
    if (e.shiftKey && lastAnchorRef.current !== null) {
      const from  = Math.min(lastAnchorRef.current, idx);
      const to    = Math.max(lastAnchorRef.current, idx);
      const range = filtradas.slice(from, to + 1);
      setCartasSelecionadas(prev => {
        const prevRefs = new Set(prev.map(c => c.referencia));
        return [...prev, ...range.filter(c => !prevRefs.has(c.referencia))];
      });
    } else {
      toggleSelecao(carta);
      lastAnchorRef.current = idx;
    }
  }

  // Lógica do checkbox mestre — depende de filtradas, deve ficar após o useMemo
  const filtradosRefs = useMemo(() => new Set(filtradas.map(c => c.referencia)), [filtradas]);
  const selecionadasVisiveis = cartasSelecionadas.filter(c => filtradosRefs.has(c.referencia));
  const todasVisivelSelec = filtradas.length > 0 && selecionadasVisiveis.length === filtradas.length;
  const algumaVisivelSelec = selecionadasVisiveis.length > 0 && !todasVisivelSelec;

  useEffect(() => {
    if (masterRef.current) masterRef.current.indeterminate = algumaVisivelSelec;
  }, [algumaVisivelSelec]);

  function toggleMaster() {
    if (todasVisivelSelec) {
      setCartasSelecionadas(prev => prev.filter(c => !filtradosRefs.has(c.referencia)));
    } else {
      const novas = filtradas.filter(c => !selecionadasRefs.has(c.referencia));
      setCartasSelecionadas(prev => [...prev, ...novas]);
    }
  }

  const chips: { label: string; key: keyof Filtros }[] = [];
  if (filtros.busca) chips.push({
    label: `Créd. ~R$ ${Number(filtros.busca).toLocaleString('pt-BR')}`,
    key: 'busca',
  });
  if (filtros.creditoMin) chips.push({ label: `Créd. ≥ ${fmtCompacto(+filtros.creditoMin)}`,   key: 'creditoMin' });
  if (filtros.creditoMax) chips.push({ label: `Créd. ≤ ${fmtCompacto(+filtros.creditoMax)}`,   key: 'creditoMax' });
  if (filtros.entradaMax) chips.push({ label: `Entrada ≤ ${fmtCompacto(+filtros.entradaMax)}`, key: 'entradaMax' });
  if (filtros.parcelaMax) chips.push({ label: `Parcela ≤ ${fmtCompacto(+filtros.parcelaMax)}`, key: 'parcelaMax' });
  if (filtros.prazoMax)   chips.push({ label: `Prazo ≤ ${filtros.prazoMax}m`,                  key: 'prazoMax' });

  function th(col: SortCol, label: string, className = 'right sortable') {
    return (
      <th className={className} onClick={() => toggleSort(col)}>
        {label} <SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
      </th>
    );
  }

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
            <label>Entrada máx.</label>
            <div className="filter-input-wrap">
              <span className="prefix">R$</span>
              <input type="text" inputMode="numeric" placeholder="∞"
                value={formatBRL(filtros.entradaMax)}
                onChange={e => setF('entradaMax', e.target.value.replace(/\D/g, ''))} />
            </div>
          </div>

          <div className="filter-group">
            <label>Parcela máx.</label>
            <div className="filter-input-wrap">
              <span className="prefix">R$</span>
              <input type="text" inputMode="numeric" placeholder="∞"
                value={formatBRL(filtros.parcelaMax)}
                onChange={e => setF('parcelaMax', e.target.value.replace(/\D/g, ''))} />
            </div>
          </div>

          <div className="filter-group">
            <label>Prazo máx.</label>
            <div className="filter-input-wrap">
              <input type="number" min={0} step={1} placeholder="∞"
                value={filtros.prazoMax} onChange={e => setF('prazoMax', e.target.value)} />
              <span className="suffix">meses</span>
            </div>
          </div>
        </div>

        <div className="drawer-footer">
          {activeAdvancedCount > 0 && (
            <button className="btn-limpar" onClick={() =>
              setFiltros(f => ({ ...f, creditoMin: '', creditoMax: '', entradaMax: '', parcelaMax: '', prazoMax: '' }))
            }>
              Limpar filtros
            </button>
          )}
          <button className="btn-close-drawer" onClick={() => setShowAdvanced(false)}>Fechar</button>
        </div>
      </div>

      {/* ── Chips de filtros ativos ── */}
      {(chips.length > 0 || filtradas.length !== cartas.length) && (
        <div className="filter-meta">
          <span className="result-count">
            {filtradas.length === cartas.length
              ? `${cartas.length} cartas disponíveis`
              : `${filtradas.length} de ${cartas.length} cartas`}
          </span>
          {chips.length > 0 && (
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
          )}
        </div>
      )}

      {cartaSelecionada && (
        <SimuladorVenda carta={cartaSelecionada} onClose={() => setCartaSelecionada(null)} />
      )}

      {mostrarMulti && cartasSelecionadas.length > 0 && (
        <MultiSimulador
          cartas={cartasSelecionadas}
          onClose={() => setMostrarMulti(false)}
        />
      )}

      {/* ── Barra de seleção flutuante ── */}
      {cartasSelecionadas.length > 0 && !mostrarMulti && (
        <div className="selection-bar">
          <div className="selection-bar-info">
            <span className="selection-bar-count">
              {cartasSelecionadas.length} {cartasSelecionadas.length === 1 ? 'cota selecionada' : 'cotas selecionadas'}
              {filtradas.length < cartas.length && (
                <span className="selection-bar-filtro"> · filtro ativo ({filtradas.length} visíveis)</span>
              )}
            </span>
            <span className="selection-bar-total">
              Crédito: R$ {totalSelecionado.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
              {' · '}
              Parcela: R$ {totalParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="selection-bar-actions">
            <button className="selection-bar-limpar" onClick={() => setCartasSelecionadas([])}>
              Limpar
            </button>
            <button className="selection-bar-simular" onClick={abrirSimulacao}>
              <IconCalculator />
              {cartasSelecionadas.length === 1 ? 'Simular cota' : `Somar ${cartasSelecionadas.length} Cotas`}
            </button>
          </div>
        </div>
      )}

      {/* ── Tabela ── */}
      <div className="table-wrap">
        {filtradas.length === 0 ? (
          <div className="empty">Nenhuma carta encontrada com os filtros aplicados.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th className="sel-col">
                  <input
                    ref={masterRef}
                    type="checkbox"
                    className="row-checkbox"
                    checked={todasVisivelSelec}
                    onChange={toggleMaster}
                    aria-label="Selecionar todas visíveis"
                  />
                </th>
                <th>Ref.</th>
                {th('credito_atualizado', 'Crédito')}
                {th('entrada', 'Entrada')}
                {th('pct_entrada', '% Entrada')}
                {th('prazo', 'Prazo')}
                {th('valor_parcela', 'Parcela')}
                <th className="right">Prazo Diluído</th>
                {th('parcela_diluida', 'Parcela Diluída')}
                {th('vencimento', 'Vencimento', 'sortable')}
                {th('taxa_transferencia', 'Taxa Transf.')}
                <th className="sim-col"></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((c, idx) => {
                const pct = pctEntrada(c);
                return (
                  <tr
                    key={c.referencia}
                    className={selecionadasRefs.has(c.referencia) ? 'row-selected' : ''}
                    onMouseDown={(e) => { if (e.shiftKey) e.preventDefault(); }}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.closest('.btn-simular') || target.closest('.sel-col')) return;
                      handleSel(c, idx, e);
                    }}
                  >
                    <td className="sel-col">
                      <input
                        type="checkbox"
                        className="row-checkbox"
                        checked={selecionadasRefs.has(c.referencia)}
                        onChange={() => {}}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSel(c, idx, e);
                        }}
                        aria-label={`Selecionar cota ${c.referencia}`}
                      />
                    </td>
                    <td><span className="ref-badge">{c.referencia}</span></td>
                    <td className="right">{fmt(c.credito_atualizado)}</td>
                    <td className="right">{fmt(entradaCalc(c))}</td>
                    <td className="right pct">{pct !== null ? `${pct.toFixed(1)}%` : '—'}</td>
                    <td className="right">{c.prazo ? `${c.prazo}m` : '—'}</td>
                    <td className="right">{fmt(c.valor_parcela)}</td>
                    <td className="right">{c.prazo_diluido ? `${c.prazo_diluido}m` : '—'}</td>
                    <td className="right">{fmt(c.parcela_diluida)}</td>
                    <td>{fmtData(c.vencimento)}</td>
                    <td className="right">{fmt(c.taxa_transferencia)}</td>
                    <td className="sim-col">
                      <button className="btn-simular" onClick={() => setCartaSelecionada(c)}>
                        <IconCalculator />
                        Simular
                      </button>
                    </td>
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
