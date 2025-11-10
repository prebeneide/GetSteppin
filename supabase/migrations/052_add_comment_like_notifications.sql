-- Add 'comment_like' notification type for when someone likes a comment

-- Update the type check constraint to include 'comment_like'
ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_type_check CHECK (type IN ('like', 'comment', 'reply', 'comment_like'));

COMMENT ON COLUMN public.notifications.comment_id IS 'Reference to the comment (for reply and comment_like notifications)';

