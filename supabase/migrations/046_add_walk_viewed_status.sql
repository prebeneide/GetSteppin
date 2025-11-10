-- Add is_viewed column to walks table
-- Tracks whether a user has viewed a walk in "Mine turer"
-- This allows us to show a badge count of new/unviewed walks

ALTER TABLE public.walks
ADD COLUMN IF NOT EXISTS is_viewed BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.walks.is_viewed IS 'Whether this walk has been viewed by the user in "Mine turer". Used to show badge count of new walks.';

-- Set all existing walks as viewed (so they don't show as new)
UPDATE public.walks
SET is_viewed = true
WHERE is_viewed IS NULL OR is_viewed = false;

