-- Add parent_comment_id to post_comments table for reply functionality

ALTER TABLE public.post_comments
ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES public.post_comments(id) ON DELETE CASCADE;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_post_comments_parent_id ON public.post_comments(parent_comment_id);

COMMENT ON COLUMN public.post_comments.parent_comment_id IS 'Reference to parent comment if this is a reply';

