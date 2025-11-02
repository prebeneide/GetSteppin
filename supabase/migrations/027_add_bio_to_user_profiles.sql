-- Add bio column to user_profiles
-- Bio is a text field that users can fill in to describe themselves
-- This will be visible on their profile for other users

ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS bio TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN public.user_profiles.bio IS 'User biography/description that is visible on their profile for other users';

