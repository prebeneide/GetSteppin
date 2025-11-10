-- Add comment_id to notifications table and update type to include 'reply'

-- First, add comment_id column (nullable since likes don't have comments)
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS comment_id UUID REFERENCES public.post_comments(id) ON DELETE CASCADE;

-- Update the type check constraint to include 'reply'
ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_type_check CHECK (type IN ('like', 'comment', 'reply'));

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_notifications_comment_id ON public.notifications(comment_id);

-- Add index for aggregated reply queries
CREATE INDEX IF NOT EXISTS idx_notifications_reply_aggregation ON public.notifications(user_id, type, comment_id, read_at) WHERE type = 'reply';

COMMENT ON COLUMN public.notifications.comment_id IS 'Reference to the comment being replied to (for reply notifications)';

