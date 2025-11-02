-- Delete user with email as username: lucasrasathurai@lr.com
-- This migration deletes a specific user whose username is an email address
-- NOTE: This will cascade delete all related data (friendships, step_data, achievements, etc.)

-- First, find the user ID
DO $$
DECLARE
  user_id_to_delete UUID;
BEGIN
  -- Find user by username (which is an email)
  SELECT id INTO user_id_to_delete
  FROM public.user_profiles
  WHERE username = 'lucasrasathurai@lr.com'
  LIMIT 1;

  -- If user found, delete them (CASCADE will handle related data)
  IF user_id_to_delete IS NOT NULL THEN
    -- Delete from auth.users first (requires proper permissions)
    -- Note: You may need to delete from Supabase dashboard if you don't have admin access
    
    -- Delete from user_profiles (this will CASCADE delete related data)
    DELETE FROM public.user_profiles
    WHERE id = user_id_to_delete;
    
    RAISE NOTICE 'Deleted user with ID: %', user_id_to_delete;
  ELSE
    RAISE NOTICE 'User with username "lucasrasathurai@lr.com" not found';
  END IF;
END $$;

-- Also clean up any device_settings that might reference this user
-- (in case they were using the app anonymously before)
DELETE FROM public.device_settings
WHERE device_id IN (
  SELECT device_id 
  FROM public.step_data 
  WHERE user_id IN (
    SELECT id FROM public.user_profiles WHERE username = 'lucasrasathurai@lr.com'
  )
  LIMIT 1
);

