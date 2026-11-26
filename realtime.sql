-- realtime.sql — run after schema.sql, storage.sql, data_api.sql and entries_data_api.sql. Safe to re-run.

-- 1. LOCKDOWN: the server uses the service role (which ignores access policies),
--    so these open policies only ever served anon/authenticated. Remove them.
--    RLS is (re)enabled too: schema.sql alone leaves factory_processed_entries without it.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'factories','users','sessions','customers','centers','commodities','rates',
    'weighments','entries','tickets','factory_processed_weighments','factory_processed_entries'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'Allow access ' || t, t);
  END LOOP;
END $$;

-- 2. NOTIFICATIONS: one row per event; the single source for every channel.
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('entry', 'weighment')),
  ref_id INT NOT NULL,
  factory_id INT NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  customer_user_id INT REFERENCES users(id) ON DELETE SET NULL,
  vehicle_number TEXT NOT NULL,
  weight NUMERIC(10, 2) NOT NULL,
  unit unit_enum NOT NULL DEFAULT 'kg',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kind, ref_id)
);
CREATE INDEX IF NOT EXISTS idx_notifications_factory_created
  ON notifications (factory_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_customer_created
  ON notifications (customer_user_id, created_at DESC) WHERE customer_user_id IS NOT NULL;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY; -- no policies: server only

ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_seen_at TIMESTAMPTZ;

-- 3. PUSH: broadcast a notification row to its private topics.
CREATE OR REPLACE FUNCTION push_notification(n notifications) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE payload jsonb := to_jsonb(n) - 'id' - 'factory_id' - 'customer_user_id';
BEGIN
  PERFORM realtime.send(payload, 'notification', 'factory:' || n.factory_id, true);
  IF n.customer_user_id IS NOT NULL THEN
    PERFORM realtime.send(payload, 'notification', 'user:' || n.customer_user_id, true);
  END IF;
END $$;

-- 4. CAPTURE: new entry → notification + push.
CREATE OR REPLACE FUNCTION entries_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n notifications;
BEGIN
  INSERT INTO notifications (kind, ref_id, factory_id, customer_user_id, vehicle_number, weight, created_at)
  SELECT 'entry', NEW.id, c.factory_id, cu.user_id, NEW.vehicle_number, NEW.weight, NEW.created_at
  FROM centers c LEFT JOIN customers cu ON cu.id = NEW.customer_id
  WHERE c.id = NEW.center_id
  ON CONFLICT (kind, ref_id) DO NOTHING
  RETURNING * INTO n;
  IF n.id IS NOT NULL THEN PERFORM push_notification(n); END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_entries_notify ON entries;
CREATE TRIGGER trg_entries_notify AFTER INSERT ON entries
FOR EACH ROW EXECUTE FUNCTION entries_notify();

-- 5. CAPTURE: new weighment → notification (plate from in-entry, net = |in − out|) + push.
CREATE OR REPLACE FUNCTION weighments_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n notifications;
BEGIN
  INSERT INTO notifications (kind, ref_id, factory_id, customer_user_id, vehicle_number, weight, unit, created_at)
  SELECT 'weighment', NEW.id, c.factory_id, cu.user_id, i.vehicle_number,
         ABS(i.weight - o.weight), NEW.unit, NEW.created_at
  FROM entries i
  JOIN entries o ON o.id = NEW.out_entry_id
  JOIN centers c ON c.id = i.center_id
  LEFT JOIN customers cu ON cu.id = i.customer_id
  WHERE i.id = NEW.in_entry_id
  ON CONFLICT (kind, ref_id) DO NOTHING
  RETURNING * INTO n;
  IF n.id IS NOT NULL THEN PERFORM push_notification(n); END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_weighments_notify ON weighments;
CREATE TRIGGER trg_weighments_notify AFTER INSERT ON weighments
FOR EACH ROW EXECUTE FUNCTION weighments_notify();

-- 6. CLEANUP: soft or hard delete removes the notification
--    (and, for an entry, any weighment built from it).
CREATE OR REPLACE FUNCTION notifications_cleanup() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'entries' THEN
    DELETE FROM notifications
    WHERE (kind = 'entry' AND ref_id = OLD.id)
       OR (kind = 'weighment' AND ref_id IN (
             SELECT id FROM weighments WHERE in_entry_id = OLD.id OR out_entry_id = OLD.id));
  ELSE
    DELETE FROM notifications WHERE kind = 'weighment' AND ref_id = OLD.id;
  END IF;
  RETURN NULL;
END $$;

-- Postgres doesn't allow TG_OP in a trigger WHEN clause, so: one trigger for soft delete, one for hard delete.
DROP TRIGGER IF EXISTS trg_entries_soft_delete ON entries;
CREATE TRIGGER trg_entries_soft_delete AFTER UPDATE OF deleted_at ON entries
FOR EACH ROW WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
EXECUTE FUNCTION notifications_cleanup();

DROP TRIGGER IF EXISTS trg_entries_hard_delete ON entries;
CREATE TRIGGER trg_entries_hard_delete AFTER DELETE ON entries
FOR EACH ROW EXECUTE FUNCTION notifications_cleanup();

DROP TRIGGER IF EXISTS trg_weighments_soft_delete ON weighments;
CREATE TRIGGER trg_weighments_soft_delete AFTER UPDATE OF deleted_at ON weighments
FOR EACH ROW WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
EXECUTE FUNCTION notifications_cleanup();

DROP TRIGGER IF EXISTS trg_weighments_hard_delete ON weighments;
CREATE TRIGGER trg_weighments_hard_delete AFTER DELETE ON weighments
FOR EACH ROW EXECUTE FUNCTION notifications_cleanup();

-- 7. ACCESS: a browser may only listen on its own topic.
DROP POLICY IF EXISTS "notifications_listen" ON realtime.messages;
CREATE POLICY "notifications_listen" ON realtime.messages
FOR SELECT TO authenticated
USING (
  realtime.messages.extension = 'broadcast' AND (
    (realtime.topic() = 'factory:' || (auth.jwt() ->> 'factory_id')
       AND (auth.jwt() ->> 'app_role') IS DISTINCT FROM 'base')
    OR realtime.topic() = 'user:' || (auth.jwt() ->> 'sub')
  )
);

-- 8. RPC LOCKDOWN: every SECURITY DEFINER function here is server-only (the server uses
--    the service role). Without this, anon or a Realtime token could call them over
--    PostgREST, e.g. push_notification (broadcast anything) or create_customer_with_user.
--    Re-run this file after re-running schema.sql / data_api.sql / entries_data_api.sql.
DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN SELECT p.oid::regprocedure FROM pg_proc p
           WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

-- 9. BACKFILL: last 24h, so the bell isn't empty after deploy (no push).
INSERT INTO notifications (kind, ref_id, factory_id, customer_user_id, vehicle_number, weight, created_at)
SELECT 'entry', e.id, c.factory_id, cu.user_id, e.vehicle_number, e.weight, e.created_at
FROM entries e JOIN centers c ON c.id = e.center_id LEFT JOIN customers cu ON cu.id = e.customer_id
WHERE e.deleted_at IS NULL AND e.created_at >= NOW() - INTERVAL '24 hours'
ON CONFLICT (kind, ref_id) DO NOTHING;

INSERT INTO notifications (kind, ref_id, factory_id, customer_user_id, vehicle_number, weight, unit, created_at)
SELECT 'weighment', w.id, c.factory_id, cu.user_id, i.vehicle_number, ABS(i.weight - o.weight), w.unit, w.created_at
FROM weighments w
JOIN entries i ON i.id = w.in_entry_id AND i.deleted_at IS NULL
JOIN entries o ON o.id = w.out_entry_id AND o.deleted_at IS NULL
JOIN centers c ON c.id = i.center_id
LEFT JOIN customers cu ON cu.id = i.customer_id
WHERE w.deleted_at IS NULL AND w.created_at >= NOW() - INTERVAL '24 hours'
ON CONFLICT (kind, ref_id) DO NOTHING;

-- ponytail: no retention job. One row per entry or weighment; add a pg_cron prune of rows
--   older than 30 days when it matters.
-- ponytail: a delete isn't pushed to open browsers; it disappears on their next load or reconnect.

NOTIFY pgrst, 'reload schema';
