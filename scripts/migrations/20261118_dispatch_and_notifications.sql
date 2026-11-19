-- ==============================================================================
-- GLUVOK DISPATCH ENGINE & NOTIFICATIONS SCHEMA MIGRATION
-- Paste and execute this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/naropujiheabvbmeuoiz/sql
-- ==============================================================================

-- 1. Ensure factory columns exist for outgoing webhooks
ALTER TABLE IF EXISTS factories ADD COLUMN IF NOT EXISTS webhook_url TEXT DEFAULT NULL;
ALTER TABLE IF EXISTS factories ADD COLUMN IF NOT EXISTS webhook_secret TEXT DEFAULT NULL;

-- 2. NOTIFICATIONS TABLE (Immutable append-only event log)
CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    factory_id INT NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
    customer_id INT REFERENCES customers(id) ON DELETE CASCADE,
    entry_id INT REFERENCES entries(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    vehicle_number TEXT NOT NULL,
    weight INT NOT NULL,
    center_name TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite indexes for high-speed tenant catchup queries
CREATE INDEX IF NOT EXISTS idx_notifications_factory_id ON notifications(factory_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_customer ON notifications(customer_id, id DESC);

-- 3. NOTIFICATION READS TABLE (Per-user read tracking, avoids multi-user / multi-device collision)
CREATE TABLE IF NOT EXISTS notification_reads (
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_id BIGINT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, notification_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_reads_user ON notification_reads(user_id, read_at DESC);

-- 4. WEBHOOK LOGS TABLE (Decoupled execution and retry state machine)
CREATE TABLE IF NOT EXISTS webhook_logs (
    id BIGSERIAL PRIMARY KEY,
    factory_id INT NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- ('pending', 'retrying', 'delivered', 'failed')
    response_status INT DEFAULT NULL,
    attempt_count INT NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_error TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_retry ON webhook_logs(status, next_attempt_at ASC)
WHERE status IN ('pending', 'retrying');
CREATE INDEX IF NOT EXISTS idx_webhook_logs_factory ON webhook_logs(factory_id, created_at DESC);

-- 5. ROW LEVEL SECURITY FOR NOTIFICATIONS & WEBHOOKS
ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notification_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS webhook_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "factory_tenant_isolation" ON notifications;
CREATE POLICY "factory_tenant_isolation" ON notifications
FOR SELECT USING (
  CASE
    WHEN (auth.jwt() -> 'app_metadata' ->> 'factory_id') IS NOT NULL
    THEN factory_id = ((auth.jwt() -> 'app_metadata' ->> 'factory_id')::int)
    ELSE false
  END
);

DROP POLICY IF EXISTS "Allow access notifications" ON notifications;
CREATE POLICY "Allow access notifications" ON notifications FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow access notification_reads" ON notification_reads;
CREATE POLICY "Allow access notification_reads" ON notification_reads FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow access webhook_logs" ON webhook_logs;
CREATE POLICY "Allow access webhook_logs" ON webhook_logs FOR ALL USING (true);

-- 6. ENABLE SUPABASE REALTIME REPLICATION FOR ENTRIES & NOTIFICATIONS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'entries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.entries;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

ALTER TABLE public.entries REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- 7. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
