-- Insert Achievement Types
-- Alle emoji-achievements som kan oppnås i appen

INSERT INTO public.achievement_types (emoji, name, description, category, requirement_value) VALUES
-- Distance achievements
('🍒', 'Kirsebær', 'Gått 1000 meter', 'distance', 1000),
('🍑', 'Fersken', 'Gått 10000 meter', 'distance', 10000),
('🎯', 'Milestone', 'Når større milepæler (50km, 100km, 500km osv)', 'distance', NULL),

-- Goal achievements
('✅', 'Dagens Mål', 'Klart dagens skrittmål', 'goal', NULL),

-- Competition achievements
('🏆', 'Pokal', 'Vunnet over alle venner i dag', 'competition', NULL),
('👑', 'Ukesvinner', 'Topp ukesvinner', 'competition', NULL),
('⭐', 'Topp 5%', 'Topp 5% av alle brukere', 'competition', NULL),

-- Streak achievements
('🔥', 'Streak', 'Daglig strek på rad', 'streak', NULL),

-- Social achievements (for fremtidig utvidelse)
('🤝', 'Teamplayer', 'Oppmuntret venner', 'social', NULL);

