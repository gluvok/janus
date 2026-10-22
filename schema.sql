-- ==============================================================================
-- SUPABASE COMPLETE DATABASE SCHEMA & RLS SETUP
-- Destructive & Idempotent PostgreSQL / Supabase Schema Definition
-- ==============================================================================

-- 0. DESTRUCTIVE CLEANUP (Drop existing tables, types, and views to ensure a fresh schema build)
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS weighments CASCADE;
DROP TABLE IF EXISTS entries CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS rates CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS centers CASCADE;
DROP TABLE IF EXISTS commodities CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS factories CASCADE;

DROP TYPE IF EXISTS ticket_status CASCADE;

DROP TYPE IF EXISTS entry_status CASCADE;
DROP TYPE IF EXISTS weighment_type CASCADE;
DROP TYPE IF EXISTS field_requirement_mode CASCADE;
DROP TYPE IF EXISTS unit_enum CASCADE;
DROP TYPE IF EXISTS role_enum CASCADE;

-- EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. CREATE ENUM TYPES (IF NOT EXISTS)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_enum') THEN
        CREATE TYPE role_enum AS ENUM ('admin', 'manager', 'operator', 'base', 'hardware');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'unit_enum') THEN
        CREATE TYPE unit_enum AS ENUM ('kg', 'q', 'gal');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'weighment_type') THEN
        CREATE TYPE weighment_type AS ENUM ('unassigned', 'in', 'out');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'entry_status') THEN
        CREATE TYPE entry_status AS ENUM ('pending', 'approved', 'rejected');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_status') THEN
        CREATE TYPE ticket_status AS ENUM ('pending', 'approved', 'rejected');
    END IF;
END $$;

-- 2. CREATE TABLES

-- FACTORIES TABLE (Contains factory details and weighment receipt configuration)
CREATE TABLE IF NOT EXISTS factories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    check_center_on_merge BOOLEAN NOT NULL DEFAULT TRUE,
    receipt_images_per_row INT NOT NULL DEFAULT 3,
    camera_crops JSONB NOT NULL DEFAULT '[
      {"camera": 1, "top": 0, "bottom": 0, "left": 0, "right": 0},
      {"camera": 2, "top": 0, "bottom": 0, "left": 0, "right": 0}
    ]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_receipt_images_per_row CHECK (receipt_images_per_row BETWEEN 1 AND 6)
);

-- CENTERS TABLE (Physical collection centers)
CREATE TABLE IF NOT EXISTS centers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    auto_approve BOOLEAN NOT NULL DEFAULT FALSE,
    factory_id INT NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_centers_factory_name
ON centers (factory_id, name)
WHERE deleted_at IS NULL;

-- USERS TABLE (Custom authentication & user entity table, including hardware accounts)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
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

-- SESSIONS TABLE (Server-side user sessions for immediate revocation)
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

-- CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    father_name TEXT NOT NULL,
    user_id INT REFERENCES users(id) ON DELETE RESTRICT,
    factory_id INT REFERENCES factories(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- COMMODITIES TABLE
CREATE TABLE IF NOT EXISTS commodities (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_commodities_name_active
ON commodities (name)
WHERE deleted_at IS NULL;

-- RATES TABLE
CREATE TABLE IF NOT EXISTS rates (
    id SERIAL PRIMARY KEY,
    commodity_id INT NOT NULL REFERENCES commodities(id) ON DELETE RESTRICT,
    unit_price NUMERIC(10, 2) NOT NULL,
    unit unit_enum NOT NULL DEFAULT 'kg',
    factory_id INT NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_rates_price_non_negative CHECK (unit_price >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rates_factory_commodity_unit
ON rates (factory_id, commodity_id, unit)
WHERE deleted_at IS NULL;

-- ENTRIES TABLE (Raw weighment events)
CREATE TABLE IF NOT EXISTS entries (
    id SERIAL PRIMARY KEY,
    detected_vehicle_number TEXT,
    vehicle_number TEXT NOT NULL,
    weight NUMERIC(10, 2) NOT NULL,
    status entry_status NOT NULL DEFAULT 'pending',
    auto_approved BOOLEAN NOT NULL DEFAULT FALSE,
    center_id INT NOT NULL REFERENCES centers(id) ON DELETE RESTRICT,
    customer_id INT REFERENCES customers(id) ON DELETE RESTRICT,
    created_by INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approved_by INT REFERENCES users(id) ON DELETE RESTRICT DEFAULT NULL,
    images TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_entries_weight_positive CHECK (weight > 0)
);

CREATE INDEX IF NOT EXISTS idx_entries_vehicle_status_created 
ON entries (vehicle_number, status, created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_entries_center_created
ON entries (center_id, created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_entries_created
ON entries (created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_entries_created_by
ON entries (created_by)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_entries_approved_by
ON entries (approved_by)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_entries_center
ON entries (center_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_entries_customer
ON entries (customer_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_entries_fifo_approval
ON entries (center_id, vehicle_number, status, created_at ASC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_entries_vehicle_trgm
ON entries USING gin (vehicle_number gin_trgm_ops)
WHERE deleted_at IS NULL;

-- WEIGHMENTS TABLE (Merged double-entry pair)
CREATE TABLE IF NOT EXISTS weighments (
    id SERIAL PRIMARY KEY,
    in_entry_id INT NOT NULL UNIQUE REFERENCES entries(id) ON DELETE RESTRICT,
    out_entry_id INT NOT NULL UNIQUE REFERENCES entries(id) ON DELETE RESTRICT,
    unit unit_enum NOT NULL DEFAULT 'kg',
    type weighment_type NOT NULL DEFAULT 'unassigned',
    rate_id INT REFERENCES rates(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_weighments_distinct_entries CHECK (in_entry_id <> out_entry_id)
);

CREATE INDEX IF NOT EXISTS idx_weighments_created
ON weighments (created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_weighments_rate
ON weighments (rate_id)
WHERE deleted_at IS NULL;

-- TICKETS TABLE (Support tickets linked to either an entry or a weighment)
CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    concern TEXT NOT NULL,
    reply TEXT,
    status ticket_status NOT NULL DEFAULT 'pending',
    entry_id INT REFERENCES entries(id) ON DELETE CASCADE,
    weighment_id INT REFERENCES weighments(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_ticket_link_one_only CHECK (
        (entry_id IS NOT NULL AND weighment_id IS NULL) OR
        (entry_id IS NULL AND weighment_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_tickets_user_status 
ON tickets (user_id, status, created_at DESC) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_entry 
ON tickets (entry_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_weighment 
ON tickets (weighment_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_created_desc
ON tickets (created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_search_trgm
ON tickets USING gin (concern gin_trgm_ops, reply gin_trgm_ops)
WHERE deleted_at IS NULL;

-- INDEXES FOR RATES, CUSTOMERS, CENTERS
CREATE INDEX IF NOT EXISTS idx_rates_factory_commodity
ON rates (factory_id, commodity_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customers_factory
ON customers (factory_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customers_user
ON customers (user_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customers_search_trgm
ON customers USING gin (name gin_trgm_ops, father_name gin_trgm_ops)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_search_trgm
ON users USING gin (name gin_trgm_ops, username gin_trgm_ops)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_centers_factory
ON centers (factory_id)
WHERE deleted_at IS NULL;

-- COMPUTED COLUMNS FOR WEIGHMENTS DERIVED WEIGHTS
DROP FUNCTION IF EXISTS public.gross_weight(weighments);
CREATE OR REPLACE FUNCTION gross_weight(w weighments) 
RETURNS numeric 
LANGUAGE sql 
STABLE PARALLEL SAFE
AS $$
    SELECT GREATEST(e1.weight, e2.weight)
    FROM entries e1, entries e2
    WHERE e1.id = w.in_entry_id AND e2.id = w.out_entry_id;
$$;

DROP FUNCTION IF EXISTS public.tare_weight(weighments);
CREATE OR REPLACE FUNCTION tare_weight(w weighments) 
RETURNS numeric 
LANGUAGE sql 
STABLE PARALLEL SAFE
AS $$
    SELECT LEAST(e1.weight, e2.weight)
    FROM entries e1, entries e2
    WHERE e1.id = w.in_entry_id AND e2.id = w.out_entry_id;
$$;

DROP FUNCTION IF EXISTS public.net_weight(weighments);
CREATE OR REPLACE FUNCTION net_weight(w weighments) 
RETURNS numeric 
LANGUAGE sql 
STABLE PARALLEL SAFE
AS $$
    SELECT ABS(e1.weight - e2.weight)
    FROM entries e1, entries e2
    WHERE e1.id = w.in_entry_id AND e2.id = w.out_entry_id;
$$;

-- 2.1 AUTOMATIC UPDATED_AT TIMESTAMP TRIGGER
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_factories_updated_at ON factories;
CREATE TRIGGER trg_factories_updated_at
BEFORE UPDATE ON factories
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers;
CREATE TRIGGER trg_customers_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS trg_centers_updated_at ON centers;
CREATE TRIGGER trg_centers_updated_at
BEFORE UPDATE ON centers
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS trg_commodities_updated_at ON commodities;
CREATE TRIGGER trg_commodities_updated_at
BEFORE UPDATE ON commodities
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS trg_rates_updated_at ON rates;
CREATE TRIGGER trg_rates_updated_at
BEFORE UPDATE ON rates
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS trg_sessions_updated_at ON sessions;
CREATE TRIGGER trg_sessions_updated_at
BEFORE UPDATE ON sessions
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS trg_entries_updated_at ON entries;
CREATE TRIGGER trg_entries_updated_at
BEFORE UPDATE ON entries
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS trg_weighments_updated_at ON weighments;
CREATE TRIGGER trg_weighments_updated_at
BEFORE UPDATE ON weighments
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

DROP TRIGGER IF EXISTS trg_tickets_updated_at ON tickets;
CREATE TRIGGER trg_tickets_updated_at
BEFORE UPDATE ON tickets
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- 3. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE IF EXISTS factories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS commodities ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS weighments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tickets ENABLE ROW LEVEL SECURITY;

-- 4. THIN RLS POLICIES
DROP POLICY IF EXISTS "Allow access factories" ON factories;
DROP POLICY IF EXISTS "Allow access users" ON users;
DROP POLICY IF EXISTS "Allow access sessions" ON sessions;
DROP POLICY IF EXISTS "Allow access customers" ON customers;
DROP POLICY IF EXISTS "Allow access centers" ON centers;
DROP POLICY IF EXISTS "Allow access commodities" ON commodities;
DROP POLICY IF EXISTS "Allow access rates" ON rates;
DROP POLICY IF EXISTS "Allow access weighments" ON weighments;
DROP POLICY IF EXISTS "Allow access entries" ON entries;
DROP POLICY IF EXISTS "Allow access tickets" ON tickets;

CREATE POLICY "Allow access factories" ON factories FOR ALL USING (true);
CREATE POLICY "Allow access users" ON users FOR ALL USING (true);
CREATE POLICY "Allow access sessions" ON sessions FOR ALL USING (true);
CREATE POLICY "Allow access customers" ON customers FOR ALL USING (true);
CREATE POLICY "Allow access centers" ON centers FOR ALL USING (true);
CREATE POLICY "Allow access commodities" ON commodities FOR ALL USING (true);
CREATE POLICY "Allow access rates" ON rates FOR ALL USING (true);
CREATE POLICY "Allow access weighments" ON weighments FOR ALL USING (true);
CREATE POLICY "Allow access entries" ON entries FOR ALL USING (true);
CREATE POLICY "Allow access tickets" ON tickets FOR ALL USING (true);

-- 5. AUTO-INCREMENT SEQUENCE RESET FUNCTIONS
DROP FUNCTION IF EXISTS public.reset_table_sequence(text);
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

DROP FUNCTION IF EXISTS public.reset_all_sequences();
CREATE OR REPLACE FUNCTION reset_all_sequences()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    t text;
    tbls text[] := ARRAY['tickets', 'weighments', 'entries', 'sessions', 'rates', 'customers', 'commodities', 'centers', 'users', 'factories'];
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

-- 6. ATOMIC TRANSACTION RPC FUNCTIONS FOR CUSTOMERS & USERS

DROP FUNCTION IF EXISTS public.create_customer_with_user(TEXT, TEXT, INT, TEXT, TEXT, INT);
DROP FUNCTION IF EXISTS public.create_customer_with_user(INT, TEXT, TEXT, INT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_customer_with_user(INT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION create_customer_with_user(
    p_factory_id INT,
    p_name TEXT,
    p_father_name TEXT,
    p_username TEXT DEFAULT NULL,
    p_password_hash TEXT DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id INT := NULL;
    v_customer_id INT;
    v_result JSON;
BEGIN
    IF p_username IS NOT NULL AND p_password_hash IS NOT NULL THEN
        INSERT INTO users (username, password_hash, name, role, factory_id)
        VALUES (p_username, p_password_hash, p_name, 'base', p_factory_id)
        RETURNING id INTO v_user_id;
    END IF;

    INSERT INTO customers (name, father_name, user_id, factory_id)
    VALUES (p_name, p_father_name, v_user_id, p_factory_id)
    RETURNING id INTO v_customer_id;

    SELECT row_to_json(c) INTO v_result
    FROM (
        SELECT 
            cust.*,
            CASE WHEN u.id IS NOT NULL THEN
                json_build_object('username', u.username)
            ELSE NULL END AS users
        FROM customers cust
        LEFT JOIN users u ON cust.user_id = u.id AND u.deleted_at IS NULL
        WHERE cust.id = v_customer_id
    ) c;

    RETURN v_result;
END;
$$;

DROP FUNCTION IF EXISTS public.update_customer_with_user(INT, INT, TEXT, TEXT, INT, TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.update_customer_with_user(INT, INT, TEXT, TEXT, INT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.update_customer_with_user(INT, INT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION update_customer_with_user(
    p_customer_id INT,
    p_factory_id INT,
    p_name TEXT DEFAULT NULL,
    p_father_name TEXT DEFAULT NULL,
    p_username TEXT DEFAULT NULL,
    p_password_hash TEXT DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id INT;
    v_result JSON;
BEGIN
    SELECT user_id INTO v_user_id
    FROM customers
    WHERE id = p_customer_id AND factory_id = p_factory_id AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    UPDATE customers
    SET 
        name = COALESCE(p_name, name),
        father_name = COALESCE(p_father_name, father_name),
        updated_at = NOW()
    WHERE id = p_customer_id AND factory_id = p_factory_id AND deleted_at IS NULL;

    IF v_user_id IS NOT NULL THEN
        UPDATE users
        SET 
            name = COALESCE(p_name, name),
            username = COALESCE(p_username, username),
            password_hash = COALESCE(p_password_hash, password_hash),
            updated_at = NOW()
        WHERE id = v_user_id AND deleted_at IS NULL;

        IF p_password_hash IS NOT NULL THEN
            UPDATE sessions
            SET deleted_at = NOW(), updated_at = NOW()
            WHERE user_id = v_user_id AND deleted_at IS NULL;
        END IF;
    ELSIF p_username IS NOT NULL AND p_password_hash IS NOT NULL THEN
        INSERT INTO users (username, password_hash, name, role, factory_id)
        VALUES (p_username, p_password_hash, COALESCE(p_name, (SELECT name FROM customers WHERE id = p_customer_id)), 'base', p_factory_id)
        RETURNING id INTO v_user_id;

        UPDATE customers
        SET user_id = v_user_id
        WHERE id = p_customer_id AND deleted_at IS NULL;
    END IF;

    SELECT row_to_json(c) INTO v_result
    FROM (
        SELECT 
            cust.*,
            CASE WHEN u.id IS NOT NULL THEN
                json_build_object('username', u.username)
            ELSE NULL END AS users
        FROM customers cust
        LEFT JOIN users u ON cust.user_id = u.id AND u.deleted_at IS NULL
        WHERE cust.id = p_customer_id AND cust.deleted_at IS NULL
    ) c;

    RETURN v_result;
END;
$$;

DROP FUNCTION IF EXISTS public.delete_customers_with_user(INT[], INT);

CREATE OR REPLACE FUNCTION delete_customers_with_user(
    p_customer_ids INT[],
    p_factory_id INT
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_ids INT[];
    v_deleted_count INT;
BEGIN
    SELECT ARRAY_AGG(user_id) INTO v_user_ids
    FROM customers
    WHERE id = ANY(p_customer_ids) AND factory_id = p_factory_id AND user_id IS NOT NULL AND deleted_at IS NULL;

    UPDATE customers
    SET deleted_at = NOW(), updated_at = NOW()
    WHERE id = ANY(p_customer_ids) AND factory_id = p_factory_id AND deleted_at IS NULL;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    IF v_user_ids IS NOT NULL AND array_length(v_user_ids, 1) > 0 THEN
        UPDATE users
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = ANY(v_user_ids) AND deleted_at IS NULL;
    END IF;

    RETURN v_deleted_count;
END;
$$;

-- 7. SESSION INVALIDATION TRIGGER (Instant revocation on password change or user deactivation)
CREATE OR REPLACE FUNCTION trigger_invalidate_sessions_on_user_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Soft-delete active sessions when password changes, username changes, OR user is soft deleted / deactivated
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

DROP TRIGGER IF EXISTS trg_invalidate_sessions_on_user_update ON users;
CREATE TRIGGER trg_invalidate_sessions_on_user_update
AFTER UPDATE OF password_hash, deleted_at, username ON users
FOR EACH ROW
EXECUTE FUNCTION trigger_invalidate_sessions_on_user_update();

-- 8. NOTIFY SUPABASE POSTGREST TO RELOAD SCHEMA CACHE IMMEDIATELY
NOTIFY pgrst, 'reload schema';

