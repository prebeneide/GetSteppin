-- Migration Check Script
-- Kjør denne i Supabase SQL Editor for å sjekke hvilke migreringer som mangler
-- Dette er en hjelpefil - ikke en faktisk migrering

-- 1. Sjekk alle tabeller
SELECT 
  'TABLES' as check_type,
  table_name as item_name,
  CASE 
    WHEN table_name IN (
      'user_profiles', 'friendships', 'step_data', 'achievement_types', 
      'user_achievements', 'achievement_log', 'device_settings', 'walks',
      'posts', 'post_likes', 'post_comments', 'comment_likes', 'messages',
      'notifications', 'push_notification_tokens'
    ) THEN '✅ EXISTS'
    ELSE '⚠️ UNKNOWN'
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 2. Sjekk viktige kolonner i user_profiles
SELECT 
  'COLUMNS' as check_type,
  'user_profiles.' || column_name as item_name,
  CASE 
    WHEN column_name IN (
      'email', 'avatar_url', 'bio', 'enable_walk_tracking', 'auto_share_walks',
      'home_area_radius_meters', 'home_latitude', 'home_longitude',
      'min_walk_distance_meters', 'min_walk_speed_kmh', 'max_walk_speed_kmh',
      'pause_tolerance_minutes', 'pause_radius_meters', 'language', 'distance_unit',
      'phone_number', 'country_code', 'activity_notifications_enabled',
      'weekly_average_notifications_enabled', 'top_percentage_notifications_enabled',
      'goal_streak_notifications_enabled', 'weekly_goal_notifications_enabled'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND table_schema = 'public'
AND column_name IN (
  'email', 'avatar_url', 'bio', 'enable_walk_tracking', 'auto_share_walks',
  'home_area_radius_meters', 'home_latitude', 'home_longitude',
  'min_walk_distance_meters', 'min_walk_speed_kmh', 'max_walk_speed_kmh',
  'pause_tolerance_minutes', 'pause_radius_meters', 'language', 'distance_unit',
  'phone_number', 'country_code', 'activity_notifications_enabled',
  'weekly_average_notifications_enabled', 'top_percentage_notifications_enabled',
  'goal_streak_notifications_enabled', 'weekly_goal_notifications_enabled'
)
ORDER BY column_name;

-- 3. Sjekk viktige kolonner i notifications
SELECT 
  'COLUMNS' as check_type,
  'notifications.' || column_name as item_name,
  CASE 
    WHEN column_name IN ('comment_id', 'metadata') THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status
FROM information_schema.columns 
WHERE table_name = 'notifications' 
AND table_schema = 'public'
AND column_name IN ('comment_id', 'metadata')
ORDER BY column_name;

-- 4. Sjekk notifications type constraint
SELECT 
  'CONSTRAINT' as check_type,
  'notifications.type_check' as item_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM information_schema.check_constraints 
      WHERE constraint_name = 'notifications_type_check'
      AND check_clause LIKE '%weekly_average%'
    ) THEN '✅ INCLUDES ACTIVITY TYPES'
    ELSE '❌ MISSING ACTIVITY TYPES'
  END as status;

-- 5. Sjekk funksjoner
SELECT 
  'FUNCTIONS' as check_type,
  routine_name as item_name,
  '✅ EXISTS' as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_type = 'FUNCTION'
AND routine_name IN ('get_email_by_username', 'get_global_step_ranking', 'get_friend_posts')
ORDER BY routine_name;

-- 6. Sjekk storage buckets (må sjekkes manuelt i Storage-seksjonen)
-- Gå til Storage i Supabase Dashboard og sjekk:
-- - avatars (016)
-- - posts (041)

