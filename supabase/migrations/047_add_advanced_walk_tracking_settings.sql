-- Add advanced walk tracking settings to user_profiles and device_settings
-- These settings allow users to customize how walks are tracked and filtered

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS max_walk_speed_kmh DECIMAL(5,2) DEFAULT 15.0,
ADD COLUMN IF NOT EXISTS pause_tolerance_minutes INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS pause_radius_meters INTEGER DEFAULT 10;

COMMENT ON COLUMN public.user_profiles.max_walk_speed_kmh IS 'Maximum speed in km/h before tracking is aborted. Used to filter out vehicles. If user is running (has steps), tracking continues even above this speed.';
COMMENT ON COLUMN public.user_profiles.pause_tolerance_minutes IS 'Maximum minutes of inactivity within pause_radius before walk is aborted. Used to filter out shopping center walking.';
COMMENT ON COLUMN public.user_profiles.pause_radius_meters IS 'Radius in meters - if user stays within this radius for pause_tolerance_minutes, walk is aborted.';

-- Add same columns to device_settings (for anonymous users)
ALTER TABLE public.device_settings
ADD COLUMN IF NOT EXISTS max_walk_speed_kmh DECIMAL(5,2) DEFAULT 15.0,
ADD COLUMN IF NOT EXISTS pause_tolerance_minutes INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS pause_radius_meters INTEGER DEFAULT 10;

COMMENT ON COLUMN public.device_settings.max_walk_speed_kmh IS 'Maximum speed in km/h before tracking is aborted for anonymous users. If user is running (has steps), tracking continues even above this speed.';
COMMENT ON COLUMN public.device_settings.pause_tolerance_minutes IS 'Maximum minutes of inactivity within pause_radius before walk is aborted for anonymous users.';
COMMENT ON COLUMN public.device_settings.pause_radius_meters IS 'Radius in meters - if anonymous user stays within this radius for pause_tolerance_minutes, walk is aborted.';

