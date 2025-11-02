-- Add Competition Achievements
-- Rank-based achievements for daily, weekly, monthly, and yearly competition

-- Note: For competition achievements, we'll use the same emoji for different periods
-- but distinguish them by metadata. This simplifies the logic.

-- Update existing achievements to be more specific
UPDATE public.achievement_types 
SET description = '1. plass blant venner i dag' 
WHERE emoji = '🏆' AND name = 'Pokal';

-- Add new competition achievements (daily only - will be reused for other periods via metadata)
INSERT INTO public.achievement_types (emoji, name, description, category, requirement_value) VALUES
-- Rank-based achievements (daily)
('🥇', 'Dagens gull', '1. plass blant venner i dag', 'competition', 1),
('🥈', 'Dagens sølv', '2. plass blant venner i dag', 'competition', 2),
('🥉', 'Dagens bronse', '3. plass blant venner i dag', 'competition', 3),

-- Fun/milestone achievements (using 'distance' category since they're step-based)
('🚀', 'Rakett', 'Over 20000 skritt på én dag', 'distance', 20000),
('💯', 'Hundre', 'Nøyaktig 100 skritt', 'distance', 100),
('🎊', 'Fest', '10 000 skritt på én dag', 'distance', 10000),
('🌙', 'Nattugle', 'Over 1000 skritt etter kl 22', 'distance', NULL),
('🌅', 'Morgenfugl', 'Over 5000 skritt før kl 10', 'distance', NULL),
('🎁', 'Overraskelse', '10 000 skritt før lunsj', 'distance', NULL)
ON CONFLICT DO NOTHING;

