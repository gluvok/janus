-- realtime.sql: run after schema.sql (and re-run after it). Safe to re-run.

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('entry', 'weighment')),
  source TEXT NOT NULL CHECK (source IN ('automatic', 'manual')),
  ref_id INT NOT NULL,
  factory_id INT NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  vehicle_number TEXT NOT NULL,
  weight NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (kind, source, ref_id)
);
CREATE INDEX IF NOT EXISTS idx_notifications_factory_created ON notifications (factory_id, created_at DESC);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY; -- no policies: server only
REVOKE ALL ON notifications FROM anon, authenticated;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_seen_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION push_notification(n notifications) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM realtime.send(to_jsonb(n) - 'id' - 'factory_id', 'notification', 'factory:' || n.factory_id, true);
END $$;

-- TG_ARGV[0] = 'automatic' | 'manual'
CREATE OR REPLACE FUNCTION entry_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n notifications;
BEGIN
  INSERT INTO notifications (kind, source, ref_id, factory_id, vehicle_number, weight, created_at)
  SELECT 'entry', TG_ARGV[0], NEW.id, c.factory_id, NEW.vehicle_number, NEW.weight, NEW.created_at
  FROM centers c WHERE c.id = NEW.center_id
  ON CONFLICT (kind, source, ref_id) DO NOTHING
  RETURNING * INTO n;
  IF n.id IS NOT NULL THEN PERFORM push_notification(n); END IF;
  RETURN NULL;
END $$;

-- net is never NULL: weighments are inserted paired and gross/tare are set by trigger_weighments_auto_populate.
CREATE OR REPLACE FUNCTION weighment_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n notifications; v_plate text; v_factory int;
BEGIN
  EXECUTE format(
    'SELECT e.vehicle_number, c.factory_id FROM %I e JOIN centers c ON c.id = e.center_id WHERE e.id = $1',
    TG_ARGV[0] || '_entries')
  INTO v_plate, v_factory USING NEW.in_entry_id;
  INSERT INTO notifications (kind, source, ref_id, factory_id, vehicle_number, weight, created_at)
  VALUES ('weighment', TG_ARGV[0], NEW.id, v_factory, v_plate, NEW.net, NEW.created_at)
  ON CONFLICT (kind, source, ref_id) DO NOTHING
  RETURNING * INTO n;
  IF n.id IS NOT NULL THEN PERFORM push_notification(n); END IF;
  RETURN NULL;
END $$;

-- Soft or hard delete removes the row; deleting an entry also removes weighments built on it.
CREATE OR REPLACE FUNCTION notifications_cleanup() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_TABLE_NAME LIKE '%\_entries' THEN
    DELETE FROM notifications WHERE source = TG_ARGV[0] AND kind = 'entry' AND ref_id = OLD.id;
    EXECUTE format(
      'DELETE FROM notifications WHERE source = $1 AND kind = ''weighment''
         AND ref_id IN (SELECT id FROM %I WHERE in_entry_id = $2 OR out_entry_id = $2)',
      TG_ARGV[0] || '_weighments')
    USING TG_ARGV[0], OLD.id;
  ELSE
    DELETE FROM notifications WHERE source = TG_ARGV[0] AND kind = 'weighment' AND ref_id = OLD.id;
  END IF;
  RETURN NULL;
END $$;

-- Plate corrections (correct_automatic_weighment_plate) and weight edits keep the snapshot in step.
-- ponytail: re-scopes the list only; a push already delivered isn't recalled.
CREATE OR REPLACE FUNCTION notifications_sync_entry() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE notifications SET vehicle_number = NEW.vehicle_number, weight = NEW.weight
  WHERE source = TG_ARGV[0] AND kind = 'entry' AND ref_id = NEW.id;
  EXECUTE format(
    'UPDATE notifications SET vehicle_number = $1
     WHERE source = $2 AND kind = ''weighment'' AND ref_id IN (SELECT id FROM %I WHERE in_entry_id = $3)',
    TG_ARGV[0] || '_weighments')
  USING NEW.vehicle_number, TG_ARGV[0], NEW.id;
  RETURN NULL;
END $$;

DO $$
DECLARE s text; e text; w text;
BEGIN
  FOREACH s IN ARRAY ARRAY['automatic', 'manual'] LOOP
    e := s || '_entries'; w := s || '_weighments';
    EXECUTE format('DROP TRIGGER IF EXISTS trg_notify ON %I', e);
    EXECUTE format('CREATE TRIGGER trg_notify AFTER INSERT ON %I FOR EACH ROW EXECUTE FUNCTION entry_notify(%L)', e, s);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_notify ON %I', w);
    EXECUTE format('CREATE TRIGGER trg_notify AFTER INSERT ON %I FOR EACH ROW EXECUTE FUNCTION weighment_notify(%L)', w, s);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_notify_sync ON %I', e);
    EXECUTE format('CREATE TRIGGER trg_notify_sync AFTER UPDATE OF vehicle_number, weight ON %I FOR EACH ROW
      WHEN (OLD.vehicle_number IS DISTINCT FROM NEW.vehicle_number OR OLD.weight IS DISTINCT FROM NEW.weight)
      EXECUTE FUNCTION notifications_sync_entry(%L)', e, s);
    FOREACH e IN ARRAY ARRAY[s || '_entries', s || '_weighments'] LOOP
      EXECUTE format('DROP TRIGGER IF EXISTS trg_notify_soft_delete ON %I', e);
      EXECUTE format('CREATE TRIGGER trg_notify_soft_delete AFTER UPDATE OF deleted_at ON %I FOR EACH ROW
        WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
        EXECUTE FUNCTION notifications_cleanup(%L)', e, s);
      EXECUTE format('DROP TRIGGER IF EXISTS trg_notify_hard_delete ON %I', e);
      EXECUTE format('CREATE TRIGGER trg_notify_hard_delete AFTER DELETE ON %I FOR EACH ROW
        EXECUTE FUNCTION notifications_cleanup(%L)', e, s);
    END LOOP;
  END LOOP;
END $$;

-- A browser may only listen on its own factory topic (D2: no base role).
DROP POLICY IF EXISTS "notifications_listen" ON realtime.messages;
CREATE POLICY "notifications_listen" ON realtime.messages
FOR SELECT TO authenticated
USING (
  realtime.messages.extension = 'broadcast'
  AND realtime.topic() = 'factory:' || (auth.jwt() ->> 'factory_id')
  AND (auth.jwt() ->> 'app_role') IN ('admin', 'manager', 'operator')
);

-- New functions are server-only (same rule as schema.sql §8).
DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p
           WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

-- Backfill the last 24h so the bell isn't empty after deploy (no push).
INSERT INTO notifications (kind, source, ref_id, factory_id, vehicle_number, weight, created_at)
SELECT 'entry', 'automatic', e.id, c.factory_id, e.vehicle_number, e.weight, e.created_at
FROM automatic_entries e JOIN centers c ON c.id = e.center_id
WHERE e.deleted_at IS NULL AND e.created_at >= now() - interval '24 hours'
UNION ALL
SELECT 'entry', 'manual', e.id, c.factory_id, e.vehicle_number, e.weight, e.created_at
FROM manual_entries e JOIN centers c ON c.id = e.center_id
WHERE e.deleted_at IS NULL AND e.created_at >= now() - interval '24 hours'
ON CONFLICT (kind, source, ref_id) DO NOTHING;

INSERT INTO notifications (kind, source, ref_id, factory_id, vehicle_number, weight, created_at)
SELECT 'weighment', 'automatic', w.id, w.factory_id, w.vehicle_number, w.net, w.created_at
FROM automatic_weighments_view w WHERE w.created_at >= now() - interval '24 hours'
UNION ALL
SELECT 'weighment', 'manual', w.id, w.factory_id, w.vehicle_number, w.net, w.created_at
FROM manual_weighments_view w WHERE w.created_at >= now() - interval '24 hours'
ON CONFLICT (kind, source, ref_id) DO NOTHING;

-- ponytail: no retention job; add a pg_cron prune (>30 days) when the table grows.
NOTIFY pgrst, 'reload schema';
