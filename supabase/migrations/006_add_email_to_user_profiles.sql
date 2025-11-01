-- Add email column to user_profiles for username login
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);

-- Update existing profiles with email from auth.users
-- This is a one-time migration for existing users
-- Note: This requires the function to have access to auth.users
-- If this doesn't work, you may need to run it manually via SQL Editor with proper permissions

-- Create a function to update emails (requires SECURITY DEFINER)
CREATE OR REPLACE FUNCTION update_user_profiles_email()
RETURNS void AS $$
BEGIN
  UPDATE public.user_profiles up
  SET email = au.email
  FROM auth.users au
  WHERE up.id = au.id
  AND (up.email IS NULL OR up.email = '');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute the function
SELECT update_user_profiles_email();

-- Drop the function after use
DROP FUNCTION IF EXISTS update_user_profiles_email();

