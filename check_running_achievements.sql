-- Check for running achievements in achievement_log
SELECT 
  al.id,
  al.user_id,
  al.achievement_type_id,
  al.earned_at,
  al.metadata,
  at.emoji,
  at.name
FROM achievement_log al
JOIN achievement_types at ON at.id = al.achievement_type_id
WHERE at.emoji IN ('🏃', '🏃‍♀️', '🏁', '🏃‍♂️')
ORDER BY al.earned_at DESC
LIMIT 20;
