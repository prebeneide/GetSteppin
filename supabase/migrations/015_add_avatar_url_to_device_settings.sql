-- Add avatar_url column to device_settings table
-- This allows anonymous users to also have profile pictures

ALTER TABLE public.device_settings 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add index for avatar_url lookups (if needed)
CREATE INDEX IF NOT EXISTS idx_device_settings_avatar_url ON public.device_settings(avatar_url) 
WHERE avatar_url IS NOT NULL;

