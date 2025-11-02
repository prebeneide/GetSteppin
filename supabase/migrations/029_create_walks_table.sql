-- Walks Table
-- Stores GPS-tracked walks/runs that users complete
-- All walks are stored, but only shared as posts if auto_share_walks is true or user manually shares

CREATE TABLE IF NOT EXISTS public.walks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE, -- NULL for anonymous users
  device_id TEXT, -- For anonymous users
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL,
  distance_meters INTEGER NOT NULL,
  steps INTEGER DEFAULT 0, -- Steps during this walk
  average_speed_kmh DECIMAL(5,2), -- Average speed in km/h
  max_speed_kmh DECIMAL(5,2), -- Max speed in km/h
  route_coordinates JSONB, -- Array of {lat, lng, timestamp} objects
  start_location_lat DECIMAL(10,8), -- Start latitude
  start_location_lng DECIMAL(11,8), -- Start longitude
  end_location_lat DECIMAL(10,8), -- End latitude
  end_location_lng DECIMAL(11,8), -- End longitude
  is_shared BOOLEAN DEFAULT false, -- Whether this walk is shared as a post
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT walks_min_distance CHECK (distance_meters >= 0),
  CONSTRAINT walks_valid_duration CHECK (duration_minutes > 0),
  CONSTRAINT walks_user_or_device CHECK (user_id IS NOT NULL OR device_id IS NOT NULL) -- Either user_id or device_id must be set
);

-- Enable Row Level Security
ALTER TABLE public.walks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for walks

-- Everyone can view walks (as per requirement: all can see walks)
CREATE POLICY "Everyone can view walks"
  ON public.walks FOR SELECT
  USING (true);

-- Users can insert their own walks
CREATE POLICY "Users can insert own walks"
  ON public.walks FOR INSERT
  WITH CHECK (
    (auth.uid() = user_id) OR
    (user_id IS NULL AND device_id IS NOT NULL) -- Anonymous users
  );

-- Users can update their own walks (to share/unshare)
CREATE POLICY "Users can update own walks"
  ON public.walks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own walks
CREATE POLICY "Users can delete own walks"
  ON public.walks FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_walks_user_id ON public.walks(user_id);
CREATE INDEX idx_walks_device_id ON public.walks(device_id);
CREATE INDEX idx_walks_start_time ON public.walks(start_time DESC);
CREATE INDEX idx_walks_user_start_time ON public.walks(user_id, start_time DESC);
CREATE INDEX idx_walks_distance ON public.walks(distance_meters DESC);
CREATE INDEX idx_walks_is_shared ON public.walks(is_shared) WHERE is_shared = true;


