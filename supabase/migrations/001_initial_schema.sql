-- ============================================================
-- TABELA PRINCIPAL: cartas de crédito
-- Regra de ouro: nunca DELETE. Apenas marque status.
-- ============================================================
CREATE TABLE cartas_credito (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificador único vindo da planilha
  referencia TEXT NOT NULL,

  -- Dados do negócio (colunas da planilha)
  credito_atualizado  NUMERIC(15,2),
  entrada             NUMERIC(15,2),
  prazo               INTEGER,
  valor_parcela       NUMERIC(15,2),
  prazo_diluido       INTEGER,         -- NULL quando "NÃO DILUI"
  parcela_diluida     NUMERIC(15,2),   -- NULL quando "NÃO DILUI"
  vencimento          DATE,
  taxa_transferencia  NUMERIC(15,2),

  -- Cópia bruta da linha inteira para auditoria forense
  raw_data JSONB NOT NULL,

  -- Ciclo de vida
  status                   TEXT NOT NULL DEFAULT 'disponivel'
                           CHECK (status IN ('disponivel', 'vendido')),
  ausencias_consecutivas   INTEGER NOT NULL DEFAULT 0,
  primeira_vez_visto_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultima_vez_visto_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  vendido_em               TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (referencia)
);

-- Índices para queries frequentes da UI
CREATE INDEX idx_cartas_status       ON cartas_credito(status);
CREATE INDEX idx_cartas_referencia   ON cartas_credito(referencia);
CREATE INDEX idx_cartas_vencimento   ON cartas_credito(vencimento);
CREATE INDEX idx_cartas_credito      ON cartas_credito(credito_atualizado DESC);

-- ============================================================
-- LOG DE AUDITORIA: um registro por ciclo de sync
-- ============================================================
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  iniciado_em      TIMESTAMPTZ NOT NULL,
  finalizado_em    TIMESTAMPTZ,

  -- 'sucesso'  → sync completo sem erros
  -- 'erro'     → falha em qualquer etapa, banco não foi alterado
  -- 'ignorado' → CSV idêntico ao anterior (checksum bateu), nada a fazer
  status TEXT NOT NULL CHECK (status IN ('sucesso', 'erro', 'ignorado')),

  linhas_recebidas INTEGER,
  novas_cartas     INTEGER,
  marcadas_vendido INTEGER,
  sem_alteracao    INTEGER,

  checksum_csv   TEXT,    -- SHA256 do CSV completo
  mensagem_erro  TEXT,
  stack_erro     TEXT,    -- stack trace completo para debug

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sync_logs_status ON sync_logs(status, created_at DESC);

-- ============================================================
-- ESTADO GLOBAL: lido pela UI e pelo worker
-- ============================================================
CREATE TABLE system_state (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seeds obrigatórios — NÃO REMOVER
INSERT INTO system_state (key, value) VALUES
  ('last_successful_sync', '"never"'),
  ('last_csv_checksum',    'null'),
  ('total_disponivel',     '0'),
  ('total_vendido',        '0');

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
ALTER TABLE cartas_credito ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_state   ENABLE ROW LEVEL SECURITY;

-- A service_role key (usada pelo worker) bypassa RLS automaticamente.
-- Para a web (anon key), policies de SELECT apenas:
CREATE POLICY "leitura_publica_cartas"
  ON cartas_credito FOR SELECT USING (true);

CREATE POLICY "leitura_publica_sync_logs"
  ON sync_logs FOR SELECT USING (true);

CREATE POLICY "leitura_publica_system_state"
  ON system_state FOR SELECT USING (true);

-- ============================================================
-- FUNÇÕES AUXILIARES
-- ============================================================

-- Wrapper para advisory lock (pg_catalog não é exposto pelo PostgREST diretamente)
CREATE OR REPLACE FUNCTION try_advisory_lock(lock_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT pg_try_advisory_lock(lock_id);
$$;

CREATE OR REPLACE FUNCTION advisory_unlock(lock_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT pg_advisory_unlock(lock_id);
$$;

-- Incrementa ausencias_consecutivas atomicamente
-- Chamada via rpc('incrementar_ausencias', { refs: [...] })
CREATE OR REPLACE FUNCTION incrementar_ausencias(refs TEXT[])
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE cartas_credito
  SET
    ausencias_consecutivas = ausencias_consecutivas + 1,
    updated_at = NOW()
  WHERE referencia = ANY(refs)
    AND status = 'disponivel';
$$;

-- ============================================================
-- GRANTS
-- Criar tabelas via SQL Editor não aplica GRANTs automáticos.
-- ============================================================

-- Worker (service_role): leitura e escrita em tudo
GRANT ALL ON TABLE cartas_credito TO service_role;
GRANT ALL ON TABLE sync_logs      TO service_role;
GRANT ALL ON TABLE system_state   TO service_role;

-- Web (anon key): só leitura
GRANT SELECT ON TABLE cartas_credito TO anon, authenticated;
GRANT SELECT ON TABLE sync_logs      TO anon, authenticated;
GRANT SELECT ON TABLE system_state   TO anon, authenticated;
