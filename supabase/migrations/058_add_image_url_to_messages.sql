-- Migration: 058_add_image_url_to_messages.sql
-- Add image_url column to messages table to support image sharing in chat

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add index for image_url queries (optional, but useful for filtering)
CREATE INDEX IF NOT EXISTS idx_messages_image_url ON public.messages(image_url) WHERE image_url IS NOT NULL;

-- Comments
COMMENT ON COLUMN public.messages.image_url IS 'URL to image attached to message. NULL if message is text-only.';

