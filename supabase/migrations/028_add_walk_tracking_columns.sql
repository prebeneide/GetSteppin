-- Add walk tracking privacy settings to user_profiles
-- Users can control whether their walks are tracked and automatically shared

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS enable_walk_tracking BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS auto_share_walks BOOLEAN DEFAULT true;

-- Add comments explaining the columns
COMMENT ON COLUMN public.user_profiles.enable_walk_tracking IS 'Whether GPS tracking is enabled for this user. If false, walks will not be tracked automatically.';
COMMENT ON COLUMN public.user_profiles.auto_share_walks IS 'Whether walks >= 1km are automatically shared as posts. If false, walks are tracked but not shared automatically.';


