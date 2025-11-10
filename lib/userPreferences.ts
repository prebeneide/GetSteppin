/**
 * User preferences utilities
 * Phase 1: Get user's distance unit preference
 */

import { supabase } from './supabase';
import { getDeviceId } from './deviceId';
import type { DistanceUnit } from './formatters';

export type { DistanceUnit };

export interface UserPreferences {
  language: string;
  distance_unit: DistanceUnit;
  phone_number?: string | null;
  country_code?: string | null;
}

/**
 * Get user preferences for distance unit and language
 * Returns default values if not logged in or preferences not set
 */
export const getUserPreferences = async (
  userId: string | null
): Promise<UserPreferences> => {
  try {
    if (!userId) {
      // For anonymous users, check device_settings
      const deviceId = await getDeviceId();
      console.log('[getUserPreferences] Loading preferences for anonymous user, deviceId:', deviceId);
      
      const { data, error } = await supabase
        .from('device_settings')
        .select('language, distance_unit')
        .eq('device_id', deviceId)
        .maybeSingle(); // Use maybeSingle() instead of single() to handle missing rows gracefully

      if (error) {
        console.warn('[getUserPreferences] Error loading device_settings:', error);
        // Return defaults on error
        return {
          language: 'nb',
          distance_unit: 'km',
        };
      }

      if (!data) {
        console.log('[getUserPreferences] No device_settings found, returning defaults');
        // Return defaults if no data
        return {
          language: 'nb',
          distance_unit: 'km',
        };
      }

      console.log('[getUserPreferences] Loaded from device_settings:', { language: data.language, distance_unit: data.distance_unit });
      return {
        language: data.language || 'nb',
        distance_unit: (data.distance_unit as DistanceUnit) || 'km',
      };
    }

    // For logged in users, check user_profiles
    const { data, error } = await supabase
      .from('user_profiles')
      .select('language, distance_unit, phone_number, country_code')
      .eq('id', userId)
      .single();

    if (error || !data) {
      // Return defaults
      return {
        language: 'nb',
        distance_unit: 'km',
      };
    }

    return {
      language: data.language || 'nb',
      distance_unit: (data.distance_unit as DistanceUnit) || 'km',
      phone_number: data.phone_number || null,
      country_code: data.country_code || null,
    };
  } catch (err) {
    console.error('Error loading user preferences:', err);
    // Return defaults on error
    return {
      language: 'nb',
      distance_unit: 'km',
    };
  }
};

