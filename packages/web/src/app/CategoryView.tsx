'use client';

import { useState } from 'react';
import { TabView } from './TabView';
import { IconHouse, IconCar } from './Icons';
import type { Carta } from './CartasClient';
import type { CartaVendida } from './TabView';

type Categoria = 'imovel' | 'automovel';

interface DadosCategoria {
  disponiveis: Carta[];
  vendidas: CartaVendida[];
}

interface Props {
  imoveis:    DadosCategoria;
  automoveis: DadosCategoria;
  totais: {
    imovel:    { disponivel: number; vendido: number };
    automovel: { disponivel: number; vendido: number };
  };
}

export function CategoryView({ imoveis, automoveis, totais }: Props) {
  const [categoria, setCategoria] = useState<Categoria>('imovel');

  const dados = categoria === 'imovel' ? imoveis : automoveis;
  const total = totais[categoria];

  return (
    <div>
      {/* Segmented control de categoria */}
      <div className="cat-segmented">
        <button
          className={`cat-btn ${categoria === 'imovel' ? 'active' : ''}`}
          onClick={() => setCategoria('imovel')}
        >
          <IconHouse />
          Imóveis
        </button>
        <button
          className={`cat-btn ${categoria === 'automovel' ? 'active' : ''}`}
          onClick={() => setCategoria('automovel')}
        >
          <IconCar />
          Automóveis
        </button>
      </div>

      {/* Cards de totais */}
      <div className="totais">
        <div className="card card-disponivel">
          <div className="card-dot" />
          <div className="card-label">Disponíveis</div>
          <div className="card-value">{total.disponivel}</div>
        </div>
        <div className="card card-vendido">
          <div className="card-dot" />
          <div className="card-label">Vendidas</div>
          <div className="card-value">{total.vendido}</div>
        </div>
      </div>

      <TabView disponiveis={dados.disponiveis} vendidas={dados.vendidas} />
    </div>
  );
}
