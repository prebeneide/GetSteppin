-- Add home area settings to user_profiles
-- Allows users to configure when walks should be tracked (only when leaving home area)

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS home_area_radius_meters INTEGER DEFAULT 50, -- Radius in meters (50m = 100m diameter)
ADD COLUMN IF NOT EXISTS home_latitude DECIMAL(10,8), -- Home location latitude (NULL = not set)
ADD COLUMN IF NOT EXISTS home_longitude DECIMAL(11,8), -- Home location longitude (NULL = not set)
ADD COLUMN IF NOT EXISTS min_walk_distance_meters INTEGER DEFAULT 1000, -- Minimum distance for a walk to be tracked
ADD COLUMN IF NOT EXISTS min_walk_speed_kmh DECIMAL(4,2) DEFAULT 3.0; -- Minimum speed (km/h) for movement to count as walking

-- Add comments explaining the columns
COMMENT ON COLUMN public.user_profiles.home_area_radius_meters IS 'Radius of home area in meters. Walks are only tracked when user leaves this area. Default 50m (100m diameter).';
COMMENT ON COLUMN public.user_profiles.home_latitude IS 'Latitude of home location. If NULL, tracking works for all areas (no home area restriction).';
COMMENT ON COLUMN public.user_profiles.home_longitude IS 'Longitude of home location. If NULL, tracking works for all areas (no home area restriction).';
COMMENT ON COLUMN public.user_profiles.min_walk_distance_meters IS 'Minimum distance in meters for a walk to be tracked. Default 1000m (1km).';
COMMENT ON COLUMN public.user_profiles.min_walk_speed_kmh IS 'Minimum speed in km/h for movement to count as walking. Default 3.0 km/h.';

-- Add home area settings to device_settings for anonymous users
ALTER TABLE public.device_settings
ADD COLUMN IF NOT EXISTS home_area_radius_meters INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS home_latitude DECIMAL(10,8),
ADD COLUMN IF NOT EXISTS home_longitude DECIMAL(11,8),
ADD COLUMN IF NOT EXISTS min_walk_distance_meters INTEGER DEFAULT 1000,
ADD COLUMN IF NOT EXISTS min_walk_speed_kmh DECIMAL(4,2) DEFAULT 3.0;

