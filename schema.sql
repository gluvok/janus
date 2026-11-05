-- ==============================================================================
-- SUPABASE COMPLETE DESTRUCTIVE SETUP: SCHEMA + STORAGE BUCKET & POLICIES
-- ==============================================================================

-- ==============================================================================
-- PART 1: TOTALLY DESTRUCTIVE SCHEMA REBUILD
-- ==============================================================================

-- 0. TOTALLY DESTRUCTIVE CLEANUP
DROP FUNCTION IF EXISTS public.gross_weight(manual_weighments) CASCADE;
DROP FUNCTION IF EXISTS public.tare_weight(manual_weighments) CASCADE;
DROP FUNCTION IF EXISTS public.net_weight(manual_weighments) CASCADE;
DROP FUNCTION IF EXISTS public.gross_weight(automatic_weighments) CASCADE;
DROP FUNCTION IF EXISTS public.tare_weight(automatic_weighments) CASCADE;
DROP FUNCTION IF EXISTS public.net_weight(automatic_weighments) CASCADE;
DROP FUNCTION IF EXISTS public.gross_weight(weighments) CASCADE;
DROP FUNCTION IF EXISTS public.tare_weight(weighments) CASCADE;
DROP FUNCTION IF EXISTS public.net_weight(weighments) CASCADE;
DROP FUNCTION IF EXISTS public.trigger_set_timestamp() CASCADE;
DROP FUNCTION IF EXISTS public.reset_table_sequence(text) CASCADE;
DROP FUNCTION IF EXISTS public.reset_all_sequences() CASCADE;
DROP FUNCTION IF EXISTS public.trigger_invalidate_sessions_on_user_update() CASCADE;

DROP EXTENSION IF EXISTS pg_trgm CASCADE;

DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS automatic_weighments CASCADE;
DROP TABLE IF EXISTS manual_weighments CASCADE;
DROP TABLE IF EXISTS weighments CASCADE;
DROP TABLE IF EXISTS automatic_entries CASCADE;
DROP TABLE IF EXISTS manual_entries CASCADE;
DROP TABLE IF EXISTS entries CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS centers CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS factories CASCADE;

DROP TYPE IF EXISTS ticket_status CASCADE;
DROP TYPE IF EXISTS weighment_type CASCADE;
DROP TYPE IF EXISTS field_requirement_mode CASCADE;
DROP TYPE IF EXISTS unit_enum CASCADE;
DROP TYPE IF EXISTS role_enum CASCADE;

DROP SEQUENCE IF EXISTS tickets_id_seq CASCADE;
DROP SEQUENCE IF EXISTS automatic_weighments_id_seq CASCADE;
DROP SEQUENCE IF EXISTS manual_weighments_id_seq CASCADE;
DROP SEQUENCE IF EXISTS weighments_id_seq CASCADE;
DROP SEQUENCE IF EXISTS automatic_entries_id_seq CASCADE;
DROP SEQUENCE IF EXISTS manual_entries_id_seq CASCADE;
DROP SEQUENCE IF EXISTS entries_id_seq CASCADE;
DROP SEQUENCE IF EXISTS devices_id_seq CASCADE;
DROP SEQUENCE IF EXISTS sessions_id_seq CASCADE;
DROP SEQUENCE IF EXISTS customers_id_seq CASCADE;
DROP SEQUENCE IF EXISTS centers_id_seq CASCADE;
DROP SEQUENCE IF EXISTS users_id_seq CASCADE;
DROP SEQUENCE IF EXISTS factories_id_seq CASCADE;

-- ==============================================================================
-- 1. EXTENSIONS & TYPES
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_enum') THEN
        CREATE TYPE role_enum AS ENUM ('admin', 'manager', 'operator', 'base');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'weighment_type') THEN
        CREATE TYPE weighment_type AS ENUM ('pending', 'in', 'out', 'unassigned');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_status') THEN
        CREATE TYPE ticket_status AS ENUM ('pending', 'approved', 'rejected');
    END IF;
END $$;

-- ==============================================================================
-- 2. CREATE TABLES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS factories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    receipt_images_per_row INT NOT NULL DEFAULT 3,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_receipt_images_per_row CHECK (receipt_images_per_row BETWEEN 1 AND 6)
);

CREATE TABLE IF NOT EXISTS centers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    factory_id INT NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
    api_key TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_centers_factory_name
ON centers (factory_id, name);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role role_enum NOT NULL DEFAULT 'base',
    factory_id INT NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username 
ON users (username);

CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions (token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

-- ------------------------------------------------------------------------------
-- AUTOMATIC WEIGHMENTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS automatic_weighments (
    id SERIAL PRIMARY KEY,
    vehicle_number TEXT NOT NULL,
    in_detected_vehicle_number TEXT,
    out_detected_vehicle_number TEXT,
    in_weight NUMERIC(10, 2) NOT NULL,
    out_weight NUMERIC(10, 2),
    in_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    out_time TIMESTAMPTZ,
    in_center_id INT NOT NULL REFERENCES centers(id) ON DELETE RESTRICT,
    out_center_id INT REFERENCES centers(id) ON DELETE RESTRICT,
    images TEXT[] NOT NULL DEFAULT '{}',
    gross NUMERIC(10, 2) GENERATED ALWAYS AS (
        CASE
            WHEN out_weight IS NULL THEN in_weight
            ELSE GREATEST(in_weight, out_weight)
        END
    ) STORED,
    tare NUMERIC(10, 2) GENERATED ALWAYS AS (
        CASE
            WHEN out_weight IS NULL THEN NULL
            ELSE LEAST(in_weight, out_weight)
        END
    ) STORED,
    net NUMERIC(10, 2) GENERATED ALWAYS AS (
        CASE
            WHEN out_weight IS NULL THEN NULL
            ELSE ABS(in_weight - out_weight)
        END
    ) STORED,
    type weighment_type GENERATED ALWAYS AS (
        CASE
            WHEN out_weight IS NULL THEN 'pending'::weighment_type
            WHEN in_weight > out_weight THEN 'in'::weighment_type
            WHEN in_weight < out_weight THEN 'out'::weighment_type
            ELSE 'unassigned'::weighment_type
        END
    ) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_automatic_weighments_in_weight_positive CHECK (in_weight > 0),
    CONSTRAINT chk_automatic_weighments_out_weight_positive CHECK (out_weight IS NULL OR out_weight > 0)
);

CREATE INDEX IF NOT EXISTS idx_automatic_weighments_vehicle
ON automatic_weighments (vehicle_number, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automatic_weighments_created
ON automatic_weighments (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automatic_weighments_in_center
ON automatic_weighments (in_center_id);

CREATE INDEX IF NOT EXISTS idx_automatic_weighments_out_center
ON automatic_weighments (out_center_id);

CREATE INDEX IF NOT EXISTS idx_automatic_weighments_type
ON automatic_weighments (type);

CREATE INDEX IF NOT EXISTS idx_automatic_weighments_vehicle_trgm
ON automatic_weighments USING gin (vehicle_number gin_trgm_ops);

-- ------------------------------------------------------------------------------
-- MANUAL WEIGHMENTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS manual_weighments (
    id SERIAL PRIMARY KEY,
    vehicle_number TEXT NOT NULL,
    in_weight NUMERIC(10, 2) NOT NULL,
    out_weight NUMERIC(10, 2),
    in_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    out_time TIMESTAMPTZ,
    in_center_id INT NOT NULL REFERENCES centers(id) ON DELETE RESTRICT,
    out_center_id INT REFERENCES centers(id) ON DELETE RESTRICT,
    in_creator_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    out_creator_id INT REFERENCES users(id) ON DELETE RESTRICT,
    images TEXT[] NOT NULL DEFAULT '{}',
    gross NUMERIC(10, 2) GENERATED ALWAYS AS (
        CASE
            WHEN out_weight IS NULL THEN in_weight
            ELSE GREATEST(in_weight, out_weight)
        END
    ) STORED,
    tare NUMERIC(10, 2) GENERATED ALWAYS AS (
        CASE
            WHEN out_weight IS NULL THEN NULL
            ELSE LEAST(in_weight, out_weight)
        END
    ) STORED,
    net NUMERIC(10, 2) GENERATED ALWAYS AS (
        CASE
            WHEN out_weight IS NULL THEN NULL
            ELSE ABS(in_weight - out_weight)
        END
    ) STORED,
    type weighment_type GENERATED ALWAYS AS (
        CASE
            WHEN out_weight IS NULL THEN 'pending'::weighment_type
            WHEN in_weight > out_weight THEN 'in'::weighment_type
            WHEN in_weight < out_weight THEN 'out'::weighment_type
            ELSE 'unassigned'::weighment_type
        END
    ) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_manual_weighments_in_weight_positive CHECK (in_weight > 0),
    CONSTRAINT chk_manual_weighments_out_weight_positive CHECK (out_weight IS NULL OR out_weight > 0)
);

CREATE INDEX IF NOT EXISTS idx_manual_weighments_vehicle
ON manual_weighments (vehicle_number, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_manual_weighments_created
ON manual_weighments (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_manual_weighments_in_center
ON manual_weighments (in_center_id);

CREATE INDEX IF NOT EXISTS idx_manual_weighments_out_center
ON manual_weighments (out_center_id);

CREATE INDEX IF NOT EXISTS idx_manual_weighments_in_creator
ON manual_weighments (in_creator_id);

CREATE INDEX IF NOT EXISTS idx_manual_weighments_out_creator
ON manual_weighments (out_creator_id);

CREATE INDEX IF NOT EXISTS idx_manual_weighments_type
ON manual_weighments (type);

CREATE INDEX IF NOT EXISTS idx_manual_weighments_vehicle_trgm
ON manual_weighments USING gin (vehicle_number gin_trgm_ops);

-- ------------------------------------------------------------------------------
-- TICKETS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    concern TEXT NOT NULL,
    reply TEXT,
    status ticket_status NOT NULL DEFAULT 'pending',
    weighment_id INT NOT NULL REFERENCES automatic_weighments(id) ON DELETE RESTRICT,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_user_status 
ON tickets (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tickets_weighment 
ON tickets (weighment_id);

CREATE INDEX IF NOT EXISTS idx_tickets_created_desc
ON tickets (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tickets_search_trgm
ON tickets USING gin (concern gin_trgm_ops, reply gin_trgm_ops);

-- Common indexes
CREATE INDEX IF NOT EXISTS idx_users_search_trgm
ON users USING gin (name gin_trgm_ops, username gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_centers_factory
ON centers (factory_id);

-- ==============================================================================
-- UPDATED_AT TRIGGER FUNCTION & TRIGGERS
-- ==============================================================================
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_factories_updated_at
BEFORE UPDATE ON factories
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER trg_centers_updated_at
BEFORE UPDATE ON centers
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER trg_sessions_updated_at
BEFORE UPDATE ON sessions
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER trg_automatic_weighments_updated_at
BEFORE UPDATE ON automatic_weighments
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER trg_manual_weighments_updated_at
BEFORE UPDATE ON manual_weighments
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER trg_tickets_updated_at
BEFORE UPDATE ON tickets
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- ==============================================================================
-- ENABLE RLS & POLICIES
-- ==============================================================================
ALTER TABLE IF EXISTS factories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS automatic_weighments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS manual_weighments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow access factories" ON factories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow access users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow access sessions" ON sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow access centers" ON centers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow access automatic_weighments" ON automatic_weighments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow access manual_weighments" ON manual_weighments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow access tickets" ON tickets FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- SEQUENCE RESET FUNCTIONS
-- ==============================================================================
CREATE OR REPLACE FUNCTION reset_table_sequence(table_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    seq_name text;
BEGIN
    seq_name := pg_get_serial_sequence(table_name, 'id');
    IF seq_name IS NOT NULL THEN
        PERFORM setval(seq_name, 1, false);
    ELSE
        EXECUTE format('ALTER SEQUENCE IF EXISTS %I_id_seq RESTART WITH 1', table_name);
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION reset_all_sequences()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    t text;
    tbls text[] := ARRAY[
        'tickets',
        'automatic_weighments',
        'manual_weighments',
        'sessions',
        'centers',
        'users',
        'factories'
    ];
    seq_name text;
BEGIN
    FOREACH t IN ARRAY tbls LOOP
        seq_name := pg_get_serial_sequence(t, 'id');
        IF seq_name IS NOT NULL THEN
            PERFORM setval(seq_name, 1, false);
        ELSE
            EXECUTE format('ALTER SEQUENCE IF EXISTS %I_id_seq RESTART WITH 1', t);
        END IF;
    END LOOP;
END;
$$;

-- ==============================================================================
-- SESSION INVALIDATION TRIGGER
-- ==============================================================================
CREATE OR REPLACE FUNCTION trigger_invalidate_sessions_on_user_update()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.password_hash <> OLD.password_hash)
       OR (NEW.username <> OLD.username) THEN
        DELETE FROM sessions WHERE user_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_invalidate_sessions_on_user_update
AFTER UPDATE OF password_hash, username ON users
FOR EACH ROW
EXECUTE FUNCTION trigger_invalidate_sessions_on_user_update();

-- NOTIFY POSTGREST TO RELOAD SCHEMA
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- PART 2: STORAGE BUCKET & POLICIES SETUP
-- Target Bucket: 'mesto'
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('mesto', 'mesto', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public Read Access for mesto bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Read Access for mesto bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow read access for mesto bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public Insert Access for mesto bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Insert Access for mesto bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow insert access for mesto bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public Update Access for mesto bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update Access for mesto bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow update access for mesto bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete Access for mesto bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete Access for mesto bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete access for mesto bucket" ON storage.objects;

CREATE POLICY "Allow insert access for mesto bucket"
ON storage.objects FOR INSERT TO authenticated, service_role
WITH CHECK (
    bucket_id = 'mesto' AND
    name ~ '^[0-9]+/[^/]+$'
);

CREATE POLICY "Allow update access for mesto bucket"
ON storage.objects FOR UPDATE TO authenticated, service_role
USING (bucket_id = 'mesto')
WITH CHECK (bucket_id = 'mesto');

CREATE POLICY "Allow delete access for mesto bucket"
ON storage.objects FOR DELETE TO authenticated, service_role
USING (bucket_id = 'mesto');
