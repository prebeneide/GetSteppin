-- Auto-setup script for all profile picture migrations
-- Run this ONCE in Supabase SQL Editor to set up everything automatically
-- This combines migrations 014, 015, and 016 into one easy script

-- 1. Add avatar_url to user_profiles
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE INDEX IF NOT EXISTS idx_user_profiles_avatar_url ON public.user_profiles(avatar_url) 
WHERE avatar_url IS NOT NULL;

-- 2. Add avatar_url to device_settings
ALTER TABLE public.device_settings 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE INDEX IF NOT EXISTS idx_device_settings_avatar_url ON public.device_settings(avatar_url) 
WHERE avatar_url IS NOT NULL;

-- 3. Storage bucket policies
-- Note: You must create the "avatars" bucket in Dashboard first:
-- Go to Storage > New Bucket > Name: "avatars" > Public: Yes > Create
-- Then run this script to set up policies

-- Public Access (anyone can view)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Authenticated users can upload their own avatar
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can update their own avatar
DROP POLICY IF EXISTS "Authenticated users can update own avatars" ON storage.objects;
CREATE POLICY "Authenticated users can update own avatars"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can delete their own avatar
DROP POLICY IF EXISTS "Authenticated users can delete own avatars" ON storage.objects;
CREATE POLICY "Authenticated users can delete own avatars"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Anonymous users can upload avatars
DROP POLICY IF EXISTS "Anonymous users can upload avatars" ON storage.objects;
CREATE POLICY "Anonymous users can upload avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.role() = 'anon' AND
  (storage.foldername(name))[1] = 'anonymous'
);

-- Anonymous users can update their avatars
DROP POLICY IF EXISTS "Anonymous users can update own avatars" ON storage.objects;
CREATE POLICY "Anonymous users can update own avatars"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' AND
  auth.role() = 'anon' AND
  (storage.foldername(name))[1] = 'anonymous'
);

-- Anonymous users can delete their avatars
DROP POLICY IF EXISTS "Anonymous users can delete own avatars" ON storage.objects;
CREATE POLICY "Anonymous users can delete own avatars"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' AND
  auth.role() = 'anon' AND
  (storage.foldername(name))[1] = 'anonymous'
);

