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

export function RefreshControl({ iso }: { iso: string | null }) {
  const router  = useRouter();
  const isoRef  = useRef(iso);
  const [texto,   setTexto]   = useState(() => calcular(iso));
  const [estado,  setEstado]  = useState<Estado>('idle');
  const [erroMsg, setErroMsg] = useState<string | null>(null);

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
    </div>
  );
}
