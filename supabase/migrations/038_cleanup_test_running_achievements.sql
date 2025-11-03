-- Cleanup test running achievements
-- This removes fake running achievements that may have been created from test data

-- Step 1: Check what running achievements exist
DO $$
DECLARE
  running_achievement_count INTEGER;
  user_count INTEGER;
BEGIN
  -- Count running achievements
  SELECT COUNT(*) INTO running_achievement_count
  FROM achievement_log al
  JOIN achievement_types at ON at.id = al.achievement_type_id
  WHERE at.emoji IN ('🏃', '🏃‍♀️', '🏁', '🏃‍♂️');
  
  -- Count users with running achievements
  SELECT COUNT(DISTINCT user_id) INTO user_count
  FROM achievement_log al
  JOIN achievement_types at ON at.id = al.achievement_type_id
  WHERE at.emoji IN ('🏃', '🏃‍♀️', '🏁', '🏃‍♂️')
    AND al.user_id IS NOT NULL;
  
  RAISE NOTICE 'Found % running achievement logs for % users', running_achievement_count, user_count;
END $$;

-- Step 2: Remove running achievements created from test data
-- Test data typically has running_distance_meters > 0 without actual running activity
-- We'll remove achievements that are clearly from test data

-- Remove achievement_log entries for running achievements that are likely test data
-- Criteria: achievements from more than 2 days ago that don't have corresponding legitimate running data
DELETE FROM achievement_log
WHERE id IN (
  SELECT al.id
  FROM achievement_log al
  JOIN achievement_types at ON at.id = al.achievement_type_id
  WHERE at.emoji IN ('🏃', '🏃‍♀️', '🏁', '🏃‍♂️')
    -- Remove achievements from dates before 2 days ago (likely test data)
    AND al.earned_at < NOW() - INTERVAL '2 days'
    -- Also check if there's no corresponding step_data with running_distance_meters
    -- This catches test data that was created without proper step data
    AND NOT EXISTS (
      SELECT 1
      FROM step_data sd
      WHERE sd.user_id = al.user_id
        AND sd.date::DATE = al.earned_at::DATE
        AND sd.running_distance_meters >= 5000
    )
);

-- Step 3: Update user_achievements count for running achievements
-- Reset count to 0 or delete if no logs exist
UPDATE user_achievements ua
SET count = (
  SELECT COUNT(*)
  FROM achievement_log al
  WHERE al.achievement_type_id = ua.achievement_type_id
    AND (
      (ua.user_id IS NOT NULL AND al.user_id = ua.user_id) OR
      (ua.user_id IS NULL AND al.device_id = ua.device_id)
    )
)
WHERE ua.achievement_type_id IN (
  SELECT id FROM achievement_types WHERE emoji IN ('🏃', '🏃‍♀️', '🏁', '🏃‍♂️')
);

-- Delete user_achievements entries with count = 0
DELETE FROM user_achievements
WHERE achievement_type_id IN (
  SELECT id FROM achievement_types WHERE emoji IN ('🏃', '🏃‍♀️', '🏁', '🏃‍♂️')
)
AND count = 0;

-- Step 4: Clean up step_data with fake running_distance_meters
-- Reset running_distance_meters to 0 for old test data
-- Keep today's and yesterday's data in case it's real
UPDATE step_data
SET running_distance_meters = 0
WHERE date < CURRENT_DATE - INTERVAL '2 days'
  AND running_distance_meters > 0
  AND (
    -- Likely test data: high running distance but low total distance or steps
    -- Running distance should not be > 80% of total distance (impossible for real data)
    (running_distance_meters > distance_meters * 0.8 AND distance_meters > 0) OR
    -- Running 5km but only 5000 steps? Suspicious (should be ~6000+ steps)
    (running_distance_meters >= 5000 AND steps < 6000 AND steps > 0) OR
    -- Running distance but 0 steps (impossible)
    (running_distance_meters > 0 AND steps = 0)
  );

-- Step 5: Final summary
DO $$
DECLARE
  remaining_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_count
  FROM achievement_log al
  JOIN achievement_types at ON at.id = al.achievement_type_id
  WHERE at.emoji IN ('🏃', '🏃‍♀️', '🏁', '🏃‍♂️');
  
  RAISE NOTICE 'Cleanup completed! Remaining running achievements: %', remaining_count;
END $$;

