-- Force remove ALL running achievements (🏃, 🏃‍♀️, 🏁, 🏃‍♂️)
-- This is a more aggressive cleanup for when test data created fake achievements

-- Step 1: Show what we're about to delete
DO $$
DECLARE
  log_count INTEGER;
  achievement_count INTEGER;
BEGIN
  -- Count achievement_log entries
  SELECT COUNT(*) INTO log_count
  FROM achievement_log al
  JOIN achievement_types at ON at.id = al.achievement_type_id
  WHERE at.emoji IN ('🏃', '🏃‍♀️', '🏁', '🏃‍♂️');
  
  -- Count user_achievements entries
  SELECT COUNT(*) INTO achievement_count
  FROM user_achievements ua
  JOIN achievement_types at ON at.id = ua.achievement_type_id
  WHERE at.emoji IN ('🏃', '🏃‍♀️', '🏁', '🏃‍♂️');
  
  RAISE NOTICE 'Found % running achievement logs and % user achievement entries to remove', log_count, achievement_count;
END $$;

-- Step 2: Delete ALL running achievement logs
DELETE FROM achievement_log
WHERE achievement_type_id IN (
  SELECT id FROM achievement_types WHERE emoji IN ('🏃', '🏃‍♀️', '🏁', '🏃‍♂️')
);

-- Step 3: Delete ALL running user achievements
DELETE FROM user_achievements
WHERE achievement_type_id IN (
  SELECT id FROM achievement_types WHERE emoji IN ('🏃', '🏃‍♀️', '🏁', '🏃‍♂️')
);

-- Step 4: Reset running_distance_meters for ALL users to 0
-- This prevents achievements from being re-awarded
UPDATE step_data
SET running_distance_meters = 0
WHERE running_distance_meters > 0;

-- Step 5: Verify cleanup
DO $$
DECLARE
  remaining_logs INTEGER;
  remaining_achievements INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_logs
  FROM achievement_log al
  JOIN achievement_types at ON at.id = al.achievement_type_id
  WHERE at.emoji IN ('🏃', '🏃‍♀️', '🏁', '🏃‍♂️');
  
  SELECT COUNT(*) INTO remaining_achievements
  FROM user_achievements ua
  JOIN achievement_types at ON at.id = ua.achievement_type_id
  WHERE at.emoji IN ('🏃', '🏃‍♀️', '🏁', '🏃‍♂️');
  
  IF remaining_logs = 0 AND remaining_achievements = 0 THEN
    RAISE NOTICE '✅ Cleanup successful! All running achievements removed.';
  ELSE
    RAISE WARNING '⚠️ Some achievements remain: % logs, % user achievements', remaining_logs, remaining_achievements;
  END IF;
END $$;

