-- Add basic internationalization columns to user_profiles and device_settings
-- Phase 1: Language, distance unit, phone number, and country code

-- User Profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'nb', -- 'nb' (Norwegian) | 'en' (English)
ADD COLUMN IF NOT EXISTS distance_unit TEXT DEFAULT 'km', -- 'km' (kilometers) | 'mi' (miles)
ADD COLUMN IF NOT EXISTS phone_number TEXT, -- Full phone number with country code (e.g., +4712345678)
ADD COLUMN IF NOT EXISTS country_code TEXT; -- ISO 3166-1 alpha-2 (e.g., 'NO', 'US', 'GB')

-- Device Settings (for anonymous users)
ALTER TABLE public.device_settings
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'nb',
ADD COLUMN IF NOT EXISTS distance_unit TEXT DEFAULT 'km';

-- Add indexes for phone number search
CREATE INDEX IF NOT EXISTS idx_user_profiles_phone_number ON public.user_profiles(phone_number) WHERE phone_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_profiles_country_code ON public.user_profiles(country_code) WHERE country_code IS NOT NULL;

-- Comments
COMMENT ON COLUMN public.user_profiles.language IS 'User preferred language: nb (Norwegian) or en (English)';
COMMENT ON COLUMN public.user_profiles.distance_unit IS 'User preferred distance unit: km (kilometers) or mi (miles)';
COMMENT ON COLUMN public.user_profiles.phone_number IS 'Full phone number including country code (e.g., +4712345678)';
COMMENT ON COLUMN public.user_profiles.country_code IS 'ISO 3166-1 alpha-2 country code (e.g., NO, US, GB)';
COMMENT ON COLUMN public.device_settings.language IS 'Device preferred language: nb (Norwegian) or en (English)';
COMMENT ON COLUMN public.device_settings.distance_unit IS 'Device preferred distance unit: km (kilometers) or mi (miles)';

