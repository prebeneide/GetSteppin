-- Fix RLS policies for user_achievements to allow inserts and updates
-- This allows both logged in and anonymous users to earn achievements

-- Drop existing policies for user_achievements
DROP POLICY IF EXISTS "Achievements are viewable by everyone" ON public.user_achievements;

-- Recreate SELECT policy
CREATE POLICY "Achievements are viewable by everyone"
  ON public.user_achievements FOR SELECT
  USING (true);

-- Add INSERT policy for user_achievements
DROP POLICY IF EXISTS "Users can insert own achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "Device can insert own achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "Anyone can insert achievements" ON public.user_achievements;

-- More permissive policy: allow inserts for logged in users matching their ID,
-- or for anonymous users (with device_id). For anonymous users, we allow inserts
-- when user_id is NULL and device_id is provided. RLS validation happens in app layer.
CREATE POLICY "Anyone can insert achievements"
  ON public.user_achievements FOR INSERT
  WITH CHECK (
    CASE 
      WHEN user_id IS NOT NULL THEN auth.uid() = user_id
      WHEN user_id IS NULL THEN device_id IS NOT NULL
      ELSE false
    END
  );

-- Add UPDATE policy for user_achievements
DROP POLICY IF EXISTS "Users can update own achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "Device can update own achievements" ON public.user_achievements;
DROP POLICY IF EXISTS "Anyone can update achievements" ON public.user_achievements;

-- More permissive policy for updates
CREATE POLICY "Anyone can update achievements"
  ON public.user_achievements FOR UPDATE
  USING (
    CASE 
      WHEN user_id IS NOT NULL THEN auth.uid() = user_id
      WHEN user_id IS NULL THEN device_id IS NOT NULL
      ELSE false
    END
  )
  WITH CHECK (
    CASE 
      WHEN user_id IS NOT NULL THEN auth.uid() = user_id
      WHEN user_id IS NULL THEN device_id IS NOT NULL
      ELSE false
    END
  );

-- Fix RLS policies for achievement_log to allow inserts
DROP POLICY IF EXISTS "Users can view own achievement log" ON public.achievement_log;

-- Recreate SELECT policy
CREATE POLICY "Users can view own achievement log"
  ON public.achievement_log FOR SELECT
  USING (
    auth.uid() = user_id OR
    user_id IS NULL -- Allow viewing anonymous logs (filtered by device_id in app)
  );

-- Add INSERT policy for achievement_log
DROP POLICY IF EXISTS "Users can insert own achievement log" ON public.achievement_log;
DROP POLICY IF EXISTS "Device can insert own achievement log" ON public.achievement_log;
DROP POLICY IF EXISTS "Anyone can insert achievement log" ON public.achievement_log;

-- More permissive policy for achievement_log inserts
CREATE POLICY "Anyone can insert achievement log"
  ON public.achievement_log FOR INSERT
  WITH CHECK (
    CASE 
      WHEN user_id IS NOT NULL THEN auth.uid() = user_id
      WHEN user_id IS NULL THEN device_id IS NOT NULL
      ELSE false
    END
  );

