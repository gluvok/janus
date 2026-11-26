-- ==========================================
-- SUPABASE STORAGE BUCKET & POLICIES SETUP
-- Fully Idempotent Script (Safe to re-run)
-- Target Bucket: 'gluvok'
-- Object Key Structure:
--   <factory_id>/<file_id>.<ext>
-- ==========================================

-- 1. Create Public Storage Bucket 'gluvok'
-- When public = true, objects are publicly accessible via CDN URL:
--   https://<project-ref>.supabase.co/storage/v1/object/public/gluvok/<factory_id>/<file>
-- Direct CDN access DOES NOT require a SELECT RLS policy on storage.objects.
INSERT INTO storage.buckets (id, name, public)
VALUES ('gluvok', 'gluvok', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Storage Objects RLS Policies for 'gluvok' Bucket

-- SELECT Policy (Removal of broad SELECT)
-- Supabase Security Advisory: Do NOT grant broad SELECT on storage.objects to 'anon'.
-- A SELECT policy allows clients to list/enumerate ALL files in the bucket via the Storage API.
-- Because the bucket is public, individual files can already be viewed/downloaded directly via their public URL.
DROP POLICY IF EXISTS "Public Read Access for gluvok bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Read Access for gluvok bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow read access for gluvok bucket" ON storage.objects;

-- INSERT Policy (Restricted to service_role; prefix validated)
DROP POLICY IF EXISTS "Public Insert Access for gluvok bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Insert Access for gluvok bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow insert access for gluvok bucket" ON storage.objects;
CREATE POLICY "Allow insert access for gluvok bucket"
ON storage.objects FOR INSERT TO service_role
WITH CHECK (
    bucket_id = 'gluvok' AND
    name ~ '^[0-9]+/[^/]+$'
);

-- UPDATE Policy (Restricted to service_role)
DROP POLICY IF EXISTS "Public Update Access for gluvok bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update Access for gluvok bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow update access for gluvok bucket" ON storage.objects;
CREATE POLICY "Allow update access for gluvok bucket"
ON storage.objects FOR UPDATE TO service_role
USING (bucket_id = 'gluvok')
WITH CHECK (bucket_id = 'gluvok');

-- DELETE Policy (Restricted to service_role)
DROP POLICY IF EXISTS "Public Delete Access for gluvok bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete Access for gluvok bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete access for gluvok bucket" ON storage.objects;
CREATE POLICY "Allow delete access for gluvok bucket"
ON storage.objects FOR DELETE TO service_role
USING (bucket_id = 'gluvok');
