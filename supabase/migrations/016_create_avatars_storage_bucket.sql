-- Create storage bucket for profile pictures
-- Note: This migration should be run manually in Supabase Dashboard
-- Go to Storage > Create Bucket > Name: avatars > Public: Yes

-- RLS policies for avatars bucket
-- These policies allow authenticated and anonymous users to upload their own avatars

-- Policy: Anyone can view avatars (public bucket)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Policy: Authenticated users can upload their own avatar
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Authenticated users can update their own avatar
CREATE POLICY "Authenticated users can update own avatars"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Authenticated users can delete their own avatar
CREATE POLICY "Authenticated users can delete own avatars"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Note: For anonymous users, we'll need to use device_id in the path
-- This will be handled in the application code

