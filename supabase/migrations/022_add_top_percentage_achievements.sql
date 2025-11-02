-- Add Top Percentage Achievements
-- Global ranking achievements (top 5%, 10%, 25% of all users)

INSERT INTO public.achievement_types (emoji, name, description, category, requirement_value) VALUES
-- Global ranking achievements (daily)
('💎', 'Topp 5%', 'Blant topp 5% av alle brukere i dag', 'competition', 5),
('🏅', 'Topp 10%', 'Blant topp 10% av alle brukere i dag', 'competition', 10),
('🏵️', 'Topp 25%', 'Blant topp 25% av alle brukere i dag', 'competition', 25)
ON CONFLICT DO NOTHING;

