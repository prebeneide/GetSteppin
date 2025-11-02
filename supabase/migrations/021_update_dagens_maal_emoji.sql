-- Update "Dagens Mål" achievement to use 🎊 instead of ✅
-- Note: "Fest" already uses 🎊, but it's not implemented in code yet, so we can safely update "Dagens Mål"

-- First, delete the existing "Fest" entry with 🎊 since "Dagens Mål" will use it
DELETE FROM public.achievement_types 
WHERE emoji = '🎊' AND name = 'Fest';

-- Update "Dagens Mål" to use 🎊
UPDATE public.achievement_types 
SET emoji = '🎊'
WHERE name = 'Dagens Mål' AND emoji = '✅';

-- If you want to keep "Fest" achievement with a different emoji, uncomment below:
-- INSERT INTO public.achievement_types (emoji, name, description, category, requirement_value) VALUES
-- ('✅', 'Fest', '10 000 skritt på én dag', 'distance', 10000)
-- ON CONFLICT DO NOTHING;

