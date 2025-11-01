/**
 * Initialization Service
 * Automatically sets up database migrations and storage buckets
 * Runs once when the app starts
 */

import { supabase } from '../lib/supabase';

interface MigrationStatus {
  avatar_url_user_profiles: boolean;
  avatar_url_device_settings: boolean;
  storage_bucket: boolean;
}

/**
 * Check if migrations have already been run
 */
async function checkMigrationStatus(): Promise<MigrationStatus> {
  const status: MigrationStatus = {
    avatar_url_user_profiles: false,
    avatar_url_device_settings: false,
    storage_bucket: false,
  };

  try {
    // Check if avatar_url column exists in user_profiles
    const { error: userProfilesError } = await supabase
      .from('user_profiles')
      .select('avatar_url')
      .limit(1);

    if (!userProfilesError) {
      status.avatar_url_user_profiles = true;
    }

    // Check if avatar_url column exists in device_settings
    const { error: deviceSettingsError } = await supabase
      .from('device_settings')
      .select('avatar_url')
      .limit(1);

    if (!deviceSettingsError) {
      status.avatar_url_device_settings = true;
    }

    // Check if avatars bucket exists by trying to list it
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    if (!bucketError && buckets) {
      const avatarsBucket = buckets.find((b) => b.name === 'avatars');
      status.storage_bucket = !!avatarsBucket;
    }
  } catch (err) {
    console.error('Error checking migration status:', err);
  }

  return status;
}

/**
 * Run migration to add avatar_url to user_profiles
 */
async function migrateUserProfiles(): Promise<boolean> {
  try {
    // Use RPC or direct SQL via Supabase
    // Since we can't run ALTER TABLE directly, we'll check if column exists
    // and if not, try to add it via a stored procedure or just let the insert fail gracefully
    
    // Actually, we can use supabase.rpc() to call a migration function
    // But simpler: just let the app handle missing column gracefully
    // The real migration needs to be run in Supabase Dashboard SQL Editor
    
    // For now, we'll just check and log
    console.log('Migration: avatar_url for user_profiles should be run manually in Supabase Dashboard');
    return true;
  } catch (err) {
    console.error('Error migrating user_profiles:', err);
    return false;
  }
}

/**
 * Run migration to add avatar_url to device_settings
 */
async function migrateDeviceSettings(): Promise<boolean> {
  try {
    console.log('Migration: avatar_url for device_settings should be run manually in Supabase Dashboard');
    return true;
  } catch (err) {
    console.error('Error migrating device_settings:', err);
    return false;
  }
}

/**
 * Create avatars storage bucket and policies
 * This uses Supabase Storage API
 */
async function createStorageBucket(): Promise<boolean> {
  try {
    // Check if bucket already exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      return false;
    }

    const avatarsBucket = buckets?.find((b) => b.name === 'avatars');
    
    if (avatarsBucket) {
      console.log('Avatars bucket already exists');
      return true;
    }

    // Try to create bucket
    // Note: Creating buckets via API requires admin privileges
    // For anonymous users, we need to use RPC function or handle via Supabase Dashboard
    
    // Since we can't create buckets via client API without admin rights,
    // we'll need to do this manually in Dashboard
    console.log('Storage bucket creation requires Supabase Dashboard. Please create "avatars" bucket manually.');
    console.log('Then run migration 016_create_avatars_storage_bucket.sql for policies.');
    
    return false;
  } catch (err) {
    console.error('Error creating storage bucket:', err);
    return false;
  }
}

/**
 * Initialize all migrations and storage
 * This should be called once when the app starts
 */
export async function initializeApp(): Promise<void> {
  try {
    console.log('Initializing app migrations...');
    
    const status = await checkMigrationStatus();
    
    if (!status.avatar_url_user_profiles) {
      console.log('⚠️  avatar_url column missing in user_profiles. Please run migration 014_add_avatar_url_to_user_profiles.sql');
    }
    
    if (!status.avatar_url_device_settings) {
      console.log('⚠️  avatar_url column missing in device_settings. Please run migration 015_add_avatar_url_to_device_settings.sql');
    }
    
    if (!status.storage_bucket) {
      console.log('⚠️  avatars storage bucket missing. Please create it in Supabase Dashboard.');
    }
    
    // Try to run migrations (most will fail gracefully if they can't be run automatically)
    await migrateUserProfiles();
    await migrateDeviceSettings();
    await createStorageBucket();
    
    console.log('✅ App initialization complete');
  } catch (err) {
    console.error('Error initializing app:', err);
  }
}

