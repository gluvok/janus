-- Migration: Rename tickets.weighment_id to tickets.automatic_weighment_id
ALTER TABLE IF EXISTS tickets RENAME COLUMN weighment_id TO automatic_weighment_id;
ALTER INDEX IF EXISTS idx_tickets_weighment RENAME TO idx_tickets_automatic_weighment;

-- Migration: Add in_images and out_images to automatic_weighments and manual_weighments, making images a stored generated column
ALTER TABLE automatic_weighments ADD COLUMN IF NOT EXISTS in_images TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE automatic_weighments ADD COLUMN IF NOT EXISTS out_images TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE automatic_weighments DROP COLUMN IF EXISTS images;
ALTER TABLE automatic_weighments ADD COLUMN images TEXT[] GENERATED ALWAYS AS (in_images || out_images) STORED;

ALTER TABLE manual_weighments ADD COLUMN IF NOT EXISTS in_images TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE manual_weighments ADD COLUMN IF NOT EXISTS out_images TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE manual_weighments DROP COLUMN IF EXISTS images;
ALTER TABLE manual_weighments ADD COLUMN images TEXT[] GENERATED ALWAYS AS (in_images || out_images) STORED;

-- Migration: Remove anon/authenticated write access to the mesto bucket (server writes via service_role)
DROP POLICY IF EXISTS "Allow insert access for mesto bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow update access for mesto bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete access for mesto bucket" ON storage.objects;
