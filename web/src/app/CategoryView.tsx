'use client';

import { useState } from 'react';
import { CartasClient, type Carta } from './CartasClient';

type View = null | 'imovel' | 'automovel';

interface Props {
  imoveis:    { disponiveis: Carta[] };
  automoveis: { disponiveis: Carta[] };
  totais: {
    imovel:    { disponivel: number };
    automovel: { disponivel: number };
  };
}

function ArrowRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function BackArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

export function CategoryView({ imoveis, automoveis, totais }: Props) {
  const [view, setView] = useState<View>(null);

  if (view === null) {
    return (
      <div className="landing">
        <p className="landing-subtitle">Selecione uma categoria</p>
        <div className="landing-cards">
          <button className="landing-card" onClick={() => setView('imovel')}>
            <div className="landing-card-icon"><img src="/home-2.svg" alt="" width={32} height={32} /></div>
            <div className="landing-card-body">
              <span className="landing-card-title">Imóvel</span>
              <span className="landing-card-count">{totais.imovel.disponivel} cartas disponíveis</span>
            </div>
            <span className="landing-card-arrow"><ArrowRight /></span>
          </button>

          <button className="landing-card" onClick={() => setView('automovel')}>
            <div className="landing-card-icon"><img src="/car.svg" alt="" width={32} height={32} /></div>
            <div className="landing-card-body">
              <span className="landing-card-title">Automóvel</span>
              <span className="landing-card-count">{totais.automovel.disponivel} cartas disponíveis</span>
            </div>
            <span className="landing-card-arrow"><ArrowRight /></span>
          </button>
        </div>
      </div>
    );
  }

  const dados = view === 'imovel' ? imoveis : automoveis;
  const label = view === 'imovel' ? 'Imóvel' : 'Automóvel';
  const count = totais[view].disponivel;

  return (
    <div>
      <div className="cat-page-header">
        <button className="cat-page-back" onClick={() => setView(null)}>
          <BackArrow />
          Voltar
        </button>
        <h2 className="cat-page-title">Cartas Contempladas {label}</h2>
        <span className="cat-page-count">{count} disponíveis</span>
      </div>

      <CartasClient cartas={dados.disponiveis} />
    </div>
  );
}
