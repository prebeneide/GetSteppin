-- Step Data Table
-- Lagrer daglige skrittdata for brukere

CREATE TABLE IF NOT EXISTS public.step_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  steps INTEGER DEFAULT 0,
  distance_meters INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Enable Row Level Security
ALTER TABLE public.step_data ENABLE ROW LEVEL SECURITY;

-- Policies for step_data
-- Brukere kan se sine egne skrittdata
CREATE POLICY "Users can view own step data"
  ON public.step_data FOR SELECT
  USING (auth.uid() = user_id);

-- Brukere kan se venners skrittdata
CREATE POLICY "Users can view friends step data"
  ON public.step_data FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.friendships
      WHERE status = 'accepted'
      AND (
        (requester_id = auth.uid() AND addressee_id = step_data.user_id)
        OR
        (addressee_id = auth.uid() AND requester_id = step_data.user_id)
      )
    )
  );

-- Brukere kan oppdatere sine egne skrittdata
CREATE POLICY "Users can update own step data"
  ON public.step_data FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Brukere kan legge inn sine egne skrittdata
CREATE POLICY "Users can insert own step data"
  ON public.step_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Indexes for rask søking
CREATE INDEX idx_step_data_user_id ON public.step_data(user_id);
CREATE INDEX idx_step_data_date ON public.step_data(date);
CREATE INDEX idx_step_data_user_date ON public.step_data(user_id, date DESC);

