import { supabase } from '../lib/supabase';
import { getDeviceId } from '../lib/deviceId';
import * as Location from 'expo-location';

export interface WalkCoordinate {
  lat: number;
  lng: number;
  timestamp: string;
}

export interface Walk {
  id: string;
  user_id: string | null;
  device_id: string | null;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  distance_meters: number;
  steps: number;
  average_speed_kmh: number | null;
  max_speed_kmh: number | null;
  route_coordinates: WalkCoordinate[];
  start_location_lat: number | null;
  start_location_lng: number | null;
  end_location_lat: number | null;
  end_location_lng: number | null;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

export interface WalkWithPost extends Walk {
  post_id?: string;
  post_content?: string | null;
  post_image_url?: string | null;
  post_created_at?: string;
  likes_count?: number;
  comments_count?: number;
  is_liked?: boolean;
}

/**
 * Check if walk tracking is enabled for user
 */
export const isWalkTrackingEnabled = async (
  userId: string | null
): Promise<boolean> => {
  try {
    if (!userId) {
      // For anonymous users, check device settings or default to true
      return true; // Default enabled for anonymous
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('enable_walk_tracking')
      .eq('id', userId)
      .single();

    if (error || !data) {
      console.error('Error checking walk tracking setting:', error);
      return true; // Default enabled
    }

    return data.enable_walk_tracking !== false;
  } catch (err) {
    console.error('Error in isWalkTrackingEnabled:', err);
    return true; // Default enabled
  }
};

/**
 * Check if auto-share is enabled for user
 */
export const isAutoShareEnabled = async (
  userId: string | null
): Promise<boolean> => {
  try {
    if (!userId) {
      // For anonymous users, default to true
      return true;
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('auto_share_walks')
      .eq('id', userId)
      .single();

    if (error || !data) {
      console.error('Error checking auto-share setting:', error);
      return true; // Default enabled
    }

    return data.auto_share_walks !== false;
  } catch (err) {
    console.error('Error in isAutoShareEnabled:', err);
    return true; // Default enabled
  }
};

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Calculate total distance from coordinates array
 */
const calculateTotalDistance = (coordinates: WalkCoordinate[]): number => {
  if (coordinates.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 1; i < coordinates.length; i++) {
    totalDistance += calculateDistance(
      coordinates[i - 1].lat,
      coordinates[i - 1].lng,
      coordinates[i].lat,
      coordinates[i].lng
    );
  }
  return totalDistance;
};

/**
 * Calculate average and max speed from coordinates
 */
const calculateSpeed = (
  coordinates: WalkCoordinate[]
): { average: number; max: number } => {
  if (coordinates.length < 2) {
    return { average: 0, max: 0 };
  }

  const speeds: number[] = [];
  
  for (let i = 1; i < coordinates.length; i++) {
    const distance = calculateDistance(
      coordinates[i - 1].lat,
      coordinates[i - 1].lng,
      coordinates[i].lat,
      coordinates[i].lng
    );
    
    const timeDiff = new Date(coordinates[i].timestamp).getTime() - 
                     new Date(coordinates[i - 1].timestamp).getTime();
    
    if (timeDiff > 0) {
      const hours = timeDiff / (1000 * 60 * 60);
      const speed = distance / 1000 / hours; // km/h
      speeds.push(speed);
    }
  }

  if (speeds.length === 0) {
    return { average: 0, max: 0 };
  }

  const average = speeds.reduce((sum, s) => sum + s, 0) / speeds.length;
  const max = Math.max(...speeds);

  return { average, max };
};

/**
 * Save a walk to the database
 */
export const saveWalk = async (
  userId: string | null,
  deviceId: string | null,
  coordinates: WalkCoordinate[],
  steps: number
): Promise<{ data: Walk | null; error: any }> => {
  try {
    if (coordinates.length < 2) {
      return { data: null, error: { message: 'Not enough coordinates' } };
    }

    const startTime = coordinates[0].timestamp;
    const endTime = coordinates[coordinates.length - 1].timestamp;
    const startDate = new Date(startTime);
    const endDate = new Date(endTime);
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationMinutes = Math.floor(durationMs / (1000 * 60));

    if (durationMinutes <= 0) {
      return { data: null, error: { message: 'Invalid duration' } };
    }

    const distanceMeters = calculateTotalDistance(coordinates);
    
    if (distanceMeters < 1000) {
      // Less than 1km, don't save
      return { data: null, error: { message: 'Distance less than 1km' } };
    }

    const { average, max } = calculateSpeed(coordinates);

    // Check if auto-share is enabled
    const autoShare = await isAutoShareEnabled(userId);

    const insertData: any = {
      start_time: startTime,
      end_time: endTime,
      duration_minutes: durationMinutes,
      distance_meters: Math.round(distanceMeters),
      steps,
      average_speed_kmh: average > 0 ? parseFloat(average.toFixed(2)) : null,
      max_speed_kmh: max > 0 ? parseFloat(max.toFixed(2)) : null,
      route_coordinates: coordinates,
      start_location_lat: coordinates[0].lat,
      start_location_lng: coordinates[0].lng,
      end_location_lat: coordinates[coordinates.length - 1].lat,
      end_location_lng: coordinates[coordinates.length - 1].lng,
      is_shared: autoShare, // Auto-share if enabled
    };

    if (userId) {
      insertData.user_id = userId;
      insertData.device_id = null;
    } else if (deviceId) {
      insertData.device_id = deviceId;
      insertData.user_id = null;
    } else {
      return { data: null, error: { message: 'Either userId or deviceId required' } };
    }

    const { data, error } = await supabase
      .from('walks')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error saving walk:', error);
      return { data: null, error };
    }

    // If auto-share is enabled, create a post automatically
    if (autoShare && data && userId) {
      // Only logged-in users can create posts
      // Import dynamically to avoid circular dependency
      const { createPostFromWalk } = await import('./postService');
      await createPostFromWalk(data.id, userId, null, null).catch(err => {
        console.error('Error creating post from walk:', err);
        // Don't fail walk save if post creation fails
      });
    }

    return { data: data as Walk, error: null };
  } catch (err) {
    console.error('Error in saveWalk:', err);
    return { data: null, error: err };
  }
};

/**
 * Get walks for a user
 */
export const getUserWalks = async (
  userId: string | null,
  deviceId: string | null,
  limit: number = 50
): Promise<{ data: Walk[]; error: any }> => {
  try {
    let query = supabase
      .from('walks')
      .select('*')
      .order('start_time', { ascending: false })
      .limit(limit);

    if (userId) {
      query = query.eq('user_id', userId);
    } else if (deviceId) {
      query = query.eq('device_id', deviceId).is('user_id', null);
    } else {
      return { data: [], error: { message: 'Either userId or deviceId required' } };
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching user walks:', error);
      return { data: [], error };
    }

    return { data: (data || []) as Walk[], error: null };
  } catch (err) {
    console.error('Error in getUserWalks:', err);
    return { data: [], error: err };
  }
};

/**
 * Request location permissions
 */
export const requestLocationPermissions = async (): Promise<boolean> => {
  try {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    
    if (foregroundStatus !== 'granted') {
      return false;
    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    
    return backgroundStatus === 'granted';
  } catch (err) {
    console.error('Error requesting location permissions:', err);
    return false;
  }
};

/**
 * Check location permissions
 */
export const checkLocationPermissions = async (): Promise<{
  foreground: boolean;
  background: boolean;
}> => {
  try {
    const foregroundStatus = await Location.getForegroundPermissionsAsync();
    const backgroundStatus = await Location.getBackgroundPermissionsAsync();
    
    return {
      foreground: foregroundStatus.granted,
      background: backgroundStatus.granted,
    };
  } catch (err) {
    console.error('Error checking location permissions:', err);
    return { foreground: false, background: false };
  }
};

