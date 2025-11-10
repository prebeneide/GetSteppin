-- Migration: 054_add_activity_notifications.sql
-- Add activity notification types and metadata column
-- Activity notifications: weekly_average, top_percentage, goal_streak, weekly_goal

-- Update the type check constraint to include activity notification types
ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'like', 'comment', 'reply', 'comment_like',  -- Social notifications
  'weekly_average', 'top_percentage', 'goal_streak', 'weekly_goal'  -- Activity notifications
));

-- Add metadata column for storing additional data (JSONB)
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Make actor_id nullable for activity notifications (system-generated)
-- Note: We'll keep the constraint but allow NULL for activity notifications
-- The CHECK constraint already prevents self-notifications for social types
ALTER TABLE public.notifications
ALTER COLUMN actor_id DROP NOT NULL;

-- Make post_id nullable for activity notifications (they don't relate to posts)
-- Note: We'll keep the foreign key but allow NULL
ALTER TABLE public.notifications
ALTER COLUMN post_id DROP NOT NULL;

-- Add index for metadata queries (useful for filtering by notification type data)
CREATE INDEX IF NOT EXISTS idx_notifications_metadata ON public.notifications USING GIN (metadata) WHERE metadata IS NOT NULL;

-- Add index for activity notification types
CREATE INDEX IF NOT EXISTS idx_notifications_activity_types ON public.notifications(user_id, type, created_at DESC) 
WHERE type IN ('weekly_average', 'top_percentage', 'goal_streak', 'weekly_goal');

-- Comments
COMMENT ON COLUMN public.notifications.metadata IS 'Additional data for notifications (JSONB). For activity notifications, contains step counts, percentages, streaks, etc.';
COMMENT ON COLUMN public.notifications.type IS 'Notification type: social (like, comment, reply, comment_like) or activity (weekly_average, top_percentage, goal_streak, weekly_goal)';

