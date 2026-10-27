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

-- 3. STORED PROCEDURE: Single-roundtrip data API function with anti-join & stateful acknowledgment
DROP FUNCTION IF EXISTS public.get_factory_weighment_data(TEXT, INT);

CREATE OR REPLACE FUNCTION get_factory_weighment_data(
    p_api_key TEXT,
    p_processed_id INT DEFAULT NULL
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

    -- 2. Stateful processed ID acknowledgment
    IF p_processed_id IS NOT NULL AND p_processed_id > 0 THEN
        INSERT INTO factory_processed_weighments (factory_id, weighment_id)
        VALUES (v_factory_id, p_processed_id)
        ON CONFLICT (factory_id, weighment_id) DO NOTHING;
    END IF;

    -- 3. Query unprocessed weighments with anti-join
    SELECT jsonb_build_object(
        'data', COALESCE(jsonb_agg(item), '[]'::jsonb),
        'count', COUNT(item)
    ) INTO v_result
    FROM (
        SELECT jsonb_build_object(
            'id', w.id,
            'vehicle_number', COALESCE(in_e.vehicle_number, out_e.vehicle_number, ''),
            'gross_weight', GREATEST(in_e.weight, COALESCE(out_e.weight, 0)),
            'tare_weight', LEAST(in_e.weight, COALESCE(out_e.weight, in_e.weight)),
            'net_weight', GREATEST(in_e.weight, COALESCE(out_e.weight, 0)) - LEAST(in_e.weight, COALESCE(out_e.weight, in_e.weight)),
            'images', COALESCE(
                (
                    SELECT jsonb_agg(x.img ORDER BY x.ord)
                    FROM (
                        SELECT elem AS img, MIN(ord) AS ord
                        FROM unnest(COALESCE(in_e.images, '{}'::text[]) || COALESCE(out_e.images, '{}'::text[])) WITH ORDINALITY AS u(elem, ord)
                        WHERE elem IS NOT NULL AND elem <> ''
                        GROUP BY elem
                    ) x
                ),
                '[]'::jsonb
            ),
            'in_entry_id', w.in_entry_id,
            'in_entry_time', COALESCE(to_char(in_e.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), ''),
            'out_entry_id', w.out_entry_id,
            'out_entry_time', CASE WHEN out_e.created_at IS NOT NULL THEN to_char(out_e.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') ELSE '' END,
            'in_center_id', in_e.center_id,
            'in_center_name', COALESCE(in_c.name, ''),
            'out_center_id', out_e.center_id,
            'out_center_name', COALESCE(out_c.name, '')
        ) AS item
        FROM weighments w
        JOIN entries in_e ON in_e.id = w.in_entry_id AND in_e.deleted_at IS NULL
        JOIN centers in_c ON in_c.id = in_e.center_id AND in_c.deleted_at IS NULL AND in_c.factory_id = v_factory_id
        LEFT JOIN entries out_e ON out_e.id = w.out_entry_id AND out_e.deleted_at IS NULL
        LEFT JOIN centers out_c ON out_c.id = out_e.center_id AND out_c.deleted_at IS NULL
        LEFT JOIN factory_processed_weighments fpw ON fpw.factory_id = v_factory_id AND fpw.weighment_id = w.id
        WHERE w.deleted_at IS NULL
          AND fpw.id IS NULL
        ORDER BY w.created_at DESC
    ) sub;

    RETURN v_result;
END;
$$;

-- 4. Notify Supabase PostgREST schema cache to reload
NOTIFY pgrst, 'reload schema';
