-- Quick check: Has migration 058 been run?
-- Check if messages table has image_url column

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'messages' 
      AND column_name = 'image_url'
    ) THEN '✅ Migration 058 has been run - image_url column exists'
    ELSE '❌ Migration 058 NOT run - image_url column missing'
  END as migration_status;

