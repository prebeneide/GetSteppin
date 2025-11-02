-- Posts Table
-- Stores posts shared by users (can be linked to walks or standalone)

CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  walk_id UUID REFERENCES public.walks(id) ON DELETE SET NULL, -- NULL if not linked to a walk
  content TEXT, -- User's description/comment
  image_url TEXT, -- Optional image URL (stored in Supabase Storage)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for posts

-- Everyone can view posts (as per requirement: all can see walks)
CREATE POLICY "Everyone can view posts"
  ON public.posts FOR SELECT
  USING (true);

-- Users can insert their own posts
CREATE POLICY "Users can insert own posts"
  ON public.posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own posts
CREATE POLICY "Users can update own posts"
  ON public.posts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own posts
CREATE POLICY "Users can delete own posts"
  ON public.posts FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_posts_user_id ON public.posts(user_id);
CREATE INDEX idx_posts_walk_id ON public.posts(walk_id);
CREATE INDEX idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX idx_posts_user_created_at ON public.posts(user_id, created_at DESC);


