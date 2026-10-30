'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

function calcular(iso: string | null): string {
  if (!iso || iso === 'never') return 'nunca sincronizado';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diff < 1) return 'agora mesmo';
  if (diff === 1) return '1 min atrás';
  return `${diff} min atrás`;
}

type Estado = 'idle' | 'sincronizando' | 'atualizando' | 'erro';

interface ResultadoTipo {
  tipo: 'imovel' | 'automovel';
  status: 'sucesso' | 'erro' | 'ignorado';
  novas?: number;
  vendidas?: number;
  total?: number;
  erro?: string;
}

interface Aviso {
  linhas: { tipo: ResultadoTipo['tipo']; ok: boolean; texto: string }[];
  temErro: boolean;
}

const NOME_TIPO = { imovel: 'Imóveis', automovel: 'Automóveis' } as const;

function descrever(r: ResultadoTipo): string {
  if (r.status === 'erro') return `erro — ${r.erro ?? 'falha na sincronização'}`;
  if (r.status === 'ignorado') return 'sem alterações';
  const partes = [`${r.novas ?? 0} nova(s)`];
  if (r.vendidas) partes.push(`${r.vendidas} vendida(s)`);
  return `atualizado (${partes.join(', ')})`;
}

function montarAviso(resultados: Record<string, ResultadoTipo> | null): Aviso | null {
  if (!resultados) return null;
  const linhas = (['imovel', 'automovel'] as const)
    .map((t) => resultados[t])
    .filter(Boolean)
    .map((r) => ({ tipo: r.tipo, ok: r.status !== 'erro', texto: descrever(r) }));
  return { linhas, temErro: linhas.some((l) => !l.ok) };
}

export function RefreshControl({ iso }: { iso: string | null }) {
  const router  = useRouter();
  const isoRef  = useRef(iso);
  const [texto,   setTexto]   = useState(() => calcular(iso));
  const [estado,  setEstado]  = useState<Estado>('idle');
  const [erroMsg, setErroMsg] = useState<string | null>(null);
  const [aviso,   setAviso]   = useState<Aviso | null>(null);

  // Popup de sucesso some sozinho; se houver erro, fica até o usuário fechar.
  useEffect(() => {
    if (!aviso || aviso.temErro) return;
    const id = setTimeout(() => setAviso(null), 5000);
    return () => clearTimeout(id);
  }, [aviso]);

  useEffect(() => {
    isoRef.current = iso;
    setTexto(calcular(iso));
  }, [iso]);

  useEffect(() => {
    const id = setInterval(() => setTexto(calcular(isoRef.current)), 10_000);
    return () => clearInterval(id);
  }, []);

  async function handleClick() {
    if (estado !== 'idle' && estado !== 'erro') return;
    setEstado('sincronizando');
    setErroMsg(null);
    try {
      const res = await fetch('/api/trigger-sync', {
        method: 'POST',
        signal: AbortSignal.timeout(40_000),
      });
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        setAviso(body.ocupado ? null : montarAviso(body.resultados ?? null));
        const agora = new Date().toISOString();
        isoRef.current = agora;
        setTexto('agora mesmo');
        setEstado('atualizando');
        router.refresh();
        setTimeout(() => setEstado('idle'), 1200);
      } else {
        const body = await res.json().catch(() => ({}));
        setErroMsg(body.error ?? `Erro ${res.status}`);
        setEstado('erro');
      }
    } catch (err) {
      setErroMsg((err as Error).message ?? 'Sem resposta do servidor');
      setEstado('erro');
    }
  }

  const label =
    estado === 'sincronizando' ? 'Sincronizando…' :
    estado === 'atualizando'   ? 'Atualizando…'   :
    estado === 'erro'          ? 'Tentar novamente' :
    'Atualizar';

  return (
    <div className="refresh-control">
      <span className="refresh-time">Atualizado {texto}</span>
      {erroMsg && (
        <span className="refresh-error" title={erroMsg}>⚠ {erroMsg}</span>
      )}
      <button
        className={`refresh-btn${estado === 'erro' ? ' refresh-btn--erro' : ''}`}
        onClick={handleClick}
        disabled={estado === 'sincronizando' || estado === 'atualizando'}
      >
        {label}
      </button>
      {aviso && (
        <div
          className={`sync-toast${aviso.temErro ? ' sync-toast--erro' : ''}`}
          role="status"
        >
          <ul>
            {aviso.linhas.map((l) => (
              <li key={l.tipo} className={l.ok ? 'sync-toast__ok' : 'sync-toast__erro'}>
                <strong>{NOME_TIPO[l.tipo]}:</strong> {l.texto}
              </li>
            ))}
          </ul>
          <button
            className="sync-toast__fechar"
            onClick={() => setAviso(null)}
            aria-label="Fechar aviso"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
