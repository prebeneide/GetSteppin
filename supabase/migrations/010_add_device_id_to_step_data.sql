-- Add device_id support to step_data table
-- This allows anonymous users (identified by device_id) to also save their step data

-- Add device_id column (nullable, since logged in users use user_id)
ALTER TABLE public.step_data 
ADD COLUMN IF NOT EXISTS device_id TEXT;

-- Add index for device_id lookups
CREATE INDEX IF NOT EXISTS idx_step_data_device_id ON public.step_data(device_id);

-- Add unique constraint for device_id + date (similar to user_id + date)
-- This ensures one entry per device per day
ALTER TABLE public.step_data
ADD CONSTRAINT unique_device_date UNIQUE (device_id, date) 
DEFERRABLE INITIALLY DEFERRED;

-- Make user_id nullable (since anonymous users won't have user_id)
ALTER TABLE public.step_data
ALTER COLUMN user_id DROP NOT NULL;

-- Update RLS policies to support device_id

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own step data" ON public.step_data;
DROP POLICY IF EXISTS "Device can view own step data" ON public.step_data;

-- Policy: Users can view their own step data (by user_id)
CREATE POLICY "Users can view own step data"
  ON public.step_data FOR SELECT
  USING (
    auth.uid() = user_id OR
    user_id IS NULL -- Allow viewing anonymous data (we'll filter by device_id in app)
  );

-- Policy: Device can view own step data (by device_id)
-- This uses a function that sets device_id from session/app context
-- For now, we'll use a simple policy that allows viewing if user_id is NULL
-- The app will need to filter by device_id
CREATE POLICY "Device can view own step data"
  ON public.step_data FOR SELECT
  USING (
    user_id IS NULL -- Anonymous data (filtered by device_id in app logic)
  );

-- Update insert policy
DROP POLICY IF EXISTS "Users can insert own step data" ON public.step_data;
DROP POLICY IF EXISTS "Device can insert own step data" ON public.step_data;

-- Policy: Users can insert their own step data
CREATE POLICY "Users can insert own step data"
  ON public.step_data FOR INSERT
  WITH CHECK (
    auth.uid() = user_id OR
    (user_id IS NULL AND device_id IS NOT NULL) -- Anonymous users
  );

-- Policy: Device can insert own step data
CREATE POLICY "Device can insert own step data"
  ON public.step_data FOR INSERT
  WITH CHECK (
    user_id IS NULL AND device_id IS NOT NULL
  );

-- Update update policy
DROP POLICY IF EXISTS "Users can update own step data" ON public.step_data;
DROP POLICY IF EXISTS "Device can update own step data" ON public.step_data;

-- Policy: Users can update their own step data
CREATE POLICY "Users can update own step data"
  ON public.step_data FOR UPDATE
  USING (
    auth.uid() = user_id OR
    (user_id IS NULL AND device_id IS NOT NULL) -- Anonymous users
  )
  WITH CHECK (
    auth.uid() = user_id OR
    (user_id IS NULL AND device_id IS NOT NULL) -- Anonymous users
  );

-- Policy: Device can update own step data
CREATE POLICY "Device can update own step data"
  ON public.step_data FOR UPDATE
  USING (user_id IS NULL AND device_id IS NOT NULL)
  WITH CHECK (user_id IS NULL AND device_id IS NOT NULL);

