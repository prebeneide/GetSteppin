-- Drop existing function first (in case it exists with different return type)
DROP FUNCTION IF EXISTS public.get_email_by_username(TEXT);

-- Create a function to get email by username for login
-- This function runs with SECURITY DEFINER so it can bypass RLS
CREATE FUNCTION public.get_email_by_username(username_input TEXT)
RETURNS TEXT AS $$
DECLARE
  user_email TEXT;
BEGIN
  -- First try to get email from user_profiles
  SELECT up.email INTO user_email
  FROM public.user_profiles up
  WHERE LOWER(up.username) = LOWER(username_input)
  LIMIT 1;

  -- If email is not in user_profiles, get it from auth.users
  IF user_email IS NULL OR user_email = '' THEN
    SELECT au.email INTO user_email
    FROM public.user_profiles up
    JOIN auth.users au ON au.id = up.id
    WHERE LOWER(up.username) = LOWER(username_input)
    LIMIT 1;

    -- Update user_profiles with email if we found it
    IF user_email IS NOT NULL THEN
      UPDATE public.user_profiles
      SET email = user_email
      WHERE LOWER(username) = LOWER(username_input);
    END IF;
  END IF;

  -- Return the email (or NULL if not found)
  RETURN user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to anon users
GRANT EXECUTE ON FUNCTION public.get_email_by_username(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(TEXT) TO authenticated;

