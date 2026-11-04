-- ==============================================================================
-- LIBSQL / SQLITE COMPLETE SCHEMA DEFINITION
-- Clean DDL with relational integrity (FOREIGN KEY ... ON DELETE RESTRICT)
-- RPC functions, triggers, and PG extensions removed for Drizzle / Turso runtime
-- ==============================================================================

PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------------------------
-- 1. FACTORIES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS factories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    receipt_images_per_row INTEGER NOT NULL DEFAULT 3 CHECK (receipt_images_per_row BETWEEN 1 AND 6),
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- ------------------------------------------------------------------------------
-- 2. CENTERS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS centers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    factory_id INTEGER NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_centers_factory_name
ON centers (factory_id, name);

CREATE INDEX IF NOT EXISTS idx_centers_factory
ON centers (factory_id);

-- ------------------------------------------------------------------------------
-- 3. CUSTOMERS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    factory_id INTEGER NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_factory_name
ON customers (factory_id, name);

CREATE INDEX IF NOT EXISTS idx_customers_factory
ON customers (factory_id);

-- ------------------------------------------------------------------------------
-- 4. USERS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'base' CHECK (role IN ('admin', 'manager', 'operator', 'base')),
    factory_id INTEGER NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username
ON users (username);

CREATE INDEX IF NOT EXISTS idx_users_factory
ON users (factory_id);

CREATE INDEX IF NOT EXISTS idx_users_role
ON users (role);

-- ------------------------------------------------------------------------------
-- 5. DEVICES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    center_id INTEGER NOT NULL UNIQUE REFERENCES centers(id) ON DELETE RESTRICT,
    api_key_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_center
ON devices (center_id);

-- ------------------------------------------------------------------------------
-- 6. SESSIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions (token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

-- ------------------------------------------------------------------------------
-- 7. MANUAL ENTRIES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS manual_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_number TEXT NOT NULL,
    weight REAL NOT NULL CHECK (weight > 0),
    center_id INTEGER NOT NULL REFERENCES centers(id) ON DELETE RESTRICT,
    customer_id INTEGER REFERENCES customers(id) ON DELETE RESTRICT,
    creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    images TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_manual_entries_center_vehicle
ON manual_entries (center_id, vehicle_number, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_manual_entries_created_at
ON manual_entries (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_manual_entries_creator_id
ON manual_entries (creator_id);

CREATE INDEX IF NOT EXISTS idx_manual_entries_center
ON manual_entries (center_id);

CREATE INDEX IF NOT EXISTS idx_manual_entries_customer
ON manual_entries (customer_id);

CREATE INDEX IF NOT EXISTS idx_manual_entries_vehicle
ON manual_entries (vehicle_number);

-- ------------------------------------------------------------------------------
-- 8. AUTOMATIC ENTRIES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS automatic_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
    center_id INTEGER NOT NULL REFERENCES centers(id) ON DELETE RESTRICT,
    customer_id INTEGER REFERENCES customers(id) ON DELETE RESTRICT,
    detected_vehicle_number TEXT NOT NULL DEFAULT 'NO_PLATE_DETECTED',
    vehicle_number TEXT NOT NULL DEFAULT 'NO_PLATE_DETECTED',
    weight REAL NOT NULL CHECK (weight > 0),
    images TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_automatic_entries_device
ON automatic_entries (device_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automatic_entries_center_created
ON automatic_entries (center_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automatic_entries_vehicle
ON automatic_entries (vehicle_number, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automatic_entries_customer
ON automatic_entries (customer_id);

-- ------------------------------------------------------------------------------
-- 9. MANUAL WEIGHMENTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS manual_weighments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    in_entry_id INTEGER NOT NULL UNIQUE REFERENCES manual_entries(id) ON DELETE RESTRICT,
    out_entry_id INTEGER NOT NULL UNIQUE REFERENCES manual_entries(id) ON DELETE RESTRICT,
    type TEXT NOT NULL DEFAULT 'in' CHECK (type IN ('in', 'out')),
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    CHECK (in_entry_id <> out_entry_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_manual_weighments_in_entry
ON manual_weighments (in_entry_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_manual_weighments_out_entry
ON manual_weighments (out_entry_id);

CREATE INDEX IF NOT EXISTS idx_manual_weighments_created
ON manual_weighments (created_at DESC);

-- ------------------------------------------------------------------------------
-- 10. AUTOMATIC WEIGHMENTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS automatic_weighments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    in_entry_id INTEGER NOT NULL UNIQUE REFERENCES automatic_entries(id) ON DELETE RESTRICT,
    out_entry_id INTEGER NOT NULL UNIQUE REFERENCES automatic_entries(id) ON DELETE RESTRICT,
    type TEXT NOT NULL DEFAULT 'in' CHECK (type IN ('in', 'out')),
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    CHECK (in_entry_id <> out_entry_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_automatic_weighments_in_entry
ON automatic_weighments (in_entry_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_automatic_weighments_out_entry
ON automatic_weighments (out_entry_id);

CREATE INDEX IF NOT EXISTS idx_automatic_weighments_created
ON automatic_weighments (created_at DESC);

-- ------------------------------------------------------------------------------
-- 11. TICKETS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    concern TEXT NOT NULL,
    reply TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'rejected')),
    entry_id INTEGER NOT NULL REFERENCES automatic_entries(id) ON DELETE RESTRICT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_tickets_user_status
ON tickets (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tickets_entry
ON tickets (entry_id);

CREATE INDEX IF NOT EXISTS idx_tickets_created_desc
ON tickets (created_at DESC);
