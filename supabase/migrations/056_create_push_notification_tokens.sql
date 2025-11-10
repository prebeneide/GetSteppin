-- Migration: 056_create_push_notification_tokens.sql
-- Create push notification tokens table
-- Stores push notification tokens for users to receive notifications when app is closed

CREATE TABLE IF NOT EXISTS public.push_notification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  device_id TEXT, -- Optional: for tracking which device the token belongs to
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token) -- One token per user (can have multiple devices)
);

-- Enable Row Level Security
ALTER TABLE public.push_notification_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for push_notification_tokens

-- Users can view their own tokens
CREATE POLICY "Users can view own push tokens"
  ON public.push_notification_tokens FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own tokens
CREATE POLICY "Users can insert own push tokens"
  ON public.push_notification_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own tokens
CREATE POLICY "Users can update own push tokens"
  ON public.push_notification_tokens FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own tokens
CREATE POLICY "Users can delete own push tokens"
  ON public.push_notification_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_push_tokens_user_id ON public.push_notification_tokens(user_id);
CREATE INDEX idx_push_tokens_token ON public.push_notification_tokens(token);
CREATE INDEX idx_push_tokens_platform ON public.push_notification_tokens(platform);

-- Comments
COMMENT ON TABLE public.push_notification_tokens IS 'Stores push notification tokens for users to receive notifications when app is closed';
COMMENT ON COLUMN public.push_notification_tokens.token IS 'Expo push notification token';
COMMENT ON COLUMN public.push_notification_tokens.platform IS 'Platform: ios, android, or web';

