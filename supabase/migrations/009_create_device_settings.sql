-- Device Settings Table
-- Lagrer innstillinger for ikke-innloggede brukere basert på enhet-ID
-- Dette sikrer at all data lagres i Supabase, uavhengig av om brukeren er innlogget eller ikke

CREATE TABLE IF NOT EXISTS public.device_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT UNIQUE NOT NULL,
  daily_step_goal INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.device_settings ENABLE ROW LEVEL SECURITY;

-- Policies for device_settings
-- Alle kan se sine egne innstillinger (basert på device_id)
-- Vi bruker en enkel policy som tillater all lesing og skriving (anonyme brukere trenger tilgang)
CREATE POLICY "Device settings are viewable by everyone"
  ON public.device_settings FOR SELECT
  USING (true);

-- Alle kan oppdatere sine egne innstillinger
CREATE POLICY "Device settings can be updated by anyone"
  ON public.device_settings FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Alle kan opprette nye innstillinger
CREATE POLICY "Device settings can be inserted by anyone"
  ON public.device_settings FOR INSERT
  WITH CHECK (true);

-- Index for rask søking etter device_id
CREATE INDEX idx_device_settings_device_id ON public.device_settings(device_id);

