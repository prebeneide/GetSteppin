-- Add support for multiple images per post
-- Store images as JSONB array with primary image index
-- Maintain backward compatibility with existing image_url column

ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::JSONB,
ADD COLUMN IF NOT EXISTS primary_image_index INTEGER DEFAULT 0;

-- Migrate existing image_url to images array if it exists
-- This ensures backward compatibility
UPDATE public.posts
SET images = CASE 
  WHEN image_url IS NOT NULL THEN jsonb_build_array(jsonb_build_object('url', image_url, 'index', 0))
  ELSE '[]'::JSONB
END,
primary_image_index = CASE 
  WHEN image_url IS NOT NULL THEN 0
  ELSE 0
END
WHERE images = '[]'::JSONB OR images IS NULL;

-- Add index for querying posts with images
CREATE INDEX IF NOT EXISTS idx_posts_has_images ON public.posts USING GIN (images) WHERE jsonb_array_length(images) > 0;

-- Add comment explaining the new columns
COMMENT ON COLUMN public.posts.images IS 'Array of image objects with url property. Format: [{"url": "https://...", "index": 0}, ...]';
COMMENT ON COLUMN public.posts.primary_image_index IS 'Index in images array for the primary/first image to display';

