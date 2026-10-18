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
