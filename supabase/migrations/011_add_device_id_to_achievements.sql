-- Add device_id support to achievements tables
-- This allows anonymous users (identified by device_id) to also collect achievements

-- First, drop the existing unique constraint on user_id + achievement_type_id
-- We'll recreate it as a partial unique index
ALTER TABLE public.user_achievements
DROP CONSTRAINT IF EXISTS user_achievements_user_id_achievement_type_id_key;

-- Update user_achievements to support device_id for anonymous users
ALTER TABLE public.user_achievements 
ADD COLUMN IF NOT EXISTS device_id TEXT;

-- Make user_id nullable (since anonymous users won't have user_id)
ALTER TABLE public.user_achievements
ALTER COLUMN user_id DROP NOT NULL;

-- Add index for device_id lookups
CREATE INDEX IF NOT EXISTS idx_user_achievements_device_id ON public.user_achievements(device_id);

-- Add partial unique indexes for both user_id and device_id
-- For logged in users (user_id is not null)
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_achievement 
ON public.user_achievements(user_id, achievement_type_id) 
WHERE user_id IS NOT NULL;

-- For anonymous users (device_id is not null)
CREATE UNIQUE INDEX IF NOT EXISTS unique_device_achievement 
ON public.user_achievements(device_id, achievement_type_id) 
WHERE device_id IS NOT NULL;

-- Update achievement_log to support device_id
ALTER TABLE public.achievement_log 
ADD COLUMN IF NOT EXISTS device_id TEXT;

-- Make user_id nullable in achievement_log
ALTER TABLE public.achievement_log
ALTER COLUMN user_id DROP NOT NULL;

-- Add index for device_id in achievement_log
CREATE INDEX IF NOT EXISTS idx_achievement_log_device_id ON public.achievement_log(device_id);

-- Update RLS policies for user_achievements

-- Drop existing policy
DROP POLICY IF EXISTS "Achievements are viewable by everyone" ON public.user_achievements;

-- New policy: Allow viewing achievements for both logged in and anonymous users
CREATE POLICY "Achievements are viewable by everyone"
  ON public.user_achievements FOR SELECT
  USING (true);

-- Update achievement_log policies

-- Drop existing policy
DROP POLICY IF EXISTS "Users can view own achievement log" ON public.achievement_log;

-- New policy: Users can view their own log, and anonymous users can view their device log
CREATE POLICY "Users can view own achievement log"
  ON public.achievement_log FOR SELECT
  USING (
    auth.uid() = user_id OR
    user_id IS NULL -- Allow viewing anonymous logs (filtered by device_id in app)
  );

