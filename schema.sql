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

DROP TABLE IF EXISTS automatic_tickets CASCADE;
DROP TABLE IF EXISTS manual_tickets CASCADE;
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

DROP SEQUENCE IF EXISTS automatic_tickets_id_seq CASCADE;
DROP SEQUENCE IF EXISTS manual_tickets_id_seq CASCADE;
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
        CREATE TYPE weighment_type AS ENUM ('in', 'out');
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
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_receipt_images_per_row CHECK (receipt_images_per_row BETWEEN 1 AND 6)
);

CREATE TABLE IF NOT EXISTS centers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    factory_id INT NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_centers_factory_name
ON centers (factory_id, name)
WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    factory_id INT NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_factory_name
ON customers (factory_id, name)
WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role role_enum NOT NULL DEFAULT 'base',
    factory_id INT NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_active 
ON users (username) 
WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS devices (
    id SERIAL PRIMARY KEY,
    center_id INT NOT NULL REFERENCES centers(id) ON DELETE RESTRICT,
    api_key_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_center_active
ON devices (center_id)
WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions (token) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at) WHERE deleted_at IS NULL;

-- ------------------------------------------------------------------------------
-- MANUAL ENTRIES (Operator-Created)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS manual_entries (
    id SERIAL PRIMARY KEY,
    vehicle_number TEXT NOT NULL,
    weight NUMERIC(10, 2) NOT NULL,
    center_id INT NOT NULL REFERENCES centers(id) ON DELETE RESTRICT,
    customer_id INT REFERENCES customers(id) ON DELETE RESTRICT,
    creator_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    images TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_manual_entries_weight_positive CHECK (weight > 0)
);

CREATE INDEX IF NOT EXISTS idx_manual_entries_center_vehicle 
ON manual_entries (center_id, vehicle_number, created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_manual_entries_created_at
ON manual_entries (created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_manual_entries_creator_id
ON manual_entries (creator_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_manual_entries_center
ON manual_entries (center_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_manual_entries_customer
ON manual_entries (customer_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_manual_entries_vehicle_trgm
ON manual_entries USING gin (vehicle_number gin_trgm_ops)
WHERE deleted_at IS NULL;

-- ------------------------------------------------------------------------------
-- AUTOMATIC ENTRIES (Hardware-Captured)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS automatic_entries (
    id SERIAL PRIMARY KEY,
    device_id INT NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
    center_id INT NOT NULL REFERENCES centers(id) ON DELETE RESTRICT,
    customer_id INT REFERENCES customers(id) ON DELETE RESTRICT,
    detected_vehicle_number TEXT,
    vehicle_number TEXT NOT NULL,
    weight NUMERIC(10, 2) NOT NULL,
    images TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_automatic_entries_weight_positive CHECK (weight > 0)
);

CREATE INDEX IF NOT EXISTS idx_automatic_entries_device
ON automatic_entries (device_id, created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_automatic_entries_center_created
ON automatic_entries (center_id, created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_automatic_entries_vehicle
ON automatic_entries (vehicle_number, created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_automatic_entries_customer
ON automatic_entries (customer_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_automatic_entries_vehicle_trgm
ON automatic_entries USING gin (vehicle_number gin_trgm_ops)
WHERE deleted_at IS NULL;

-- ------------------------------------------------------------------------------
-- MANUAL WEIGHMENTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS manual_weighments (
    id SERIAL PRIMARY KEY,
    in_entry_id INT NOT NULL UNIQUE REFERENCES manual_entries(id) ON DELETE RESTRICT,
    out_entry_id INT NOT NULL UNIQUE REFERENCES manual_entries(id) ON DELETE RESTRICT,
    type weighment_type NOT NULL DEFAULT 'in',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_manual_weighments_distinct_entries CHECK (in_entry_id <> out_entry_id)
);

CREATE INDEX IF NOT EXISTS idx_manual_weighments_created
ON manual_weighments (created_at DESC)
WHERE deleted_at IS NULL;

-- ------------------------------------------------------------------------------
-- AUTOMATIC WEIGHMENTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS automatic_weighments (
    id SERIAL PRIMARY KEY,
    in_entry_id INT NOT NULL UNIQUE REFERENCES automatic_entries(id) ON DELETE RESTRICT,
    out_entry_id INT NOT NULL UNIQUE REFERENCES automatic_entries(id) ON DELETE RESTRICT,
    type weighment_type NOT NULL DEFAULT 'in',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_automatic_weighments_distinct_entries CHECK (in_entry_id <> out_entry_id)
);

CREATE INDEX IF NOT EXISTS idx_automatic_weighments_created
ON automatic_weighments (created_at DESC)
WHERE deleted_at IS NULL;

-- ------------------------------------------------------------------------------
-- MANUAL TICKETS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS manual_tickets (
    id SERIAL PRIMARY KEY,
    concern TEXT NOT NULL,
    reply TEXT,
    status ticket_status NOT NULL DEFAULT 'pending',
    entry_id INT REFERENCES manual_entries(id) ON DELETE CASCADE,
    weighment_id INT REFERENCES manual_weighments(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_manual_ticket_link_one_only CHECK (
        (entry_id IS NOT NULL AND weighment_id IS NULL) OR
        (entry_id IS NULL AND weighment_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_manual_tickets_user_status 
ON manual_tickets (user_id, status, created_at DESC) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_manual_tickets_entry 
ON manual_tickets (entry_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_manual_tickets_weighment 
ON manual_tickets (weighment_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_manual_tickets_created_desc
ON manual_tickets (created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_manual_tickets_search_trgm
ON manual_tickets USING gin (concern gin_trgm_ops, reply gin_trgm_ops)
WHERE deleted_at IS NULL;

-- ------------------------------------------------------------------------------
-- AUTOMATIC TICKETS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS automatic_tickets (
    id SERIAL PRIMARY KEY,
    concern TEXT NOT NULL,
    reply TEXT,
    status ticket_status NOT NULL DEFAULT 'pending',
    entry_id INT REFERENCES automatic_entries(id) ON DELETE CASCADE,
    weighment_id INT REFERENCES automatic_weighments(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    device_id INT REFERENCES devices(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_automatic_ticket_link_one_only CHECK (
        (entry_id IS NOT NULL AND weighment_id IS NULL) OR
        (entry_id IS NULL AND weighment_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_automatic_tickets_user_status 
ON automatic_tickets (user_id, status, created_at DESC) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_automatic_tickets_device
ON automatic_tickets (device_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_automatic_tickets_entry 
ON automatic_tickets (entry_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_automatic_tickets_weighment 
ON automatic_tickets (weighment_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_automatic_tickets_created_desc
ON automatic_tickets (created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_automatic_tickets_search_trgm
ON automatic_tickets USING gin (concern gin_trgm_ops, reply gin_trgm_ops)
WHERE deleted_at IS NULL;

-- Common indexes
CREATE INDEX IF NOT EXISTS idx_users_search_trgm
ON users USING gin (name gin_trgm_ops, username gin_trgm_ops)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_centers_factory
ON centers (factory_id)
WHERE deleted_at IS NULL;

-- ==============================================================================
-- COMPUTED COLUMNS FOR WEIGHMENTS
-- ==============================================================================

-- Manual weighments computed functions
CREATE OR REPLACE FUNCTION gross_weight(w manual_weighments) 
RETURNS numeric 
LANGUAGE sql 
STABLE PARALLEL SAFE
AS $$
    SELECT GREATEST(e1.weight, e2.weight)
    FROM manual_entries e1, manual_entries e2
    WHERE e1.id = w.in_entry_id AND e2.id = w.out_entry_id;
$$;

CREATE OR REPLACE FUNCTION tare_weight(w manual_weighments) 
RETURNS numeric 
LANGUAGE sql 
STABLE PARALLEL SAFE
AS $$
    SELECT LEAST(e1.weight, e2.weight)
    FROM manual_entries e1, manual_entries e2
    WHERE e1.id = w.in_entry_id AND e2.id = w.out_entry_id;
$$;

CREATE OR REPLACE FUNCTION net_weight(w manual_weighments) 
RETURNS numeric 
LANGUAGE sql 
STABLE PARALLEL SAFE
AS $$
    SELECT ABS(e1.weight - e2.weight)
    FROM manual_entries e1, manual_entries e2
    WHERE e1.id = w.in_entry_id AND e2.id = w.out_entry_id;
$$;

-- Automatic weighments computed functions
CREATE OR REPLACE FUNCTION gross_weight(w automatic_weighments) 
RETURNS numeric 
LANGUAGE sql 
STABLE PARALLEL SAFE
AS $$
    SELECT GREATEST(e1.weight, e2.weight)
    FROM automatic_entries e1, automatic_entries e2
    WHERE e1.id = w.in_entry_id AND e2.id = w.out_entry_id;
$$;

CREATE OR REPLACE FUNCTION tare_weight(w automatic_weighments) 
RETURNS numeric 
LANGUAGE sql 
STABLE PARALLEL SAFE
AS $$
    SELECT LEAST(e1.weight, e2.weight)
    FROM automatic_entries e1, automatic_entries e2
    WHERE e1.id = w.in_entry_id AND e2.id = w.out_entry_id;
$$;

CREATE OR REPLACE FUNCTION net_weight(w automatic_weighments) 
RETURNS numeric 
LANGUAGE sql 
STABLE PARALLEL SAFE
AS $$
    SELECT ABS(e1.weight - e2.weight)
    FROM automatic_entries e1, automatic_entries e2
    WHERE e1.id = w.in_entry_id AND e2.id = w.out_entry_id;
$$;

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

CREATE TRIGGER trg_devices_updated_at
BEFORE UPDATE ON devices
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER trg_centers_updated_at
BEFORE UPDATE ON centers
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER trg_customers_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER trg_sessions_updated_at
BEFORE UPDATE ON sessions
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER trg_manual_entries_updated_at
BEFORE UPDATE ON manual_entries
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER trg_automatic_entries_updated_at
BEFORE UPDATE ON automatic_entries
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER trg_manual_weighments_updated_at
BEFORE UPDATE ON manual_weighments
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER trg_automatic_weighments_updated_at
BEFORE UPDATE ON automatic_weighments
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER trg_manual_tickets_updated_at
BEFORE UPDATE ON manual_tickets
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER trg_automatic_tickets_updated_at
BEFORE UPDATE ON automatic_tickets
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- ==============================================================================
-- ENABLE RLS & POLICIES
-- ==============================================================================
ALTER TABLE IF EXISTS factories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS manual_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS automatic_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS manual_weighments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS automatic_weighments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS manual_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS automatic_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow access factories" ON factories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow access users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow access devices" ON devices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow access sessions" ON sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow access centers" ON centers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow access customers" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow access manual_entries" ON manual_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow access automatic_entries" ON automatic_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow access manual_weighments" ON manual_weighments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow access automatic_weighments" ON automatic_weighments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow access manual_tickets" ON manual_tickets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow access automatic_tickets" ON automatic_tickets FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- SEQUENCE RESET FUNCTIONS
-- ==============================================================================
CREATE OR REPLACE FUNCTION reset_table_sequence(table_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARe
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
        'automatic_tickets',
        'manual_tickets',
        'automatic_weighments',
        'manual_weighments',
        'automatic_entries',
        'manual_entries',
        'devices',
        'sessions',
        'customers',
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
       OR (NEW.username <> OLD.username)
       OR (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL) THEN
        UPDATE sessions
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE user_id = NEW.id AND deleted_at IS NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_invalidate_sessions_on_user_update
AFTER UPDATE OF password_hash, deleted_at, username ON users
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