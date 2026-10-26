-- ==============================================================================
-- FACTORY DATA API: SCHEMA MIGRATION
-- File: data_api.sql
-- Description: Adds API key support to factories and creates the
--              factory_processed_weighments table to track statefully processed IDs.
-- ==============================================================================

-- 1. SCHEMA MIGRATION: Add api_key column and unique index to factories
ALTER TABLE IF EXISTS factories 
ADD COLUMN IF NOT EXISTS api_key TEXT UNIQUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_factories_api_key 
ON factories (api_key) 
WHERE deleted_at IS NULL;

-- 2. SCHEMA MIGRATION: Tracking table for processed weighments per factory
CREATE TABLE IF NOT EXISTS factory_processed_weighments (
    id SERIAL PRIMARY KEY,
    factory_id INT NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
    weighment_id INT NOT NULL REFERENCES weighments(id) ON DELETE CASCADE,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_factory_processed_weighments UNIQUE (factory_id, weighment_id)
);

CREATE INDEX IF NOT EXISTS idx_factory_processed_weighments_factory
ON factory_processed_weighments (factory_id);

ALTER TABLE IF EXISTS factory_processed_weighments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow access factory_processed_weighments" ON factory_processed_weighments;
CREATE POLICY "Allow access factory_processed_weighments" ON factory_processed_weighments FOR ALL USING (true);

-- 3. Notify Supabase PostgREST schema cache to reload
NOTIFY pgrst, 'reload schema';
