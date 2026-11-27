-- ==============================================================================
-- TESTS: create_entry_with_weighment (entries_idempotency.sql)
-- Run against a SCRATCH database only (schema.sql is destructive):
--   createdb janus_test
--   psql -d janus_test -v ON_ERROR_STOP=1 -q -f schema.sql -f entries_data_api.sql -f entries_idempotency.sql
--   psql -d janus_test -v ON_ERROR_STOP=1 -f tests/sql/entries_idempotency.test.sql
-- Everything runs in one transaction and ends in ROLLBACK. A failed ASSERT aborts
-- with an ERROR; reaching ROLLBACK without one means every case passed.
-- NOW() is frozen inside a transaction, so cases that need an "earlier" entry
-- backdate created_at explicitly.
-- ==============================================================================
BEGIN;

CREATE TEMP TABLE ids (k TEXT PRIMARY KEY, v INT NOT NULL);

-- Seed: factory A (centers A1 manual-approve, A2 auto-approve), factory B (center B1),
-- a hardware and an operator user in A, one customer in A.
DO $$
DECLARE
    fa INT; fb INT;
BEGIN
    INSERT INTO factories (name) VALUES ('Factory A') RETURNING id INTO fa;
    INSERT INTO factories (name) VALUES ('Factory B') RETURNING id INTO fb;
    INSERT INTO ids VALUES ('fa', fa), ('fb', fb);
    WITH x AS (INSERT INTO centers (name, factory_id, auto_approve) VALUES ('A1', fa, FALSE) RETURNING id) INSERT INTO ids SELECT 'a1', id FROM x;
    WITH x AS (INSERT INTO centers (name, factory_id, auto_approve) VALUES ('A2', fa, TRUE) RETURNING id) INSERT INTO ids SELECT 'a2', id FROM x;
    WITH x AS (INSERT INTO centers (name, factory_id, auto_approve) VALUES ('B1', fb, FALSE) RETURNING id) INSERT INTO ids SELECT 'b1', id FROM x;
    WITH x AS (INSERT INTO users (username, password_hash, name, role, factory_id) VALUES ('hw', 'x', 'Hardware', 'hardware', fa) RETURNING id) INSERT INTO ids SELECT 'hw', id FROM x;
    WITH x AS (INSERT INTO users (username, password_hash, name, role, factory_id) VALUES ('op', 'x', 'Operator', 'operator', fa) RETURNING id) INSERT INTO ids SELECT 'op', id FROM x;
    WITH x AS (INSERT INTO customers (name, father_name, factory_id) VALUES ('C', 'F', fa) RETURNING id) INSERT INTO ids SELECT 'cust', id FROM x;
END $$;

-- Manual pending entry with key K, then replay, then same key from another creator.
DO $$
DECLARE
    idem_key CONSTANT UUID := '11111111-1111-1111-1111-111111111111';
    r1 JSONB; r2 JSONB; r3 JSONB;
BEGIN
    r1 := create_entry_with_weighment(
        p_factory_id := (SELECT v FROM ids WHERE k = 'fa'), p_center_id := (SELECT v FROM ids WHERE k = 'a1'),
        p_created_by := (SELECT v FROM ids WHERE k = 'op'), p_vehicle_number := 'OD02AB1234',
        p_weight := 1000, p_idempotency_key := idem_key);
    ASSERT (r1->>'replayed')::boolean = FALSE, 'first call must not be a replay';
    ASSERT jsonb_typeof(r1->'weighment') = 'null', 'pending entry has no weighment';
    ASSERT r1->>'source' = 'manual', 'operator entry is manual';
    ASSERT r1->'entry'->>'status' = 'pending', 'default status is pending';
    INSERT INTO ids VALUES ('e_manual', (r1->'entry'->>'id')::INT);

    r2 := create_entry_with_weighment(
        p_factory_id := (SELECT v FROM ids WHERE k = 'fa'), p_center_id := (SELECT v FROM ids WHERE k = 'a1'),
        p_created_by := (SELECT v FROM ids WHERE k = 'op'), p_vehicle_number := 'OD02AB1234',
        p_weight := 1000, p_idempotency_key := idem_key);
    ASSERT (r2->>'replayed')::boolean = TRUE, 'second call must be a replay';
    ASSERT r2->'entry'->>'id' = r1->'entry'->>'id', 'replay returns the original entry';
    ASSERT (SELECT COUNT(*) FROM entries WHERE idempotency_key = idem_key) = 1, 'replay must not insert';

    r3 := create_entry_with_weighment(
        p_factory_id := (SELECT v FROM ids WHERE k = 'fa'), p_center_id := (SELECT v FROM ids WHERE k = 'a1'),
        p_created_by := (SELECT v FROM ids WHERE k = 'hw'), p_vehicle_number := 'OD02AB1234',
        p_weight := 1000, p_idempotency_key := idem_key);
    ASSERT (r3->>'replayed')::boolean = FALSE, 'key is scoped per creator';
    ASSERT r3->'entry'->>'id' <> r1->'entry'->>'id', 'other creator gets its own entry';
    ASSERT r3->>'source' = 'device', 'hardware entry is device';
    ASSERT r3->'entry'->>'status' = 'pending', 'device entry at non-auto-approve center stays pending';
    INSERT INTO ids VALUES ('e_device_pending', (r3->'entry'->>'id')::INT);
END $$;

-- Device entry at the auto-approve center, then a second one that pairs with it.
DO $$
DECLARE
    r1 JSONB; r2 JSONB; r3 JSONB;
BEGIN
    r1 := create_entry_with_weighment(
        p_factory_id := (SELECT v FROM ids WHERE k = 'fa'), p_center_id := (SELECT v FROM ids WHERE k = 'a2'),
        p_created_by := (SELECT v FROM ids WHERE k = 'hw'), p_vehicle_number := 'OD02CD5678', p_weight := 5000);
    ASSERT r1->'entry'->>'status' = 'approved', 'device entry auto-approved';
    ASSERT (r1->'entry'->>'auto_approved')::boolean = TRUE, 'auto_approved flag set';
    ASSERT (r1->'entry'->>'approved_by')::int = (SELECT v FROM ids WHERE k = 'hw'), 'approved_by is the device user';
    ASSERT r1->>'source' = 'device', 'source is device';
    ASSERT jsonb_typeof(r1->'weighment') = 'null', 'no partner yet, no weighment';
    UPDATE entries SET created_at = NOW() - interval '1 minute' WHERE id = (r1->'entry'->>'id')::int;

    r2 := create_entry_with_weighment(
        p_factory_id := (SELECT v FROM ids WHERE k = 'fa'), p_center_id := (SELECT v FROM ids WHERE k = 'a2'),
        p_created_by := (SELECT v FROM ids WHERE k = 'hw'), p_vehicle_number := 'OD02CD5678', p_weight := 3000);
    ASSERT (r2->'weighment'->>'in_entry_id')::int = (r1->'entry'->>'id')::int, 'older entry is the in entry';
    ASSERT (r2->'weighment'->>'out_entry_id')::int = (r2->'entry'->>'id')::int, 'new entry is the out entry';
    ASSERT r2->'weighment'->>'unit' = 'kg', 'weighment unit is kg';
    UPDATE entries SET created_at = NOW() - interval '30 seconds' WHERE id = (r2->'entry'->>'id')::int;

    -- Latest earlier candidate is already paired: discard it, do not look further back.
    r3 := create_entry_with_weighment(
        p_factory_id := (SELECT v FROM ids WHERE k = 'fa'), p_center_id := (SELECT v FROM ids WHERE k = 'a2'),
        p_created_by := (SELECT v FROM ids WHERE k = 'hw'), p_vehicle_number := 'OD02CD5678', p_weight := 4000);
    ASSERT jsonb_typeof(r3->'weighment') = 'null', 'paired candidate is discarded, no re-pairing';
END $$;

-- Validation failures.
DO $$
DECLARE
    msg TEXT;
BEGIN
    BEGIN
        PERFORM create_entry_with_weighment(
            p_factory_id := (SELECT v FROM ids WHERE k = 'fa'), p_center_id := (SELECT v FROM ids WHERE k = 'b1'),
            p_created_by := (SELECT v FROM ids WHERE k = 'op'), p_vehicle_number := 'OD02EF9999', p_weight := 1);
        ASSERT FALSE, 'center of another factory must be rejected';
    EXCEPTION WHEN raise_exception THEN
        GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
        ASSERT msg = 'Selected center not found', 'unexpected message: ' || msg;
    END;

    BEGIN
        PERFORM create_entry_with_weighment(
            p_factory_id := (SELECT v FROM ids WHERE k = 'fa'), p_center_id := (SELECT v FROM ids WHERE k = 'a1'),
            p_created_by := (SELECT v FROM ids WHERE k = 'op'), p_vehicle_number := 'OD02EF9999', p_weight := 1,
            p_customer_id := 2147483647);
        ASSERT FALSE, 'unknown customer must be rejected';
    EXCEPTION WHEN raise_exception THEN
        GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
        ASSERT msg = 'Customer not found', 'unexpected message: ' || msg;
    END;
END $$;

-- Manual approved entry while an earlier pending one exists for the same plate + center.
DO $$
DECLARE
    msg TEXT;
    earlier INT := (SELECT v FROM ids WHERE k = 'e_manual');
BEGIN
    UPDATE entries SET created_at = NOW() - interval '2 minutes' WHERE id = earlier;
    UPDATE entries SET created_at = NOW() - interval '1 minute' WHERE id = (SELECT v FROM ids WHERE k = 'e_device_pending');
    BEGIN
        PERFORM create_entry_with_weighment(
            p_factory_id := (SELECT v FROM ids WHERE k = 'fa'), p_center_id := (SELECT v FROM ids WHERE k = 'a1'),
            p_created_by := (SELECT v FROM ids WHERE k = 'op'), p_vehicle_number := 'OD02AB1234', p_weight := 1000,
            p_status := 'approved');
        ASSERT FALSE, 'approval behind an earlier pending entry must be rejected';
    EXCEPTION WHEN raise_exception THEN
        GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
        ASSERT msg LIKE 'Cannot approve entry #0 because earlier manual entry #' || earlier || ' (from %) for vehicle "OD02AB1234" is still pending. Please approve entries in sequential order.',
            'unexpected message: ' || msg;
        ASSERT msg ~ '\(from \d{1,2}/\d{1,2}/\d{4}, \d{1,2}:\d{2}:\d{2} (AM|PM)\)', 'unexpected date format: ' || msg;
    END;
END $$;

-- Device entry with no detected plate is never auto-approved.
DO $$
DECLARE
    r JSONB;
BEGIN
    r := create_entry_with_weighment(
        p_factory_id := (SELECT v FROM ids WHERE k = 'fa'), p_center_id := (SELECT v FROM ids WHERE k = 'a2'),
        p_created_by := (SELECT v FROM ids WHERE k = 'hw'), p_vehicle_number := 'NO_PLATE_DETECTED', p_weight := 2000);
    ASSERT r->'entry'->>'status' = 'pending', 'no-plate device entry stays pending';
    ASSERT (r->'entry'->>'auto_approved')::boolean = FALSE, 'no-plate device entry is not auto-approved';
END $$;

ROLLBACK;
