-- realtime.sql: run after schema.sql (and re-run after it). Safe to re-run.
-- Non-destructive: preserves existing notifications rows and legacy entries/weighments triggers.

CREATE TABLE IF NOT EXISTS public.notifications (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('entry', 'weighment')),
  source TEXT NOT NULL DEFAULT 'legacy' CHECK (source IN ('legacy', 'automatic', 'manual')),
  ref_id INT NOT NULL,
  factory_id INT NOT NULL REFERENCES public.factories(id) ON DELETE CASCADE,
  vehicle_number TEXT NOT NULL,
  weight NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notifications_kind_source_ref_id_key UNIQUE (kind, source, ref_id)
);

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'legacy';

DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.notifications'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%source%'
  LOOP
    EXECUTE format('ALTER TABLE public.notifications DROP CONSTRAINT %I', c.conname);
  END LOOP;

  ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_source_check CHECK (source IN ('legacy', 'automatic', 'manual'));

  ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_ref_id_key;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.notifications'::regclass
      AND contype = 'u'
      AND pg_get_constraintdef(oid) LIKE '%(kind, source, ref_id)%'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_kind_source_ref_id_key UNIQUE (kind, source, ref_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_factory_created ON public.notifications (factory_id, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY; -- no policies: server only
REVOKE ALL ON public.notifications FROM anon, authenticated;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS notifications_seen_at TIMESTAMPTZ;

-- Keep legacy entries/weighments notification functions compatible with (kind, source, ref_id) if present.
DO $$
BEGIN
  IF to_regclass('public.entries') IS NOT NULL AND to_regclass('public.weighments') IS NOT NULL THEN
    CREATE OR REPLACE FUNCTION public.entries_notify() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
    DECLARE n notifications;
    BEGIN
      INSERT INTO notifications (kind, source, ref_id, factory_id, customer_user_id, vehicle_number, weight, created_at)
      SELECT 'entry', 'legacy', NEW.id, c.factory_id, cu.user_id, NEW.vehicle_number, NEW.weight, NEW.created_at
      FROM centers c LEFT JOIN customers cu ON cu.id = NEW.customer_id
      WHERE c.id = NEW.center_id
      ON CONFLICT (kind, source, ref_id) DO NOTHING
      RETURNING * INTO n;
      IF n.id IS NOT NULL THEN PERFORM push_notification(n); END IF;
      RETURN NULL;
    END $fn$;

    CREATE OR REPLACE FUNCTION public.weighments_notify() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
    DECLARE n notifications;
    BEGIN
      INSERT INTO notifications (kind, source, ref_id, factory_id, customer_user_id, vehicle_number, weight, unit, created_at)
      SELECT 'weighment', 'legacy', NEW.id, c.factory_id, cu.user_id, i.vehicle_number,
             ABS(i.weight - o.weight), NEW.unit, NEW.created_at
      FROM entries i
      JOIN entries o ON o.id = NEW.out_entry_id
      JOIN centers c ON c.id = i.center_id
      LEFT JOIN customers cu ON cu.id = i.customer_id
      WHERE i.id = NEW.in_entry_id
      ON CONFLICT (kind, source, ref_id) DO NOTHING
      RETURNING * INTO n;
      IF n.id IS NOT NULL THEN PERFORM push_notification(n); END IF;
      RETURN NULL;
    END $fn$;

    CREATE OR REPLACE FUNCTION public.notifications_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
    BEGIN
      IF TG_TABLE_NAME = 'entries' THEN
        DELETE FROM notifications
        WHERE source = 'legacy'
          AND ((kind = 'entry' AND ref_id = OLD.id)
               OR (kind = 'weighment' AND ref_id IN (
                     SELECT id FROM weighments WHERE in_entry_id = OLD.id OR out_entry_id = OLD.id)));
      ELSE
        DELETE FROM notifications WHERE source = 'legacy' AND kind = 'weighment' AND ref_id = OLD.id;
      END IF;
      RETURN NULL;
    END $fn$;

    CREATE OR REPLACE FUNCTION public.notifications_sync_entry() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $fn$
    BEGIN
      UPDATE notifications nt
      SET factory_id = c.factory_id, customer_user_id = cu.user_id,
          vehicle_number = NEW.vehicle_number, weight = NEW.weight
      FROM centers c LEFT JOIN customers cu ON cu.id = NEW.customer_id
      WHERE nt.source = 'legacy' AND nt.kind = 'entry' AND nt.ref_id = NEW.id AND c.id = NEW.center_id;

      UPDATE notifications nt
      SET factory_id = c.factory_id, customer_user_id = cu.user_id,
          vehicle_number = i.vehicle_number, weight = ABS(i.weight - o.weight)
      FROM weighments w
      JOIN entries i ON i.id = w.in_entry_id
      JOIN entries o ON o.id = w.out_entry_id
      JOIN centers c ON c.id = i.center_id
      LEFT JOIN customers cu ON cu.id = i.customer_id
      WHERE nt.source = 'legacy' AND nt.kind = 'weighment' AND nt.ref_id = w.id
        AND (w.in_entry_id = NEW.id OR w.out_entry_id = NEW.id);
      RETURN NULL;
    END $fn$;
  END IF;
END $$;

-- Separate jm_* functions so automatic/manual triggers never collide with legacy notification triggers.
CREATE OR REPLACE FUNCTION public.jm_push_notification(n public.notifications) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM realtime.send(to_jsonb(n) - 'id' - 'factory_id' - 'customer_user_id' - 'unit', 'notification', 'factory:' || n.factory_id, true);
END $$;

-- TG_ARGV[0] = 'automatic' | 'manual'
CREATE OR REPLACE FUNCTION public.jm_entry_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n public.notifications;
BEGIN
  INSERT INTO public.notifications (kind, source, ref_id, factory_id, vehicle_number, weight, created_at)
  SELECT 'entry', TG_ARGV[0], NEW.id, c.factory_id, NEW.vehicle_number, NEW.weight, NEW.created_at
  FROM public.centers c WHERE c.id = NEW.center_id
  ON CONFLICT (kind, source, ref_id) DO NOTHING
  RETURNING * INTO n;
  IF n.id IS NOT NULL THEN PERFORM public.jm_push_notification(n); END IF;
  RETURN NULL;
END $$;

-- net is never NULL: weighments are inserted paired and gross/tare are set by trigger_weighments_auto_populate.
CREATE OR REPLACE FUNCTION public.jm_weighment_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n public.notifications; v_plate text; v_factory int;
BEGIN
  EXECUTE format(
    'SELECT e.vehicle_number, c.factory_id FROM public.%I e JOIN public.centers c ON c.id = e.center_id WHERE e.id = $1',
    TG_ARGV[0] || '_entries')
  INTO v_plate, v_factory USING NEW.in_entry_id;
  INSERT INTO public.notifications (kind, source, ref_id, factory_id, vehicle_number, weight, created_at)
  VALUES ('weighment', TG_ARGV[0], NEW.id, v_factory, v_plate, NEW.net, NEW.created_at)
  ON CONFLICT (kind, source, ref_id) DO NOTHING
  RETURNING * INTO n;
  IF n.id IS NOT NULL THEN PERFORM public.jm_push_notification(n); END IF;
  RETURN NULL;
END $$;

-- Soft or hard delete removes the row; deleting an entry also removes weighments built on it.
CREATE OR REPLACE FUNCTION public.jm_notifications_cleanup() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_TABLE_NAME LIKE '%\_entries' THEN
    DELETE FROM public.notifications WHERE source = TG_ARGV[0] AND kind = 'entry' AND ref_id = OLD.id;
    EXECUTE format(
      'DELETE FROM public.notifications WHERE source = $1 AND kind = ''weighment''
         AND ref_id IN (SELECT id FROM public.%I WHERE in_entry_id = $2 OR out_entry_id = $2)',
      TG_ARGV[0] || '_weighments')
    USING TG_ARGV[0], OLD.id;
  ELSE
    DELETE FROM public.notifications WHERE source = TG_ARGV[0] AND kind = 'weighment' AND ref_id = OLD.id;
  END IF;
  RETURN NULL;
END $$;

-- Plate corrections (correct_automatic_weighment_plate) and weight edits keep the snapshot in step.
-- ponytail: re-scopes the list only; a push already delivered isn't recalled.
CREATE OR REPLACE FUNCTION public.jm_notifications_sync_entry() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.notifications SET vehicle_number = NEW.vehicle_number, weight = NEW.weight
  WHERE source = TG_ARGV[0] AND kind = 'entry' AND ref_id = NEW.id;
  EXECUTE format(
    'UPDATE public.notifications SET vehicle_number = $1
     WHERE source = $2 AND kind = ''weighment'' AND ref_id IN (SELECT id FROM public.%I WHERE in_entry_id = $3)',
    TG_ARGV[0] || '_weighments')
  USING NEW.vehicle_number, TG_ARGV[0], NEW.id;
  RETURN NULL;
END $$;

DO $$
DECLARE s text; e text; w text;
BEGIN
  FOREACH s IN ARRAY ARRAY['automatic', 'manual'] LOOP
    e := s || '_entries'; w := s || '_weighments';
    EXECUTE format('DROP TRIGGER IF EXISTS trg_notify ON public.%I', e);
    EXECUTE format('CREATE TRIGGER trg_notify AFTER INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.jm_entry_notify(%L)', e, s);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_notify ON public.%I', w);
    EXECUTE format('CREATE TRIGGER trg_notify AFTER INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.jm_weighment_notify(%L)', w, s);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_notify_sync ON public.%I', e);
    EXECUTE format('CREATE TRIGGER trg_notify_sync AFTER UPDATE OF vehicle_number, weight ON public.%I FOR EACH ROW
      WHEN (OLD.vehicle_number IS DISTINCT FROM NEW.vehicle_number OR OLD.weight IS DISTINCT FROM NEW.weight)
      EXECUTE FUNCTION public.jm_notifications_sync_entry(%L)', e, s);
    FOREACH e IN ARRAY ARRAY[s || '_entries', s || '_weighments'] LOOP
      EXECUTE format('DROP TRIGGER IF EXISTS trg_notify_soft_delete ON public.%I', e);
      EXECUTE format('CREATE TRIGGER trg_notify_soft_delete AFTER UPDATE OF deleted_at ON public.%I FOR EACH ROW
        WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
        EXECUTE FUNCTION public.jm_notifications_cleanup(%L)', e, s);
      EXECUTE format('DROP TRIGGER IF EXISTS trg_notify_hard_delete ON public.%I', e);
      EXECUTE format('CREATE TRIGGER trg_notify_hard_delete AFTER DELETE ON public.%I FOR EACH ROW
        EXECUTE FUNCTION public.jm_notifications_cleanup(%L)', e, s);
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
INSERT INTO public.notifications (kind, source, ref_id, factory_id, vehicle_number, weight, created_at)
SELECT 'entry', 'automatic', e.id, c.factory_id, e.vehicle_number, e.weight, e.created_at
FROM public.automatic_entries e JOIN public.centers c ON c.id = e.center_id
WHERE e.deleted_at IS NULL AND e.created_at >= now() - interval '24 hours'
UNION ALL
SELECT 'entry', 'manual', e.id, c.factory_id, e.vehicle_number, e.weight, e.created_at
FROM public.manual_entries e JOIN public.centers c ON c.id = e.center_id
WHERE e.deleted_at IS NULL AND e.created_at >= now() - interval '24 hours'
ON CONFLICT (kind, source, ref_id) DO NOTHING;

INSERT INTO public.notifications (kind, source, ref_id, factory_id, vehicle_number, weight, created_at)
SELECT 'weighment', 'automatic', w.id, w.factory_id, w.vehicle_number, w.net, w.created_at
FROM public.automatic_weighments_view w WHERE w.created_at >= now() - interval '24 hours'
UNION ALL
SELECT 'weighment', 'manual', w.id, w.factory_id, w.vehicle_number, w.net, w.created_at
FROM public.manual_weighments_view w WHERE w.created_at >= now() - interval '24 hours'
ON CONFLICT (kind, source, ref_id) DO NOTHING;

-- ponytail: no retention job; add a pg_cron prune (>30 days) when the table grows.
NOTIFY pgrst, 'reload schema';
