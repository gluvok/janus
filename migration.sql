-- ==============================================================================
-- MIGRATION: Consolidate automatic_tickets & manual_tickets into single tickets table
-- Removes redundant device_id (resolved via entry_id) and weighment_id
-- ==============================================================================

DROP TABLE IF EXISTS automatic_tickets CASCADE;
DROP TABLE IF EXISTS manual_tickets CASCADE;

CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    concern TEXT NOT NULL,
    reply TEXT,
    status ticket_status NOT NULL DEFAULT 'pending',
    entry_id INT NOT NULL REFERENCES automatic_entries(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tickets_user_status 
ON tickets (user_id, status, created_at DESC) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_entry 
ON tickets (entry_id) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_created_desc
ON tickets (created_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_search_trgm
ON tickets USING gin (concern gin_trgm_ops, reply gin_trgm_ops)
WHERE deleted_at IS NULL;

CREATE TRIGGER trg_tickets_updated_at
BEFORE UPDATE ON tickets
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

ALTER TABLE IF EXISTS tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow access tickets" ON tickets FOR ALL USING (true) WITH CHECK (true);

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
