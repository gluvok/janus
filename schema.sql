-- PostgreSQL Schema for Janus Weighments System
-- Target: Supabase Postgres 15+
-- Non-destructive & idempotent: safe to run on empty databases and live legacy databases
-- without dropping or deprecating existing tables (entries, weighments, tickets, customers, etc.).

-- ----------------------------------------------------------------------------
-- 1. Extensions
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ----------------------------------------------------------------------------
-- 2. Custom Enumerated Types (additive; preserves existing values such as 'hardware' / 'unassigned')
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'role_enum'
  ) THEN
    CREATE TYPE public.role_enum AS ENUM ('admin', 'manager', 'operator', 'base');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'weighment_type'
  ) THEN
    CREATE TYPE public.weighment_type AS ENUM ('in', 'out', 'void');
  END IF;
END $$;

ALTER TYPE public.weighment_type ADD VALUE IF NOT EXISTS 'void';

-- ----------------------------------------------------------------------------
-- 3. Core Tables: Factories, Centers, Users, Sessions
-- ----------------------------------------------------------------------------

-- Factories table
CREATE TABLE IF NOT EXISTS public.factories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  receipt_images_per_row INT NOT NULL DEFAULT 2 CHECK (receipt_images_per_row BETWEEN 1 AND 2),
  api_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_factories_name CHECK (length(trim(name)) BETWEEN 3 AND 50),
  CONSTRAINT chk_factories_api_key CHECK (length(trim(api_key)) >= 16)
);
ALTER TABLE public.factories ADD COLUMN IF NOT EXISTS api_key TEXT;
UPDATE public.factories
SET api_key = md5('factory-' || id::text || '-' || clock_timestamp()::text || '-' || random()::text)
WHERE api_key IS NULL OR trim(api_key) = '';
CREATE INDEX IF NOT EXISTS idx_factories_name ON public.factories (name);
CREATE INDEX IF NOT EXISTS idx_factories_created_at ON public.factories (created_at DESC);

-- Centers table
CREATE TABLE IF NOT EXISTS public.centers (
  id SERIAL PRIMARY KEY,
  factory_id INT NOT NULL REFERENCES public.factories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  api_key_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_centers_factory_name UNIQUE (factory_id, name),
  CONSTRAINT uq_centers_id_factory UNIQUE (id, factory_id),
  CONSTRAINT chk_centers_name CHECK (length(trim(name)) BETWEEN 3 AND 50),
  CONSTRAINT chk_centers_api_key_hash CHECK (api_key_hash ~ '^[0-9a-f]{64}$')
);
-- Center API keys are stored only as SHA-256 hex. Existing plain keys keep working (hash backfilled).
ALTER TABLE public.centers ADD COLUMN IF NOT EXISTS api_key_hash TEXT;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'centers' AND column_name = 'api_key'
  ) THEN
    UPDATE public.centers
    SET api_key_hash = encode(sha256(convert_to(api_key, 'UTF8')), 'hex')
    WHERE api_key_hash IS NULL AND api_key IS NOT NULL;
    ALTER TABLE public.centers DROP COLUMN api_key; -- drops idx_centers_api_key and chk_centers_api_key with it
  END IF;
END $$;
-- Any row still without a key gets an unusable random hash; an admin rotates it to issue a real key.
UPDATE public.centers
SET api_key_hash = encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex')
WHERE api_key_hash IS NULL;
ALTER TABLE public.centers ALTER COLUMN api_key_hash SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_centers_api_key_hash ON public.centers (api_key_hash);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_centers_api_key_hash' AND conrelid = 'public.centers'::regclass
  ) THEN
    ALTER TABLE public.centers
      ADD CONSTRAINT chk_centers_api_key_hash CHECK (api_key_hash ~ '^[0-9a-f]{64}$');
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_centers_id_factory'
      AND conrelid = 'public.centers'::regclass
  ) THEN
    ALTER TABLE public.centers ADD CONSTRAINT uq_centers_id_factory UNIQUE (id, factory_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_centers_factory_id ON public.centers (factory_id);
CREATE INDEX IF NOT EXISTS idx_centers_name ON public.centers (name);
CREATE INDEX IF NOT EXISTS idx_centers_created_at ON public.centers (created_at DESC);

-- Users table
CREATE TABLE IF NOT EXISTS public.users (
  id SERIAL PRIMARY KEY,
  factory_id INT NOT NULL REFERENCES public.factories(id) ON DELETE RESTRICT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role public.role_enum NOT NULL DEFAULT 'base',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_users_id_factory UNIQUE (id, factory_id),
  CONSTRAINT chk_users_username CHECK (length(trim(username)) BETWEEN 3 AND 50),
  CONSTRAINT chk_users_name CHECK (length(trim(name)) BETWEEN 3 AND 50)
);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_users_id_factory'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT uq_users_id_factory UNIQUE (id, factory_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_users_factory_id ON public.users (factory_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users (role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_search_trgm ON public.users USING gin (name public.gin_trgm_ops, username public.gin_trgm_ops);

-- Sessions table (supports both hashed token_hash sessions and legacy plaintext token sessions)
CREATE TABLE IF NOT EXISTS public.sessions (
  id SERIAL PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id INT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS token_hash TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.sessions'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) LIKE '%(token_hash)%'
  ) THEN
    ALTER TABLE public.sessions ADD CONSTRAINT sessions_token_hash_key UNIQUE (token_hash);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sessions'
      AND column_name = 'token'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.sessions ALTER COLUMN token DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sessions'
      AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE public.sessions ALTER COLUMN expires_at SET DEFAULT (now() + interval '12 hours');
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions (user_id);

-- ----------------------------------------------------------------------------
-- 4. Weighment Tables: Automatic & Manual Entries, Weighments
-- ----------------------------------------------------------------------------

-- Automatic Entries table (raw automated scale readings at centers)
CREATE TABLE IF NOT EXISTS public.automatic_entries (
  id SERIAL PRIMARY KEY,
  center_id INT NOT NULL REFERENCES public.centers(id) ON DELETE RESTRICT,
  vehicle_number TEXT NOT NULL,
  weight DECIMAL(10, 2) NOT NULL CHECK (weight > 0),
  images TEXT[] NOT NULL DEFAULT '{}',
  idempotency_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_automatic_entries_vehicle CHECK (vehicle_number = 'NO_PLATE_DETECTED' OR length(trim(vehicle_number)) BETWEEN 8 AND 11)
);
CREATE INDEX IF NOT EXISTS idx_automatic_entries_center_id ON public.automatic_entries (center_id);
CREATE INDEX IF NOT EXISTS idx_automatic_entries_vehicle_number ON public.automatic_entries (vehicle_number);
CREATE INDEX IF NOT EXISTS idx_automatic_entries_created_at ON public.automatic_entries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automatic_entries_vehicle_trgm ON public.automatic_entries USING gin (vehicle_number public.gin_trgm_ops);
ALTER TABLE public.automatic_entries DROP CONSTRAINT IF EXISTS chk_automatic_entries_vehicle;
ALTER TABLE public.automatic_entries ADD CONSTRAINT chk_automatic_entries_vehicle
  CHECK (vehicle_number = 'NO_PLATE_DETECTED' OR length(trim(vehicle_number)) BETWEEN 8 AND 11);

-- Manual Entries table (raw operator-entered scale readings at centers)
CREATE TABLE IF NOT EXISTS public.manual_entries (
  id SERIAL PRIMARY KEY,
  center_id INT NOT NULL REFERENCES public.centers(id) ON DELETE RESTRICT,
  creator_id INT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  vehicle_number TEXT NOT NULL,
  weight DECIMAL(10, 2) NOT NULL CHECK (weight > 0),
  images TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_manual_entries_vehicle CHECK (length(trim(vehicle_number)) BETWEEN 8 AND 11)
);
CREATE INDEX IF NOT EXISTS idx_manual_entries_center_id ON public.manual_entries (center_id);
CREATE INDEX IF NOT EXISTS idx_manual_entries_creator_id ON public.manual_entries (creator_id);
CREATE INDEX IF NOT EXISTS idx_manual_entries_vehicle_number ON public.manual_entries (vehicle_number);
CREATE INDEX IF NOT EXISTS idx_manual_entries_created_at ON public.manual_entries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_manual_entries_vehicle_trgm ON public.manual_entries USING gin (vehicle_number public.gin_trgm_ops);

-- Automatic Weighments table (pairs automatic in-entry and out-entry)
CREATE TABLE IF NOT EXISTS public.automatic_weighments (
  id SERIAL PRIMARY KEY,
  in_entry_id INT NOT NULL REFERENCES public.automatic_entries(id) ON DELETE RESTRICT,
  out_entry_id INT NOT NULL REFERENCES public.automatic_entries(id) ON DELETE RESTRICT,
  gross DECIMAL(10, 2) NOT NULL CHECK (gross > 0),
  tare  DECIMAL(10, 2) NOT NULL CHECK (tare >= 0),
  net   DECIMAL(10, 2) GENERATED ALWAYS AS (gross - tare) STORED,
  type  public.weighment_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_automatic_weighments_in_entry UNIQUE (in_entry_id),
  CONSTRAINT uq_automatic_weighments_out_entry UNIQUE (out_entry_id),
  CONSTRAINT chk_automatic_weighments_distinct_entries CHECK (out_entry_id <> in_entry_id),
  CONSTRAINT chk_automatic_weighments_gross_tare CHECK (gross >= tare)
);
CREATE INDEX IF NOT EXISTS idx_automatic_weighments_created_at ON public.automatic_weighments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automatic_weighments_in_entry ON public.automatic_weighments (in_entry_id);
CREATE INDEX IF NOT EXISTS idx_automatic_weighments_out_entry ON public.automatic_weighments (out_entry_id);
CREATE INDEX IF NOT EXISTS idx_automatic_weighments_gross ON public.automatic_weighments (gross);
CREATE INDEX IF NOT EXISTS idx_automatic_weighments_tare  ON public.automatic_weighments (tare);
CREATE INDEX IF NOT EXISTS idx_automatic_weighments_net   ON public.automatic_weighments (net);
CREATE INDEX IF NOT EXISTS idx_automatic_weighments_type  ON public.automatic_weighments (type);

-- Manual Weighments table (pairs manual in-entry and out-entry)
CREATE TABLE IF NOT EXISTS public.manual_weighments (
  id SERIAL PRIMARY KEY,
  in_entry_id INT NOT NULL REFERENCES public.manual_entries(id) ON DELETE RESTRICT,
  out_entry_id INT NOT NULL REFERENCES public.manual_entries(id) ON DELETE RESTRICT,
  gross DECIMAL(10, 2) NOT NULL CHECK (gross > 0),
  tare  DECIMAL(10, 2) NOT NULL CHECK (tare >= 0),
  net   DECIMAL(10, 2) GENERATED ALWAYS AS (gross - tare) STORED,
  type  public.weighment_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_manual_weighments_in_entry UNIQUE (in_entry_id),
  CONSTRAINT uq_manual_weighments_out_entry UNIQUE (out_entry_id),
  CONSTRAINT chk_manual_weighments_distinct_entries CHECK (out_entry_id <> in_entry_id),
  CONSTRAINT chk_manual_weighments_gross_tare CHECK (gross >= tare)
);
CREATE INDEX IF NOT EXISTS idx_manual_weighments_created_at ON public.manual_weighments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_manual_weighments_in_entry ON public.manual_weighments (in_entry_id);
CREATE INDEX IF NOT EXISTS idx_manual_weighments_out_entry ON public.manual_weighments (out_entry_id);
CREATE INDEX IF NOT EXISTS idx_manual_weighments_gross ON public.manual_weighments (gross);
CREATE INDEX IF NOT EXISTS idx_manual_weighments_tare  ON public.manual_weighments (tare);
CREATE INDEX IF NOT EXISTS idx_manual_weighments_net   ON public.manual_weighments (net);
CREATE INDEX IF NOT EXISTS idx_manual_weighments_type  ON public.manual_weighments (type);

-- ----------------------------------------------------------------------------
-- 5. Views
-- ----------------------------------------------------------------------------

-- Security invoker view exposing automatic entries with center details
CREATE OR REPLACE VIEW public.automatic_entries_view WITH (security_invoker = true) AS
SELECT
  e.id,
  c.factory_id,
  e.center_id,
  c.name AS center_name,
  e.vehicle_number,
  e.weight,
  e.images,
  e.created_at,
  e.updated_at,
  e.deleted_at
FROM public.automatic_entries e
JOIN public.centers c ON c.id = e.center_id
WHERE e.deleted_at IS NULL;

-- Security invoker view exposing manual entries with center and creator details
CREATE OR REPLACE VIEW public.manual_entries_view WITH (security_invoker = true) AS
SELECT
  e.id,
  c.factory_id,
  e.center_id,
  c.name AS center_name,
  e.creator_id,
  u.name AS creator_name,
  u.username AS creator_username,
  u.role AS creator_role,
  e.vehicle_number,
  e.weight,
  e.images,
  e.created_at,
  e.updated_at,
  e.deleted_at
FROM public.manual_entries e
JOIN public.centers c ON c.id = e.center_id
JOIN public.users u ON u.id = e.creator_id
WHERE e.deleted_at IS NULL;

-- Security invoker view joining paired automatic weighments with in/out entries & centers
CREATE OR REPLACE VIEW public.automatic_weighments_view WITH (security_invoker = true) AS
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
JOIN public.centers oc ON oc.id = oe.center_id
WHERE w.deleted_at IS NULL AND ie.deleted_at IS NULL AND oe.deleted_at IS NULL;

-- Security invoker view joining paired manual weighments with in/out entries, centers & creators
CREATE OR REPLACE VIEW public.manual_weighments_view WITH (security_invoker = true) AS
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
  iu.role AS in_creator_role,
  oe.creator_id AS out_creator_id,
  ou.name AS out_creator_name,
  ou.username AS out_creator_username,
  ou.role AS out_creator_role,
  w.created_at,
  w.updated_at,
  w.deleted_at
FROM public.manual_weighments w
JOIN public.manual_entries ie ON ie.id = w.in_entry_id
JOIN public.centers ic ON ic.id = ie.center_id
JOIN public.users iu ON iu.id = ie.creator_id
JOIN public.manual_entries oe ON oe.id = w.out_entry_id
JOIN public.centers oc ON oc.id = oe.center_id
JOIN public.users ou ON ou.id = oe.creator_id
WHERE w.deleted_at IS NULL AND ie.deleted_at IS NULL AND oe.deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 6. Triggers & Stored Procedures
-- ----------------------------------------------------------------------------

-- Automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['factories', 'centers', 'users', 'sessions'] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relnamespace = 'public'::regnamespace
        AND c.relname = tbl
        AND NOT t.tgisinternal
        AND t.tgname IN ('trg_' || tbl || '_timestamp', 'trg_' || tbl || '_updated_at')
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp()',
        'trg_' || tbl || '_timestamp',
        tbl
      );
    END IF;
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS trg_automatic_entries_timestamp ON public.automatic_entries;
CREATE TRIGGER trg_automatic_entries_timestamp
  BEFORE UPDATE ON public.automatic_entries FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

DROP TRIGGER IF EXISTS trg_manual_entries_timestamp ON public.manual_entries;
CREATE TRIGGER trg_manual_entries_timestamp
  BEFORE UPDATE ON public.manual_entries FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

DROP TRIGGER IF EXISTS trg_automatic_weighments_timestamp ON public.automatic_weighments;
CREATE TRIGGER trg_automatic_weighments_timestamp
  BEFORE UPDATE ON public.automatic_weighments FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

DROP TRIGGER IF EXISTS trg_manual_weighments_timestamp ON public.manual_weighments;
CREATE TRIGGER trg_manual_weighments_timestamp
  BEFORE UPDATE ON public.manual_weighments FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

-- Invalidate user sessions when password, username, role, or deletion status changes
CREATE OR REPLACE FUNCTION public.trigger_invalidate_sessions()
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

DROP TRIGGER IF EXISTS trg_invalidate_sessions ON public.users;
CREATE TRIGGER trg_invalidate_sessions
  AFTER UPDATE OF password_hash, username, role, deleted_at ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.trigger_invalidate_sessions();

-- Enforce cross-tenant isolation and compute/verify weighment metrics
CREATE OR REPLACE FUNCTION public.trigger_weighments_auto_populate()
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

  IF in_rec IS NULL THEN
    RAISE EXCEPTION 'Referenced in_entry (%) or out_entry (%) not found', NEW.in_entry_id, NEW.out_entry_id;
  END IF;

  EXECUTE format(
    'SELECT e.weight, e.vehicle_number, c.factory_id
       FROM public.%I e
       JOIN public.centers c ON c.id = e.center_id
      WHERE e.id = $1',
    entry_table
  ) INTO out_rec USING NEW.out_entry_id;

  IF out_rec IS NULL THEN
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
                 WHEN in_rec.weight > out_rec.weight THEN 'in'::public.weighment_type
                 WHEN in_rec.weight < out_rec.weight THEN 'out'::public.weighment_type
                 ELSE 'void'::public.weighment_type
               END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_automatic_weighments_auto_populate ON public.automatic_weighments;
CREATE TRIGGER trg_automatic_weighments_auto_populate
  BEFORE INSERT OR UPDATE OF in_entry_id, out_entry_id ON public.automatic_weighments
  FOR EACH ROW EXECUTE FUNCTION public.trigger_weighments_auto_populate('automatic_entries');

DROP TRIGGER IF EXISTS trg_manual_weighments_auto_populate ON public.manual_weighments;
CREATE TRIGGER trg_manual_weighments_auto_populate
  BEFORE INSERT OR UPDATE OF in_entry_id, out_entry_id ON public.manual_weighments
  FOR EACH ROW EXECUTE FUNCTION public.trigger_weighments_auto_populate('manual_entries');

-- Non-destructive idempotent backfill from legacy entries & weighments tables (if present)
DO $$
BEGIN
  IF to_regclass('public.entries') IS NOT NULL AND to_regclass('public.weighments') IS NOT NULL THEN
    INSERT INTO public.automatic_entries (
      center_id, vehicle_number, weight, images, idempotency_key, created_at, updated_at, deleted_at
    )
    SELECT
      e.center_id,
      trim(e.vehicle_number),
      e.weight,
      COALESCE(e.images, '{}'::text[]),
      'legacy-entry-' || e.id,
      e.created_at,
      e.updated_at,
      e.deleted_at
    FROM public.entries e
    JOIN public.users u ON u.id = e.created_by
    WHERE u.role::text = 'hardware'
      AND length(trim(e.vehicle_number)) BETWEEN 8 AND 11
      AND e.weight > 0
    ON CONFLICT (idempotency_key) DO NOTHING;

    INSERT INTO public.automatic_weighments (
      in_entry_id, out_entry_id, gross, tare, type, created_at, updated_at, deleted_at
    )
    SELECT
      aie.id,
      aoe.id,
      GREATEST(aie.weight, aoe.weight),
      LEAST(aie.weight, aoe.weight),
      CASE
        WHEN aie.weight > aoe.weight THEN 'in'::public.weighment_type
        WHEN aie.weight < aoe.weight THEN 'out'::public.weighment_type
        ELSE 'void'::public.weighment_type
      END,
      w.created_at,
      w.updated_at,
      w.deleted_at
    FROM public.weighments w
    JOIN public.automatic_entries aie ON aie.idempotency_key = 'legacy-entry-' || w.in_entry_id
    JOIN public.automatic_entries aoe ON aoe.idempotency_key = 'legacy-entry-' || w.out_entry_id
    WHERE aie.id <> aoe.id
      AND NOT EXISTS (
        SELECT 1 FROM public.automatic_weighments aw
        WHERE aw.in_entry_id = aie.id OR aw.out_entry_id = aoe.id
      );

    INSERT INTO public.manual_entries (
      center_id, creator_id, vehicle_number, weight, images, created_at, updated_at, deleted_at
    )
    SELECT
      e.center_id,
      e.created_by,
      trim(e.vehicle_number),
      e.weight,
      COALESCE(e.images, '{}'::text[]),
      e.created_at,
      e.updated_at,
      e.deleted_at
    FROM public.entries e
    JOIN public.users u ON u.id = e.created_by
    WHERE u.role::text <> 'hardware'
      AND length(trim(e.vehicle_number)) BETWEEN 8 AND 11
      AND e.weight > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.manual_entries m
        WHERE m.center_id = e.center_id
          AND m.creator_id = e.created_by
          AND m.vehicle_number = trim(e.vehicle_number)
          AND m.weight = e.weight
          AND m.created_at = e.created_at
      );

    INSERT INTO public.manual_weighments (
      in_entry_id, out_entry_id, gross, tare, type, created_at, updated_at, deleted_at
    )
    SELECT
      mie.id,
      moe.id,
      GREATEST(mie.weight, moe.weight),
      LEAST(mie.weight, moe.weight),
      CASE
        WHEN mie.weight > moe.weight THEN 'in'::public.weighment_type
        WHEN mie.weight < moe.weight THEN 'out'::public.weighment_type
        ELSE 'void'::public.weighment_type
      END,
      w.created_at,
      w.updated_at,
      w.deleted_at
    FROM public.weighments w
    JOIN public.entries lie ON lie.id = w.in_entry_id
    JOIN public.entries loe ON loe.id = w.out_entry_id
    JOIN public.manual_entries mie
      ON mie.center_id = lie.center_id
     AND mie.creator_id = lie.created_by
     AND mie.vehicle_number = trim(lie.vehicle_number)
     AND mie.weight = lie.weight
     AND mie.created_at = lie.created_at
    JOIN public.manual_entries moe
      ON moe.center_id = loe.center_id
     AND moe.creator_id = loe.created_by
     AND moe.vehicle_number = trim(loe.vehicle_number)
     AND moe.weight = loe.weight
     AND moe.created_at = loe.created_at
    WHERE mie.id <> moe.id
      AND NOT EXISTS (
        SELECT 1 FROM public.manual_weighments mw
        WHERE mw.in_entry_id = mie.id OR mw.out_entry_id = moe.id
      );
  END IF;
END $$;

-- Sequence reset procedures for database testing and seed isolation (keeps legacy param signature)
CREATE OR REPLACE FUNCTION public.reset_table_sequence(table_name text)
RETURNS void AS $$
DECLARE
  seq_name text;
  max_id bigint;
BEGIN
  IF to_regclass('public.' || table_name) IS NULL THEN
    RETURN;
  END IF;
  SELECT pg_get_serial_sequence('public.' || table_name, 'id') INTO seq_name;
  IF seq_name IS NOT NULL THEN
    EXECUTE format('SELECT COALESCE(MAX(id), 0) FROM public.%I', table_name) INTO max_id;
    IF max_id = 0 THEN
      EXECUTE format('ALTER SEQUENCE %s RESTART WITH 1', seq_name);
    ELSE
      PERFORM setval(seq_name, max_id, true);
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.reset_all_sequences()
RETURNS void AS $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'factories', 'centers', 'users', 'sessions',
    'automatic_entries', 'manual_entries', 'automatic_weighments', 'manual_weighments',
    'commodities', 'customers', 'rates', 'entries', 'weighments', 'tickets',
    'factory_processed_entries', 'factory_processed_weighments'
  ] LOOP
    PERFORM public.reset_table_sequence(tbl);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Correct vehicle plate on an automatic weighment and its paired entries (one-time)
CREATE OR REPLACE FUNCTION public.correct_automatic_weighment_plate(
  p_weighment_id int,
  p_factory_id int,
  p_vehicle_number text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_weighment RECORD;
BEGIN
  SELECT w.id, w.in_entry_id, w.out_entry_id, w.created_at, w.updated_at
  INTO v_weighment
  FROM public.automatic_weighments w
  JOIN public.automatic_entries ie ON ie.id = w.in_entry_id
  JOIN public.centers ic ON ic.id = ie.center_id
  WHERE w.id = p_weighment_id
    AND w.deleted_at IS NULL
    AND ic.factory_id = p_factory_id
  FOR UPDATE OF w;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Weighment not found';
  END IF;

  IF v_weighment.created_at <> v_weighment.updated_at THEN
    RAISE EXCEPTION 'Weighment has already been updated once';
  END IF;

  UPDATE public.automatic_entries
  SET vehicle_number = p_vehicle_number
  WHERE id IN (v_weighment.in_entry_id, v_weighment.out_entry_id)
    AND deleted_at IS NULL;

  UPDATE public.automatic_weighments
  SET updated_at = now()
  WHERE id = p_weighment_id;
END;
$$;

-- Soft-delete an automatic weighment and its paired entries
CREATE OR REPLACE FUNCTION public.soft_delete_automatic_weighment(
  p_weighment_id int,
  p_factory_id int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_weighment RECORD;
BEGIN
  SELECT w.id, w.in_entry_id, w.out_entry_id
  INTO v_weighment
  FROM public.automatic_weighments w
  JOIN public.automatic_entries ie ON ie.id = w.in_entry_id
  JOIN public.centers ic ON ic.id = ie.center_id
  WHERE w.id = p_weighment_id
    AND w.deleted_at IS NULL
    AND ic.factory_id = p_factory_id
  FOR UPDATE OF w;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Weighment not found';
  END IF;

  UPDATE public.automatic_weighments
  SET deleted_at = now()
  WHERE id = p_weighment_id
    AND deleted_at IS NULL;

  UPDATE public.automatic_entries
  SET deleted_at = now()
  WHERE id IN (v_weighment.in_entry_id, v_weighment.out_entry_id)
    AND deleted_at IS NULL;
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Storage Bucket & Policies Setup (preserves existing buckets such as 'gluvok')
-- Target Bucket: 'mesto'
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('mesto', 'mesto', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Service role bypasses RLS; no policy = anon/authenticated can't list, upload, overwrite or delete.
-- ponytail: bucket stays public so stored photo URLs work; move to signed URLs if photos become sensitive.
DROP POLICY IF EXISTS "Allow read access for mesto bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow insert access for mesto bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow update access for mesto bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete access for mesto bucket" ON storage.objects;

-- ----------------------------------------------------------------------------
-- 8. Access Lockdown. The server uses the service role (bypasses RLS and grants).
-- anon/authenticated (publishable key, Realtime tokens) get nothing in public.
-- Re-run after adding any table or function.
-- ----------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.name);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', r.name);
  END LOOP;
  FOR r IN SELECT viewname AS name FROM pg_views WHERE schemaname = 'public' LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', r.name);
  END LOOP;
  FOR r IN
    SELECT p.oid::regprocedure AS fn FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.fn);
  END LOOP;
END $$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
