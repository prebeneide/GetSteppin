-- Migration: 055_add_activity_notification_settings.sql
-- Add settings for activity notifications
-- Users can enable/disable different types of activity notifications

-- Add columns to user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS activity_notifications_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS weekly_average_notifications_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS top_percentage_notifications_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS goal_streak_notifications_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS weekly_goal_notifications_enabled BOOLEAN DEFAULT true;

-- Add columns to device_settings (for anonymous users)
ALTER TABLE public.device_settings
ADD COLUMN IF NOT EXISTS activity_notifications_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS weekly_average_notifications_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS top_percentage_notifications_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS goal_streak_notifications_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS weekly_goal_notifications_enabled BOOLEAN DEFAULT true;

-- Comments
COMMENT ON COLUMN public.user_profiles.activity_notifications_enabled IS 'Master toggle for all activity notifications';
COMMENT ON COLUMN public.user_profiles.weekly_average_notifications_enabled IS 'Enable/disable weekly average step notifications';
COMMENT ON COLUMN public.user_profiles.top_percentage_notifications_enabled IS 'Enable/disable top percentage achievement notifications';
COMMENT ON COLUMN public.user_profiles.goal_streak_notifications_enabled IS 'Enable/disable goal streak notifications';
COMMENT ON COLUMN public.user_profiles.weekly_goal_notifications_enabled IS 'Enable/disable weekly goal achievement notifications';

