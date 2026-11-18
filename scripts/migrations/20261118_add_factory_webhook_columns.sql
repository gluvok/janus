-- Migration: Add webhook configuration columns to factories
ALTER TABLE IF EXISTS public.factories
  ADD COLUMN IF NOT EXISTS webhook_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS webhook_secret TEXT DEFAULT NULL;

COMMENT ON COLUMN public.factories.webhook_url IS 'External HTTPS webhook URL for client event notifications';
COMMENT ON COLUMN public.factories.webhook_secret IS 'Shared HMAC-SHA256 secret key for signing webhook payloads';

NOTIFY pgrst, 'reload schema';
