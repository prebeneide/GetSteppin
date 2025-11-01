-- Update achievement descriptions to use steps instead of meters
-- This updates existing achievement types in the database

UPDATE public.achievement_types 
SET description = 'Gått 1000 skritt' 
WHERE emoji = '🍒';

UPDATE public.achievement_types 
SET description = 'Gått 10000 skritt' 
WHERE emoji = '🍑';

-- Keep milestone description as is since it's still based on distance (km)
-- UPDATE public.achievement_types 
-- SET description = 'Når større milepæler (50km, 100km, 500km osv)' 
-- WHERE emoji = '🎯';

