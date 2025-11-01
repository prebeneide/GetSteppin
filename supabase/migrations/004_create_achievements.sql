-- Achievements Table
-- Lagrer alle typer achievements/emojis som kan oppnås

CREATE TABLE IF NOT EXISTS public.achievement_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emoji TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('distance', 'goal', 'competition', 'streak', 'social')),
  requirement_value INTEGER, -- F.eks. 1000m for kirsebær, eller null for enkelte achievements
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.achievement_types ENABLE ROW LEVEL SECURITY;

-- Alle kan se achievement types
CREATE POLICY "Achievement types are viewable by everyone"
  ON public.achievement_types FOR SELECT
  USING (true);

-- User Achievements Table
-- Lagrer hvilke achievements brukere har oppnådd

CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  achievement_type_id UUID NOT NULL REFERENCES public.achievement_types(id) ON DELETE CASCADE,
  count INTEGER DEFAULT 1, -- Antall ganger oppnådd
  first_earned_at TIMESTAMPTZ DEFAULT NOW(),
  last_earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_type_id)
);

-- Enable Row Level Security
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- Policies for user_achievements
-- Alle kan se andres achievements (for profilvisning)
CREATE POLICY "Achievements are viewable by everyone"
  ON public.user_achievements FOR SELECT
  USING (true);

-- Brukere kan kun oppdatere sine egne achievements (via backend-funksjon)
-- INSERT/UPDATE gjøres vanligvis via funksjoner, ikke direkte

-- Indexes
CREATE INDEX idx_user_achievements_user_id ON public.user_achievements(user_id);
CREATE INDEX idx_user_achievements_type_id ON public.user_achievements(achievement_type_id);

-- Achievement Log Table
-- Logger når achievements blir oppnådd

CREATE TABLE IF NOT EXISTS public.achievement_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  achievement_type_id UUID NOT NULL REFERENCES public.achievement_types(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB -- Ekstra info om hvordan det ble oppnådd
);

-- Enable Row Level Security
ALTER TABLE public.achievement_log ENABLE ROW LEVEL SECURITY;

-- Policies for achievement_log
-- Brukere kan se sin egen logg
CREATE POLICY "Users can view own achievement log"
  ON public.achievement_log FOR SELECT
  USING (auth.uid() = user_id);

-- Index for rask søking
CREATE INDEX idx_achievement_log_user_id ON public.achievement_log(user_id, earned_at DESC);

