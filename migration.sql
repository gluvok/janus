-- Migration: Dedicated Customers Table, Mandatory Staff Credentials, and Rebrand to Mesto

-- 1. Create dedicated customers table
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

-- 2. Populate customers from any existing users with role 'customer'
INSERT INTO customers (id, name, factory_id, created_at, updated_at, deleted_at)
SELECT id, name, factory_id, created_at, updated_at, deleted_at
FROM users
WHERE role = 'customer'
ON CONFLICT (id) DO NOTHING;

-- 3. Update entry foreign keys to reference customers(id)
ALTER TABLE manual_entries DROP CONSTRAINT IF EXISTS manual_entries_customer_id_fkey;
ALTER TABLE manual_entries ADD CONSTRAINT manual_entries_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT;

ALTER TABLE automatic_entries DROP CONSTRAINT IF EXISTS automatic_entries_customer_id_fkey;
ALTER TABLE automatic_entries ADD CONSTRAINT automatic_entries_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT;

-- 4. Delete customer rows from users table and alter credentials to NOT NULL
DELETE FROM users WHERE role = 'customer';

ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_staff_credentials;
ALTER TABLE users ALTER COLUMN username SET NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;

-- 5. Re-create role_enum without 'customer'
-- Note: In existing Postgres instances, role_enum value cannot be removed directly via ALTER TYPE,
-- but clean rebuilds will use the updated role_enum in schema.sql.

-- 6. Enable RLS and policies for customers table
ALTER TABLE IF EXISTS customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow access customers" ON customers;
CREATE POLICY "Allow access customers" ON customers FOR ALL USING (true);

DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers;
CREATE TRIGGER trg_customers_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- 7. Remove legacy commodities table
DROP TABLE IF EXISTS commodities CASCADE;

-- 8. Update reset_all_sequences to include customers and omit commodities
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

-- 9. Rename created_by to creator_id in manual_entries
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'manual_entries' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE manual_entries RENAME COLUMN created_by TO creator_id;
    END IF;
END $$;

DROP INDEX IF EXISTS idx_manual_entries_created_by;
CREATE INDEX IF NOT EXISTS idx_manual_entries_creator_id
ON manual_entries (creator_id)
WHERE deleted_at IS NULL;
