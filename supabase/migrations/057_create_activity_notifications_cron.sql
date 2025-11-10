-- Migration: 057_create_activity_notifications_cron.sql
-- Create function to trigger activity notification check for all users
-- This can be called manually or via pg_cron

-- Note: The actual notification creation logic is in activityNotificationService.ts
-- This function is a placeholder that can be extended or replaced with Edge Function call

CREATE OR REPLACE FUNCTION public.trigger_activity_notifications_check()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INTEGER;
BEGIN
  -- Count users with activity notifications enabled
  SELECT COUNT(*) INTO user_count
  FROM public.user_profiles
  WHERE activity_notifications_enabled IS NOT FALSE;
  
  -- Return message
  RETURN format('Activity notification check triggered for %s users. Notifications will be created when users open the app.', user_count);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.trigger_activity_notifications_check() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_activity_notifications_check() TO service_role;

COMMENT ON FUNCTION public.trigger_activity_notifications_check() IS 
'Triggers activity notification check. Actual notifications are created by the app when users open it.';

-- Note: For automatic scheduling, you can use pg_cron:
-- 1. Enable pg_cron extension in Supabase Dashboard (Database → Extensions)
-- 2. Uncomment and run the following to schedule daily at 8:00 AM UTC:
/*
SELECT cron.schedule(
  'trigger-activity-notifications',
  '0 8 * * *', -- Every day at 8:00 AM UTC
  $$
  SELECT public.trigger_activity_notifications_check();
  $$
);
*/

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- To unschedule a job:
-- SELECT cron.unschedule('trigger-activity-notifications');
