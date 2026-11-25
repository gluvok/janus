-- PostgreSQL Schema for Janus Weighments System
-- Target: Supabase Postgres 15+

-- ----------------------------------------------------------------------------
-- 0. Safe Idempotent Cleanup (Reverse Dependency Order)
-- Safe to execute on both fresh (empty) and existing databases.
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.manual_tickets_view CASCADE;
DROP VIEW IF EXISTS public.automatic_tickets_view CASCADE;
DROP VIEW IF EXISTS public.manual_weighments_view CASCADE;
DROP VIEW IF EXISTS public.automatic_weighments_view CASCADE;
DROP VIEW IF EXISTS public.manual_entries_view CASCADE;
DROP VIEW IF EXISTS public.automatic_entries_view CASCADE;
DROP VIEW IF EXISTS public.weighments_view CASCADE;
DROP VIEW IF EXISTS public.entries_view CASCADE;

DROP TABLE IF EXISTS public.manual_tickets CASCADE;
DROP TABLE IF EXISTS public.automatic_tickets CASCADE;
DROP TABLE IF EXISTS public.manual_weighments CASCADE;
DROP TABLE IF EXISTS public.automatic_weighments CASCADE;
DROP TABLE IF EXISTS public.manual_entries CASCADE;
DROP TABLE IF EXISTS public.automatic_entries CASCADE;
DROP TABLE IF EXISTS public.tickets CASCADE;
DROP TABLE IF EXISTS public.weighments CASCADE;
DROP TABLE IF EXISTS public.entries CASCADE;
DROP TABLE IF EXISTS public.sessions CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.centers CASCADE;
DROP TABLE IF EXISTS public.factories CASCADE;

DROP FUNCTION IF EXISTS public.trigger_set_timestamp() CASCADE;
DROP FUNCTION IF EXISTS public.trigger_invalidate_sessions() CASCADE;
DROP FUNCTION IF EXISTS public.trigger_weighments_auto_populate() CASCADE;
DROP FUNCTION IF EXISTS public.reset_all_sequences() CASCADE;
DROP FUNCTION IF EXISTS public.reset_table_sequence(text) CASCADE;

DROP TYPE IF EXISTS public.ticket_status CASCADE;
DROP TYPE IF EXISTS public.weighment_type CASCADE;
DROP TYPE IF EXISTS public.role_enum CASCADE;

-- ----------------------------------------------------------------------------
-- 1. Extensions
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ----------------------------------------------------------------------------
-- 2. Custom Enumerated Types
-- ----------------------------------------------------------------------------
CREATE TYPE role_enum      AS ENUM ('admin', 'manager', 'operator', 'base');
CREATE TYPE weighment_type AS ENUM ('in', 'out', 'void');
CREATE TYPE ticket_status  AS ENUM ('pending', 'approved', 'rejected');

-- ----------------------------------------------------------------------------
-- 3. Core Tables: Factories, Centers, Users, Sessions
-- ----------------------------------------------------------------------------

-- Factories table
CREATE TABLE factories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  receipt_images_per_row INT NOT NULL DEFAULT 2 CHECK (receipt_images_per_row BETWEEN 1 AND 2),
  api_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_factories_name CHECK (length(trim(name)) BETWEEN 3 AND 50),
  CONSTRAINT chk_factories_api_key CHECK (length(trim(api_key)) >= 16)
);
CREATE INDEX idx_factories_name ON factories (name);
CREATE INDEX idx_factories_created_at ON factories (created_at DESC);

-- Centers table
CREATE TABLE centers (
  id SERIAL PRIMARY KEY,
  factory_id INT NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  api_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_centers_factory_name UNIQUE (factory_id, name),
  CONSTRAINT uq_centers_id_factory UNIQUE (id, factory_id),
  CONSTRAINT chk_centers_name CHECK (length(trim(name)) BETWEEN 3 AND 50),
  CONSTRAINT chk_centers_api_key CHECK (length(trim(api_key)) >= 16)
);
CREATE INDEX idx_centers_factory_id ON centers (factory_id);
CREATE INDEX idx_centers_name ON centers (name);
CREATE INDEX idx_centers_created_at ON centers (created_at DESC);

-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  factory_id INT NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role role_enum NOT NULL DEFAULT 'base',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_users_id_factory UNIQUE (id, factory_id),
  CONSTRAINT chk_users_username CHECK (length(trim(username)) BETWEEN 3 AND 50),
  CONSTRAINT chk_users_name CHECK (length(trim(name)) BETWEEN 3 AND 50)
);
CREATE INDEX idx_users_factory_id ON users (factory_id);
CREATE INDEX idx_users_role ON users (role);
CREATE INDEX idx_users_created_at ON users (created_at DESC);
CREATE INDEX idx_users_search_trgm ON users USING gin (name gin_trgm_ops, username gin_trgm_ops);

-- Sessions table
CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_user_id ON sessions (user_id);

-- ----------------------------------------------------------------------------
-- 4. Weighment Tables: Automatic & Manual Entries, Weighments, Tickets
-- ----------------------------------------------------------------------------

-- Automatic Entries table (raw automated scale readings at centers)
CREATE TABLE automatic_entries (
  id SERIAL PRIMARY KEY,
  center_id INT NOT NULL REFERENCES centers(id) ON DELETE RESTRICT,
  vehicle_number TEXT NOT NULL,
  weight DECIMAL(10, 2) NOT NULL CHECK (weight > 0),
  images TEXT[] NOT NULL DEFAULT '{}',
  idempotency_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_automatic_entries_vehicle CHECK (length(trim(vehicle_number)) BETWEEN 8 AND 11)
);
CREATE INDEX idx_automatic_entries_center_id ON automatic_entries (center_id);
CREATE INDEX idx_automatic_entries_vehicle_number ON automatic_entries (vehicle_number);
CREATE INDEX idx_automatic_entries_created_at ON automatic_entries (created_at DESC);
CREATE INDEX idx_automatic_entries_vehicle_trgm ON automatic_entries USING gin (vehicle_number gin_trgm_ops);

-- Manual Entries table (raw operator-entered scale readings at centers)
CREATE TABLE manual_entries (
  id SERIAL PRIMARY KEY,
  center_id INT NOT NULL REFERENCES centers(id) ON DELETE RESTRICT,
  creator_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  vehicle_number TEXT NOT NULL,
  weight DECIMAL(10, 2) NOT NULL CHECK (weight > 0),
  images TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_manual_entries_vehicle CHECK (length(trim(vehicle_number)) BETWEEN 8 AND 11)
);
CREATE INDEX idx_manual_entries_center_id ON manual_entries (center_id);
CREATE INDEX idx_manual_entries_creator_id ON manual_entries (creator_id);
CREATE INDEX idx_manual_entries_vehicle_number ON manual_entries (vehicle_number);
CREATE INDEX idx_manual_entries_created_at ON manual_entries (created_at DESC);
CREATE INDEX idx_manual_entries_vehicle_trgm ON manual_entries USING gin (vehicle_number gin_trgm_ops);

-- Automatic Weighments table (pairs automatic in-entry and out-entry)
CREATE TABLE automatic_weighments (
  id SERIAL PRIMARY KEY,
  in_entry_id INT NOT NULL REFERENCES automatic_entries(id) ON DELETE RESTRICT,
  out_entry_id INT NOT NULL REFERENCES automatic_entries(id) ON DELETE RESTRICT,
  gross DECIMAL(10, 2) NOT NULL CHECK (gross > 0),
  tare  DECIMAL(10, 2) NOT NULL CHECK (tare >= 0),
  net   DECIMAL(10, 2) GENERATED ALWAYS AS (gross - tare) STORED,
  type  weighment_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_automatic_weighments_in_entry UNIQUE (in_entry_id),
  CONSTRAINT uq_automatic_weighments_out_entry UNIQUE (out_entry_id),
  CONSTRAINT chk_automatic_weighments_distinct_entries CHECK (out_entry_id <> in_entry_id),
  CONSTRAINT chk_automatic_weighments_gross_tare CHECK (gross >= tare)
);
CREATE INDEX idx_automatic_weighments_created_at ON automatic_weighments (created_at DESC);
CREATE INDEX idx_automatic_weighments_in_entry ON automatic_weighments (in_entry_id);
CREATE INDEX idx_automatic_weighments_out_entry ON automatic_weighments (out_entry_id);
CREATE INDEX idx_automatic_weighments_gross ON automatic_weighments (gross);
CREATE INDEX idx_automatic_weighments_tare  ON automatic_weighments (tare);
CREATE INDEX idx_automatic_weighments_net   ON automatic_weighments (net);
CREATE INDEX idx_automatic_weighments_type  ON automatic_weighments (type);

-- Manual Weighments table (pairs manual in-entry and out-entry)
CREATE TABLE manual_weighments (
  id SERIAL PRIMARY KEY,
  in_entry_id INT NOT NULL REFERENCES manual_entries(id) ON DELETE RESTRICT,
  out_entry_id INT NOT NULL REFERENCES manual_entries(id) ON DELETE RESTRICT,
  gross DECIMAL(10, 2) NOT NULL CHECK (gross > 0),
  tare  DECIMAL(10, 2) NOT NULL CHECK (tare >= 0),
  net   DECIMAL(10, 2) GENERATED ALWAYS AS (gross - tare) STORED,
  type  weighment_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_manual_weighments_in_entry UNIQUE (in_entry_id),
  CONSTRAINT uq_manual_weighments_out_entry UNIQUE (out_entry_id),
  CONSTRAINT chk_manual_weighments_distinct_entries CHECK (out_entry_id <> in_entry_id),
  CONSTRAINT chk_manual_weighments_gross_tare CHECK (gross >= tare)
);
CREATE INDEX idx_manual_weighments_created_at ON manual_weighments (created_at DESC);
CREATE INDEX idx_manual_weighments_in_entry ON manual_weighments (in_entry_id);
CREATE INDEX idx_manual_weighments_out_entry ON manual_weighments (out_entry_id);
CREATE INDEX idx_manual_weighments_gross ON manual_weighments (gross);
CREATE INDEX idx_manual_weighments_tare  ON manual_weighments (tare);
CREATE INDEX idx_manual_weighments_net   ON manual_weighments (net);
CREATE INDEX idx_manual_weighments_type  ON manual_weighments (type);

-- Automatic Tickets table (issues/concerns raised on automatic entries)
CREATE TABLE automatic_tickets (
  id SERIAL PRIMARY KEY,
  concern TEXT NOT NULL,
  reply TEXT,
  status ticket_status NOT NULL DEFAULT 'pending',
  entry_id INT NOT NULL REFERENCES automatic_entries(id) ON DELETE RESTRICT,
  creator_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_automatic_tickets_concern CHECK (length(trim(concern)) > 0)
);
CREATE INDEX idx_automatic_tickets_entry_id ON automatic_tickets (entry_id);
CREATE INDEX idx_automatic_tickets_creator_id ON automatic_tickets (creator_id);
CREATE INDEX idx_automatic_tickets_status ON automatic_tickets (status);
CREATE INDEX idx_automatic_tickets_created_at ON automatic_tickets (created_at DESC);

-- Manual Tickets table (issues/concerns raised on manual entries)
CREATE TABLE manual_tickets (
  id SERIAL PRIMARY KEY,
  concern TEXT NOT NULL,
  reply TEXT,
  status ticket_status NOT NULL DEFAULT 'pending',
  entry_id INT NOT NULL REFERENCES manual_entries(id) ON DELETE RESTRICT,
  creator_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_manual_tickets_concern CHECK (length(trim(concern)) > 0)
);
CREATE INDEX idx_manual_tickets_entry_id ON manual_tickets (entry_id);
CREATE INDEX idx_manual_tickets_creator_id ON manual_tickets (creator_id);
CREATE INDEX idx_manual_tickets_status ON manual_tickets (status);
CREATE INDEX idx_manual_tickets_created_at ON manual_tickets (created_at DESC);

-- ----------------------------------------------------------------------------
-- 5. Views
-- ----------------------------------------------------------------------------

-- Security invoker view exposing automatic entries with center details
CREATE OR REPLACE VIEW automatic_entries_view WITH (security_invoker = true) AS
SELECT
  e.id,
  c.factory_id,
  e.center_id,
  c.name AS center_name,
  e.vehicle_number,
  e.weight,
  e.images,
  e.idempotency_key,
  e.created_at,
  e.updated_at,
  e.deleted_at
FROM public.automatic_entries e
JOIN public.centers c ON c.id = e.center_id;

-- Security invoker view exposing manual entries with center and creator details
CREATE OR REPLACE VIEW manual_entries_view WITH (security_invoker = true) AS
SELECT
  e.id,
  c.factory_id,
  e.center_id,
  c.name AS center_name,
  e.creator_id,
  u.name AS creator_name,
  u.username AS creator_username,
  e.vehicle_number,
  e.weight,
  e.images,
  e.created_at,
  e.updated_at,
  e.deleted_at
FROM public.manual_entries e
JOIN public.centers c ON c.id = e.center_id
JOIN public.users u ON u.id = e.creator_id;

-- Security invoker view joining paired automatic weighments with in/out entries & centers
CREATE OR REPLACE VIEW automatic_weighments_view WITH (security_invoker = true) AS
SELECT
  w.id,
  ic.factory_id,
  w.in_entry_id,
  w.out_entry_id,
  ie.vehicle_number,
  w.gross,
  w.tare,
  w.net,
  w.type,
  ie.created_at AS in_time,
  oe.created_at AS out_time,
  ie.center_id AS in_center_id,
  ic.name AS in_center_name,
  oe.center_id AS out_center_id,
  oc.name AS out_center_name,
  ie.images AS in_images,
  oe.images AS out_images,
  ie.images || oe.images AS images,
  w.created_at,
  w.updated_at,
  w.deleted_at
FROM public.automatic_weighments w
JOIN public.automatic_entries ie ON ie.id = w.in_entry_id
JOIN public.centers ic ON ic.id = ie.center_id
JOIN public.automatic_entries oe ON oe.id = w.out_entry_id
JOIN public.centers oc ON oc.id = oe.center_id;

-- Security invoker view joining paired manual weighments with in/out entries, centers & creators
CREATE OR REPLACE VIEW manual_weighments_view WITH (security_invoker = true) AS
SELECT
  w.id,
  ic.factory_id,
  w.in_entry_id,
  w.out_entry_id,
  ie.vehicle_number,
  w.gross,
  w.tare,
  w.net,
  w.type,
  ie.created_at AS in_time,
  oe.created_at AS out_time,
  ie.center_id AS in_center_id,
  ic.name AS in_center_name,
  oe.center_id AS out_center_id,
  oc.name AS out_center_name,
  ie.images AS in_images,
  oe.images AS out_images,
  ie.images || oe.images AS images,
  ie.creator_id AS in_creator_id,
  iu.name AS in_creator_name,
  iu.username AS in_creator_username,
  oe.creator_id AS out_creator_id,
  ou.name AS out_creator_name,
  ou.username AS out_creator_username,
  w.created_at,
  w.updated_at,
  w.deleted_at
FROM public.manual_weighments w
JOIN public.manual_entries ie ON ie.id = w.in_entry_id
JOIN public.centers ic ON ic.id = ie.center_id
JOIN public.users iu ON iu.id = ie.creator_id
JOIN public.manual_entries oe ON oe.id = w.out_entry_id
JOIN public.centers oc ON oc.id = oe.center_id
JOIN public.users ou ON ou.id = oe.creator_id;

-- Security invoker view exposing automatic tickets with entry, factory, and creator details
CREATE OR REPLACE VIEW automatic_tickets_view WITH (security_invoker = true) AS
SELECT
  t.id,
  c.factory_id,
  t.concern,
  t.reply,
  t.status,
  t.entry_id,
  e.vehicle_number,
  t.creator_id,
  u.name AS creator_name,
  u.username AS creator_username,
  t.created_at,
  t.updated_at
FROM public.automatic_tickets t
JOIN public.automatic_entries e ON e.id = t.entry_id
JOIN public.centers c ON c.id = e.center_id
JOIN public.users u ON u.id = t.creator_id;

-- Security invoker view exposing manual tickets with entry, factory, and creator details
CREATE OR REPLACE VIEW manual_tickets_view WITH (security_invoker = true) AS
SELECT
  t.id,
  c.factory_id,
  t.concern,
  t.reply,
  t.status,
  t.entry_id,
  e.vehicle_number,
  t.creator_id,
  u.name AS creator_name,
  u.username AS creator_username,
  t.created_at,
  t.updated_at
FROM public.manual_tickets t
JOIN public.manual_entries e ON e.id = t.entry_id
JOIN public.centers c ON c.id = e.center_id
JOIN public.users u ON u.id = t.creator_id;

-- ----------------------------------------------------------------------------
-- 6. Triggers & Stored Procedures
-- ----------------------------------------------------------------------------

-- Automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_factories_timestamp
  BEFORE UPDATE ON factories FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER trg_centers_timestamp
  BEFORE UPDATE ON centers FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER trg_users_timestamp
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER trg_sessions_timestamp
  BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER trg_automatic_entries_timestamp
  BEFORE UPDATE ON automatic_entries FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER trg_manual_entries_timestamp
  BEFORE UPDATE ON manual_entries FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER trg_automatic_weighments_timestamp
  BEFORE UPDATE ON automatic_weighments FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER trg_manual_weighments_timestamp
  BEFORE UPDATE ON manual_weighments FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER trg_automatic_tickets_timestamp
  BEFORE UPDATE ON automatic_tickets FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER trg_manual_tickets_timestamp
  BEFORE UPDATE ON manual_tickets FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- Invalidate user sessions when password, username, role, or deletion status changes
CREATE OR REPLACE FUNCTION trigger_invalidate_sessions()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.password_hash <> OLD.password_hash 
     OR NEW.username <> OLD.username 
     OR NEW.role <> OLD.role 
     OR (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL) THEN
    DELETE FROM public.sessions WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_invalidate_sessions
  AFTER UPDATE OF password_hash, username, role, deleted_at ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_invalidate_sessions();

-- Enforce cross-tenant isolation and compute/verify weighment metrics
CREATE OR REPLACE FUNCTION trigger_weighments_auto_populate()
RETURNS TRIGGER AS $$
DECLARE
  entry_table text := TG_ARGV[0];
  in_rec RECORD;
  out_rec RECORD;
BEGIN
  IF entry_table NOT IN ('automatic_entries', 'manual_entries') THEN
    RAISE EXCEPTION 'Invalid entry table argument: %', entry_table;
  END IF;

  EXECUTE format(
    'SELECT e.weight, e.vehicle_number, c.factory_id
       FROM public.%I e
       JOIN public.centers c ON c.id = e.center_id
      WHERE e.id = $1',
    entry_table
  ) INTO in_rec USING NEW.in_entry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced in_entry (%) or out_entry (%) not found', NEW.in_entry_id, NEW.out_entry_id;
  END IF;

  EXECUTE format(
    'SELECT e.weight, e.vehicle_number, c.factory_id
       FROM public.%I e
       JOIN public.centers c ON c.id = e.center_id
      WHERE e.id = $1',
    entry_table
  ) INTO out_rec USING NEW.out_entry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced in_entry (%) or out_entry (%) not found', NEW.in_entry_id, NEW.out_entry_id;
  END IF;

  IF in_rec.factory_id <> out_rec.factory_id THEN
    RAISE EXCEPTION 'Cross-factory pairing rejected: in_center factory % <> out_center factory %', 
      in_rec.factory_id, out_rec.factory_id;
  END IF;

  -- Auto-compute or validate gross, tare, type
  NEW.gross := GREATEST(in_rec.weight, out_rec.weight);
  NEW.tare  := LEAST(in_rec.weight, out_rec.weight);
  NEW.type  := CASE
                 WHEN in_rec.weight > out_rec.weight THEN 'in'::weighment_type
                 WHEN in_rec.weight < out_rec.weight THEN 'out'::weighment_type
                 ELSE 'void'::weighment_type
               END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_automatic_weighments_auto_populate
  BEFORE INSERT OR UPDATE OF in_entry_id, out_entry_id ON automatic_weighments
  FOR EACH ROW EXECUTE FUNCTION trigger_weighments_auto_populate('automatic_entries');

CREATE TRIGGER trg_manual_weighments_auto_populate
  BEFORE INSERT OR UPDATE OF in_entry_id, out_entry_id ON manual_weighments
  FOR EACH ROW EXECUTE FUNCTION trigger_weighments_auto_populate('manual_entries');

-- Sequence reset procedures for database testing and seed isolation
CREATE OR REPLACE FUNCTION reset_table_sequence(p_table text)
RETURNS void AS $$
DECLARE
  seq_name text;
  max_id bigint;
BEGIN
  SELECT pg_get_serial_sequence(p_table, 'id') INTO seq_name;
  IF seq_name IS NOT NULL THEN
    EXECUTE format('SELECT COALESCE(MAX(id), 0) FROM %I', p_table) INTO max_id;
    IF max_id = 0 THEN
      EXECUTE format('ALTER SEQUENCE %s RESTART WITH 1', seq_name);
    ELSE
      PERFORM setval(seq_name, max_id, true);
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reset_all_sequences()
RETURNS void AS $$
BEGIN
  PERFORM reset_table_sequence('factories');
  PERFORM reset_table_sequence('centers');
  PERFORM reset_table_sequence('users');
  PERFORM reset_table_sequence('sessions');
  PERFORM reset_table_sequence('automatic_entries');
  PERFORM reset_table_sequence('manual_entries');
  PERFORM reset_table_sequence('automatic_weighments');
  PERFORM reset_table_sequence('manual_weighments');
  PERFORM reset_table_sequence('automatic_tickets');
  PERFORM reset_table_sequence('manual_tickets');
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 7. Storage Bucket & Policies Setup
-- Target Bucket: 'mesto'
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('mesto', 'mesto', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Allow read access for mesto bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow insert access for mesto bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow update access for mesto bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete access for mesto bucket" ON storage.objects;

CREATE POLICY "Allow read access for mesto bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'mesto');

CREATE POLICY "Allow insert access for mesto bucket"
ON storage.objects FOR INSERT TO anon, authenticated, service_role
WITH CHECK (
  bucket_id = 'mesto' AND
  name ~ '^[0-9]+/[^/]+$'
);

CREATE POLICY "Allow update access for mesto bucket"
ON storage.objects FOR UPDATE TO anon, authenticated, service_role
USING (bucket_id = 'mesto')
WITH CHECK (bucket_id = 'mesto');

CREATE POLICY "Allow delete access for mesto bucket"
ON storage.objects FOR DELETE TO anon, authenticated, service_role
USING (bucket_id = 'mesto');

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
