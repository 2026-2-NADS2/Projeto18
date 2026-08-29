-- Passo 7 · Parte B — banco de TESTE com brigas plantadas de propósito.
-- Carregue num Postgres real:  psql "$DATABASE_URL" -f fixtures/postgres-schema.sql
-- Depois rode:                 npm run report:pg
--
-- Espelha o fixture manual: 1 write-write + 2 read-after-write + 2 controles.

DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS outbox CASCADE;

CREATE TABLE orders (
  id               serial PRIMARY KEY,
  subtotal         numeric,
  total            numeric,
  audit_prev_total numeric,
  customer_tier    text,
  updated_at       timestamptz
);

CREATE TABLE customers (
  id              serial PRIMARY KEY,
  email           text,
  welcome_sent_at timestamptz
);

CREATE TABLE outbox (id serial PRIMARY KEY, addr text);

-- === funções dos triggers ===================================================

-- snapshot: tenta guardar o total... mas roda ANTES de discount/tax (nome trg_00)
CREATE OR REPLACE FUNCTION fn_snapshot_total() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.audit_prev_total := NEW.total;  -- BUG: lê total antes de ser recalculado
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION fn_apply_discount() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.total := NEW.subtotal * (1 - CASE WHEN NEW.customer_tier = 'vip' THEN 0.1 ELSE 0 END);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION fn_apply_tax() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.total := NEW.subtotal * 1.1;    -- BRIGA: escreve total, igual ao discount
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION fn_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();            -- controle: campo exclusivo, não briga
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION fn_welcome_email() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO outbox(addr) VALUES (NEW.email);  -- controle: outro balde
  RETURN NEW;
END; $$;

-- === triggers (nome com prefixo numérico controla a ordem de disparo) ========

CREATE TRIGGER trg_00_snapshot_total BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION fn_snapshot_total();
CREATE TRIGGER trg_10_apply_discount BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION fn_apply_discount();
CREATE TRIGGER trg_20_apply_tax BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION fn_apply_tax();
CREATE TRIGGER trg_90_set_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_welcome_email AFTER INSERT ON customers
  FOR EACH ROW EXECUTE FUNCTION fn_welcome_email();
