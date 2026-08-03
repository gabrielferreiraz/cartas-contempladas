-- Migration 002: suporte a múltiplos tipos de carta (imovel / automovel)

-- 1. Adiciona coluna tipo — linhas existentes ficam como 'imovel'
ALTER TABLE cartas_credito
  ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'imovel'
  CHECK (tipo IN ('imovel', 'automovel'));

-- 2. Substitui UNIQUE(referencia) por UNIQUE(referencia, tipo)
ALTER TABLE cartas_credito DROP CONSTRAINT IF EXISTS cartas_credito_referencia_key;
ALTER TABLE cartas_credito ADD CONSTRAINT cartas_credito_referencia_tipo_key UNIQUE (referencia, tipo);

-- 3. Recria incrementar_ausencias com filtro por tipo
CREATE OR REPLACE FUNCTION incrementar_ausencias(refs TEXT[], p_tipo TEXT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE cartas_credito
  SET ausencias_consecutivas = ausencias_consecutivas + 1
  WHERE referencia = ANY(refs)
    AND tipo = p_tipo
    AND status = 'disponivel';
END;
$$;

GRANT EXECUTE ON FUNCTION incrementar_ausencias(TEXT[], TEXT) TO service_role;
