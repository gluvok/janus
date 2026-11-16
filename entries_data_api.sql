-- ==============================================================================
-- FACTORY ENTRIES DATA API: SCHEMA MIGRATION
-- File: entries_data_api.sql
-- Description: Creates the factory_processed_entries table and stored procedures
--              get_factory_entry_data and acknowledge_factory_entry.
-- ==============================================================================

-- 1. SCHEMA MIGRATION: Tracking table for processed entries per factory
CREATE TABLE IF NOT EXISTS factory_processed_entries (
    id SERIAL PRIMARY KEY,
    factory_id INT NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
    entry_id INT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_factory_processed_entries UNIQUE (factory_id, entry_id)
);

CREATE INDEX IF NOT EXISTS idx_factory_processed_entries_factory
ON factory_processed_entries (factory_id);

ALTER TABLE IF EXISTS factory_processed_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow access factory_processed_entries" ON factory_processed_entries;
CREATE POLICY "Allow access factory_processed_entries" ON factory_processed_entries FOR ALL USING (true);

-- 2. STORED PROCEDURES: Read-only data API function & dedicated stateful acknowledgment function
DROP FUNCTION IF EXISTS public.get_factory_entry_data(TEXT);

CREATE OR REPLACE FUNCTION get_factory_entry_data(
    p_api_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_factory_id INT;
    v_result JSONB;
BEGIN
    -- 1. Look up active factory by API key
    SELECT id INTO v_factory_id
    FROM factories
    WHERE api_key = p_api_key AND deleted_at IS NULL;

    IF v_factory_id IS NULL THEN
        RETURN jsonb_build_object('unauthorized', true);
    END IF;

    -- 2. Query unprocessed entries for centers belonging to this factory
    SELECT jsonb_build_object(
        'data', COALESCE(jsonb_agg(item), '[]'::jsonb),
        'count', COUNT(item)
    ) INTO v_result
    FROM (
        SELECT jsonb_build_object(
            'id', e.id,
            'vehicle_number', e.vehicle_number,
            'weight', e.weight,
            'status', e.status,
            'images', COALESCE(
                (
                    SELECT jsonb_agg(elem ORDER BY ord)
                    FROM unnest(COALESCE(e.images, '{}'::text[])) WITH ORDINALITY AS u(elem, ord)
                    WHERE elem IS NOT NULL AND elem <> ''
                ),
                '[]'::jsonb
            ),
            'center_id', e.center_id,
            'created_at', to_char(e.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        ) AS item
        FROM entries e
        JOIN centers c ON c.id = e.center_id AND c.deleted_at IS NULL AND c.factory_id = v_factory_id
        LEFT JOIN factory_processed_entries fpe ON fpe.factory_id = v_factory_id AND fpe.entry_id = e.id
        WHERE e.deleted_at IS NULL
          AND fpe.id IS NULL
        ORDER BY e.created_at DESC
    ) sub;

    RETURN v_result;
END;
$$;

DROP FUNCTION IF EXISTS public.acknowledge_factory_entry(TEXT, INT);

CREATE OR REPLACE FUNCTION acknowledge_factory_entry(
    p_api_key TEXT,
    p_entry_id INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_factory_id INT;
    v_exists BOOLEAN;
BEGIN
    -- 1. Look up active factory by API key
    SELECT id INTO v_factory_id
    FROM factories
    WHERE api_key = p_api_key AND deleted_at IS NULL;

    IF v_factory_id IS NULL THEN
        RETURN jsonb_build_object('unauthorized', true);
    END IF;

    -- 2. Validate that the entry exists and belongs to this factory
    SELECT EXISTS (
        SELECT 1
        FROM entries e
        JOIN centers c ON c.id = e.center_id AND c.deleted_at IS NULL AND c.factory_id = v_factory_id
        WHERE e.id = p_entry_id AND e.deleted_at IS NULL
    ) INTO v_exists;

    IF NOT v_exists THEN
        RETURN jsonb_build_object('not_found', true);
    END IF;

    -- 3. Idempotently insert into factory_processed_entries
    INSERT INTO factory_processed_entries (factory_id, entry_id)
    VALUES (v_factory_id, p_entry_id)
    ON CONFLICT (factory_id, entry_id) DO NOTHING;

    RETURN jsonb_build_object('success', true, 'acknowledged_id', p_entry_id);
END;
$$;

-- 3. Notify Supabase PostgREST schema cache to reload
NOTIFY pgrst, 'reload schema';
