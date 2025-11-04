-- Add map_position column to posts table
-- This determines where the map appears in the media slider (after which image index)
-- -1 means map at the end, otherwise position after image index

ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS map_position INTEGER DEFAULT -1;

-- Add comment explaining the column
COMMENT ON COLUMN public.posts.map_position IS 'Position in media slider where map appears. -1 = end, 0+ = after image index';

-- Set default for existing posts (map at end)
UPDATE public.posts
SET map_position = -1
WHERE map_position IS NULL;

