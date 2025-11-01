-- Auto-setup script for storage bucket and policies
-- This script creates the avatars bucket and sets up all necessary policies
-- Run this once in Supabase SQL Editor to set up everything automatically

-- Note: Bucket creation must be done via Dashboard first:
-- 1. Go to Storage > New Bucket
-- 2. Name: avatars
-- 3. Public: Yes
-- 4. Create bucket

-- Then run this script to set up policies:

-- Check if bucket exists (will fail if bucket doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE name = 'avatars'
  ) THEN
    RAISE EXCEPTION 'Avatars bucket does not exist. Please create it in Dashboard first.';
  END IF;
END $$;

-- RLS policies for avatars bucket
-- These policies allow authenticated and anonymous users to upload their own avatars

-- Policy: Anyone can view avatars (public bucket)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Policy: Authenticated users can upload their own avatar
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Authenticated users can update their own avatar
DROP POLICY IF EXISTS "Authenticated users can update own avatars" ON storage.objects;
CREATE POLICY "Authenticated users can update own avatars"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Authenticated users can delete their own avatar
DROP POLICY IF EXISTS "Authenticated users can delete own avatars" ON storage.objects;
CREATE POLICY "Authenticated users can delete own avatars"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Anonymous users can upload avatars (for device_id based users)
-- Store in anonymous/ folder
DROP POLICY IF EXISTS "Anonymous users can upload avatars" ON storage.objects;
CREATE POLICY "Anonymous users can upload avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.role() = 'anon' AND
  (storage.foldername(name))[1] = 'anonymous'
);

-- Policy: Anonymous users can update their avatars
DROP POLICY IF EXISTS "Anonymous users can update own avatars" ON storage.objects;
CREATE POLICY "Anonymous users can update own avatars"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' AND
  auth.role() = 'anon' AND
  (storage.foldername(name))[1] = 'anonymous'
);

-- Policy: Anonymous users can delete their avatars
DROP POLICY IF EXISTS "Anonymous users can delete own avatars" ON storage.objects;
CREATE POLICY "Anonymous users can delete own avatars"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' AND
  auth.role() = 'anon' AND
  (storage.foldername(name))[1] = 'anonymous'
);

