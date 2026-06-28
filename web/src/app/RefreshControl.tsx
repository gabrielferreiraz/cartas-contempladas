'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

function calcular(iso: string | null): string {
  if (!iso || iso === 'never') return 'nunca sincronizado';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diff < 1) return 'agora mesmo';
  if (diff === 1) return '1 min atrás';
  return `${diff} min atrás`;
}

type Estado = 'idle' | 'sincronizando' | 'atualizando';

export function RefreshControl({ iso }: { iso: string | null }) {
  const router = useRouter();
  const [texto,  setTexto]  = useState(() => calcular(iso));
  const [estado, setEstado] = useState<Estado>('idle');

  useEffect(() => {
    setTexto(calcular(iso));
    const id = setInterval(() => setTexto(calcular(iso)), 30_000);
    return () => clearInterval(id);
  }, [iso]);

  async function handleClick() {
    if (estado !== 'idle') return;

    setEstado('sincronizando');
    try {
      await fetch('/api/trigger-sync', {
        method: 'POST',
        signal: AbortSignal.timeout(40_000),
      });
    } catch {
      // Timeout, worker inacessível ou erro de rede — recarrega a página assim mesmo
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
