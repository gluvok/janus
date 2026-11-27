-- ==============================================================================
-- ENTRY IDEMPOTENCY: SCHEMA MIGRATION
-- File: entries_idempotency.sql
-- Description: Adds entries.idempotency_key and the create_entry_with_weighment
--              stored procedure, which creates an entry and its weighment pairing
--              in one transaction. A retried request with the same key returns
--              the original entry instead of creating a duplicate.
-- Run after schema.sql, data_api.sql and entries_data_api.sql, and before
-- realtime.sql. Safe to re-run.
-- ==============================================================================

-- 1. SCHEMA MIGRATION: Idempotency key, unique per creator (NULL keys never conflict)
ALTER TABLE entries ADD COLUMN IF NOT EXISTS idempotency_key UUID;

CREATE UNIQUE INDEX IF NOT EXISTS uq_entries_created_by_idempotency_key
ON entries (created_by, idempotency_key);

-- 2. STORED PROCEDURE: Port of createEntry (lib/services/entries.ts), validateSequentialApproval
--    and tryMergeEntries. Validation failures are plain RAISE EXCEPTION (SQLSTATE P0001).
DROP FUNCTION IF EXISTS public.create_entry_with_weighment(INT, INT, INT, TEXT, NUMERIC, TEXT, INT, entry_status, INT, TEXT[], UUID);

CREATE OR REPLACE FUNCTION create_entry_with_weighment(
    p_factory_id INT,
    p_center_id INT,
    p_created_by INT,
    p_vehicle_number TEXT,
    p_weight NUMERIC,
    p_detected_vehicle_number TEXT DEFAULT NULL,
    p_customer_id INT DEFAULT NULL,
    p_status entry_status DEFAULT 'pending',
    p_approved_by INT DEFAULT NULL,
    p_images TEXT[] DEFAULT '{}',
    p_idempotency_key UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_is_device BOOLEAN;
    v_is_no_plate BOOLEAN;
    v_auto_approve BOOLEAN := FALSE;
    v_status entry_status := p_status;
    v_auto_approved BOOLEAN := FALSE;
    v_approved_by INT := p_approved_by;
    v_entry entries;
    v_replayed BOOLEAN := FALSE;
    v_earlier RECORD;
    v_check_center BOOLEAN;
    v_partner_id INT;
    v_in_id INT;
    v_out_id INT;
BEGIN
    -- 1. Creator role decides device vs manual source
    SELECT role = 'hardware' INTO v_is_device
    FROM users
    WHERE id = p_created_by AND deleted_at IS NULL;
    v_is_device := COALESCE(v_is_device, FALSE);

    -- 2. Replay: same creator + same key returns the stored entry, with no re-validation
    IF p_idempotency_key IS NOT NULL THEN
        SELECT * INTO v_entry
        FROM entries
        WHERE created_by = p_created_by AND idempotency_key = p_idempotency_key;
        v_replayed := FOUND;
    END IF;

    IF NOT v_replayed THEN
        -- 3. Plate placeholder check (case, spaces, "_" and "-" ignored)
        v_is_no_plate := COALESCE(
            'noplatedetected' IN (
                regexp_replace(lower(p_vehicle_number), '[[:space:]_-]+', '', 'g'),
                regexp_replace(lower(p_detected_vehicle_number), '[[:space:]_-]+', '', 'g')
            ),
            FALSE
        );

        -- 4. Center must belong to the factory (a device with no plate skips this, as it can never auto-approve)
        IF NOT (v_is_device AND v_is_no_plate) THEN
            SELECT auto_approve INTO v_auto_approve
            FROM centers
            WHERE id = p_center_id AND factory_id = p_factory_id AND deleted_at IS NULL;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Selected center not found';
            END IF;
        END IF;

        -- 5. Customer must belong to the factory
        IF p_customer_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM customers
            WHERE id = p_customer_id AND factory_id = p_factory_id AND deleted_at IS NULL
        ) THEN
            RAISE EXCEPTION 'Customer not found';
        END IF;

        -- 6. Approval: only device entries with a plate at an auto-approve center are auto-approved
        IF v_is_device AND NOT v_is_no_plate THEN
            IF v_auto_approve THEN
                v_status := 'approved';
                v_auto_approved := TRUE;
                v_approved_by := p_created_by;
            END IF;
        ELSIF v_status = 'approved' AND v_approved_by IS NULL THEN
            v_approved_by := p_created_by;
        END IF;

        -- 7. Sequential approval: no earlier pending entry (any source) for the same plate and center
        IF v_status = 'approved' THEN
            SELECT e.id, e.created_at, u.role INTO v_earlier
            FROM entries e
            JOIN centers c ON c.id = e.center_id
            LEFT JOIN users u ON u.id = e.created_by
            WHERE e.center_id = p_center_id
              AND e.vehicle_number = p_vehicle_number
              AND e.status = 'pending'
              AND e.created_at < NOW()
              AND e.deleted_at IS NULL
              AND c.factory_id = p_factory_id
            ORDER BY e.created_at ASC, e.id ASC
            LIMIT 1;

            IF FOUND THEN
                RAISE EXCEPTION '%', format(
                    'Cannot approve entry #0 because earlier %sentry #%s (from %s) for vehicle "%s" is still pending. Please approve entries in sequential order.',
                    CASE WHEN v_earlier.role = 'hardware' THEN 'device ' ELSE 'manual ' END,
                    v_earlier.id,
                    to_char(v_earlier.created_at AT TIME ZONE 'UTC', 'FMMM/FMDD/YYYY, FMHH12:MI:SS AM'),
                    p_vehicle_number
                );
            END IF;
        END IF;

        -- 8. Insert; a concurrent retry that won the race leaves no row, so read its entry back
        INSERT INTO entries (
            detected_vehicle_number, vehicle_number, weight, center_id, customer_id,
            created_by, approved_by, status, auto_approved, images, idempotency_key
        )
        VALUES (
            p_detected_vehicle_number, p_vehicle_number, p_weight, p_center_id, p_customer_id,
            p_created_by, v_approved_by, v_status, v_auto_approved, COALESCE(p_images, '{}'), p_idempotency_key
        )
        ON CONFLICT (created_by, idempotency_key) DO NOTHING
        RETURNING * INTO v_entry;

        IF NOT FOUND THEN
            SELECT * INTO v_entry
            FROM entries
            WHERE created_by = p_created_by AND idempotency_key = p_idempotency_key;
            v_replayed := TRUE;
        END IF;

        -- 9. Pair with a neighbouring approved entry of the same source
        IF NOT v_replayed AND v_entry.status = 'approved' THEN
            SELECT check_center_on_merge INTO v_check_center
            FROM factories
            WHERE id = p_factory_id AND deleted_at IS NULL;

            -- Backward: the single latest earlier entry (older = in, new = out)
            SELECT e.id INTO v_partner_id
            FROM entries e
            JOIN centers c ON c.id = e.center_id
            JOIN users u ON u.id = e.created_by
            WHERE e.vehicle_number = v_entry.vehicle_number
              AND e.status = 'approved'
              AND e.created_at < v_entry.created_at
              AND e.deleted_at IS NULL
              AND c.factory_id = p_factory_id
              AND (u.role = 'hardware') = v_is_device
              AND (e.center_id = v_entry.center_id OR NOT COALESCE(v_check_center, FALSE))
            ORDER BY e.created_at DESC, e.id DESC
            LIMIT 1;

            -- Already paired: discard it, and do not look further back
            IF v_partner_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM weighments w
                WHERE (w.in_entry_id = v_partner_id OR w.out_entry_id = v_partner_id) AND w.deleted_at IS NULL
            ) THEN
                v_partner_id := NULL;
            END IF;

            IF v_partner_id IS NOT NULL THEN
                v_in_id := v_partner_id;
                v_out_id := v_entry.id;
            ELSE
                -- Forward: the single earliest later entry (new = in, later = out)
                SELECT e.id INTO v_partner_id
                FROM entries e
                JOIN centers c ON c.id = e.center_id
                JOIN users u ON u.id = e.created_by
                WHERE e.vehicle_number = v_entry.vehicle_number
                  AND e.status = 'approved'
                  AND e.created_at > v_entry.created_at
                  AND e.deleted_at IS NULL
                  AND c.factory_id = p_factory_id
                  AND (u.role = 'hardware') = v_is_device
                  AND (e.center_id = v_entry.center_id OR NOT COALESCE(v_check_center, FALSE))
                ORDER BY e.created_at ASC, e.id ASC
                LIMIT 1;

                IF v_partner_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM weighments w
                    WHERE (w.in_entry_id = v_partner_id OR w.out_entry_id = v_partner_id) AND w.deleted_at IS NULL
                ) THEN
                    v_partner_id := NULL;
                END IF;

                v_in_id := v_entry.id;
                v_out_id := v_partner_id;
            END IF;

            -- A lost pairing race must not roll back the entry
            IF v_partner_id IS NOT NULL THEN
                BEGIN
                    INSERT INTO weighments (in_entry_id, out_entry_id, unit)
                    VALUES (v_in_id, v_out_id, 'kg');
                EXCEPTION WHEN unique_violation THEN
                    RAISE WARNING 'Skipped pairing entries % and %: one is already in a weighment', v_in_id, v_out_id;
                END;
            END IF;
        END IF;
    END IF;

    -- 10. The weighment is looked up (not tracked) so replays and fresh pairings share one path
    RETURN jsonb_build_object(
        'entry', to_jsonb(v_entry),
        'weighment', (
            SELECT to_jsonb(w) FROM weighments w
            WHERE (w.in_entry_id = v_entry.id OR w.out_entry_id = v_entry.id) AND w.deleted_at IS NULL
            LIMIT 1
        ),
        'replayed', v_replayed,
        'source', CASE WHEN v_is_device THEN 'device' ELSE 'manual' END
    );
END;
$$;

-- 3. LOCKDOWN: this SECURITY DEFINER function creates entries without auth checks, and Supabase's
--    default privileges let anon/authenticated call new functions. Close that now rather than
--    waiting for realtime.sql. The role check keeps the file runnable on plain Postgres.
REVOKE EXECUTE ON FUNCTION create_entry_with_weighment(INT, INT, INT, TEXT, NUMERIC, TEXT, INT, entry_status, INT, TEXT[], UUID) FROM PUBLIC;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        REVOKE EXECUTE ON FUNCTION create_entry_with_weighment(INT, INT, INT, TEXT, NUMERIC, TEXT, INT, entry_status, INT, TEXT[], UUID) FROM anon, authenticated;
        GRANT EXECUTE ON FUNCTION create_entry_with_weighment(INT, INT, INT, TEXT, NUMERIC, TEXT, INT, entry_status, INT, TEXT[], UUID) TO service_role;
    END IF;
END $$;

-- 4. Notify Supabase PostgREST schema cache to reload
NOTIFY pgrst, 'reload schema';
