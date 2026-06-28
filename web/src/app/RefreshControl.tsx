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

type Estado = 'idle' | 'sincronizando' | 'atualizando';

export function RefreshControl({ iso }: { iso: string | null }) {
  const router   = useRouter();
  const isoRef   = useRef(iso);
  const [texto,  setTexto]  = useState(() => calcular(iso));
  const [estado, setEstado] = useState<Estado>('idle');

  // Quando o servidor mandar novo iso (router.refresh completo), sincroniza
  useEffect(() => {
    isoRef.current = iso;
    setTexto(calcular(iso));
  }, [iso]);

  // Contador progressivo: tick a cada 10s lendo sempre o ref atual
  useEffect(() => {
    const id = setInterval(() => setTexto(calcular(isoRef.current)), 10_000);
    return () => clearInterval(id);
  }, []);

  async function handleClick() {
    if (estado !== 'idle') return;
    setEstado('sincronizando');
    try {
      const res = await fetch('/api/trigger-sync', {
        method: 'POST',
        signal: AbortSignal.timeout(40_000),
      });
      if (res.ok) {
        // Worker confirmou conclusão → update otimista imediato
        const agora = new Date().toISOString();
        isoRef.current = agora;
        setTexto('agora mesmo');
      }
    } catch {
      // timeout ou erro de rede — ainda atualiza a página
    } finally {
      setEstado('atualizando');
      router.refresh();
      setTimeout(() => setEstado('idle'), 1200);
    }
  }

  const label =
    estado === 'sincronizando' ? 'Sincronizando…' :
    estado === 'atualizando'   ? 'Atualizando…'   :
    'Atualizar';

  return (
    <div className="refresh-control">
      <span className="refresh-time">Atualizado {texto}</span>
      <button
        className="refresh-btn"
        onClick={handleClick}
        disabled={estado !== 'idle'}
      >
        {label}
      </button>
    </div>
  );
}
