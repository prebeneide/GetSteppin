-- Add avatar_url column to user_profiles table
-- This stores the URL to the user's profile picture in Supabase Storage

ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add index for avatar_url lookups (if needed)
CREATE INDEX IF NOT EXISTS idx_user_profiles_avatar_url ON public.user_profiles(avatar_url) 
WHERE avatar_url IS NOT NULL;

