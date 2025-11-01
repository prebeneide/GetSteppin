-- Fix RLS policies to allow username lookup for login
-- This allows anyone to search by username to get email for login

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.user_profiles;

-- Create new policy that allows username lookup (which includes email)
-- This is needed for login with username
CREATE POLICY "Profiles are viewable by everyone for username lookup"
  ON public.user_profiles FOR SELECT
  USING (true);

-- Also ensure we can select email column specifically
-- The policy above should cover this, but let's make sure

