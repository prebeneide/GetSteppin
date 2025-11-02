import { supabase } from '../lib/supabase';

export interface StepDataEntry {
  date: string; // YYYY-MM-DD format
  steps: number;
  distance_meters: number;
}

/**
 * Calculate running distance based on speed
 * Returns the distance difference if speed indicates running/jogging (>= 8 km/h)
 */
const calculateRunningDistance = (
  previousDistance: number,
  currentDistance: number,
  previousUpdateTime: string | null,
  currentUpdateTime: string
): number => {
  if (!previousUpdateTime || previousDistance >= currentDistance) {
    return 0; // No previous data or negative change
  }

  try {
    const timeDiffMs = new Date(currentUpdateTime).getTime() - new Date(previousUpdateTime).getTime();
    
    // Check that time difference is reasonable (between 1 second and 1 hour for accuracy)
    if (timeDiffMs <= 0 || timeDiffMs > 60 * 60 * 1000) {
      return 0; // Invalid or too long time span
    }

    const distanceDiff = currentDistance - previousDistance;
    if (distanceDiff <= 0) {
      return 0; // No distance gained
    }

    // Calculate speed: distance per time
    const timeDiffHours = timeDiffMs / (1000 * 60 * 60); // Convert to hours
    const speedKmh = (distanceDiff / 1000) / timeDiffHours; // km/h

    // If speed >= 8 km/h (jogging or running), count this distance as running
    if (speedKmh >= 8) {
      return distanceDiff;
    }

    return 0; // Walking speed, not counted as running
  } catch (err) {
    console.error('Error calculating running distance:', err);
    return 0;
  }
};

/**
 * Save or update step data for a user or device for today
 * Supports both logged in users (userId) and anonymous users (deviceId)
 * Also tracks running distance (distance covered at >= 8 km/h) when app is active
 */
export const saveStepData = async (
  userId: string | null, 
  steps: number, 
  distanceMeters: number,
  deviceId?: string | null
): Promise<{ error: any }> => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const now = new Date().toISOString();

    // Determine if we're dealing with logged in user or anonymous
    const isLoggedIn = userId !== null && userId !== undefined && userId !== '';

    // Check if entry exists for today
    let query;
    
    if (isLoggedIn) {
      query = supabase
        .from('step_data')
        .select('id, distance_meters, running_distance_meters, updated_at')
        .eq('date', today)
        .eq('user_id', userId!);
    } else {
      // For anonymous users, check by device_id only (user_id should be null)
      if (!deviceId) {
        console.error('No deviceId provided for anonymous user');
        return { error: { message: 'Device ID required for anonymous users' } };
      }
      query = supabase
        .from('step_data')
        .select('id, distance_meters, running_distance_meters, updated_at')
        .eq('date', today)
        .eq('device_id', deviceId)
        .is('user_id', null);
    }

    const { data: existing, error: checkError } = await query.single();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 means no rows found, which is fine
      console.error('Error checking existing step data:', checkError);
      return { error: checkError };
    }

    // Calculate running distance increment if entry exists
    let runningDistanceIncrement = 0;
    let currentRunningDistance = 0;

    if (existing) {
      const previousDistance = existing.distance_meters || 0;
      const previousRunningDistance = existing.running_distance_meters || 0;
      const previousUpdateTime = existing.updated_at;

      // Calculate if this distance increment was at running speed
      runningDistanceIncrement = calculateRunningDistance(
        previousDistance,
        distanceMeters,
        previousUpdateTime,
        now
      );

      // Accumulate running distance
      currentRunningDistance = previousRunningDistance + runningDistanceIncrement;

      // Update existing entry
      const { error } = await supabase
        .from('step_data')
        .update({
          steps,
          distance_meters: distanceMeters,
          running_distance_meters: currentRunningDistance,
          updated_at: now,
        })
        .eq('id', existing.id);

      if (error) {
        console.error('Error updating step data:', error);
        return { error };
      }
    } else {
      // Insert new entry
      // For new entries, we can't calculate running distance yet (no previous data)
      // It will be calculated on next update
      const insertData: any = {
        date: today,
        steps,
        distance_meters: distanceMeters,
        running_distance_meters: 0, // Will be calculated on next update
      };

      if (isLoggedIn) {
        insertData.user_id = userId;
      } else {
        insertData.device_id = deviceId;
        insertData.user_id = null; // Explicitly set to null for anonymous users
      }

      const { error } = await supabase
        .from('step_data')
        .insert(insertData);

      if (error) {
        console.error('Error inserting step data:', error);
        return { error };
      }
    }

    return { error: null };
  } catch (err: any) {
    console.error('Error in saveStepData:', err);
    return { error: err };
  }
};

/**
 * Get step data for a user for a specific date range
 */
export const getStepData = async (
  userId: string,
  startDate: string,
  endDate: string
): Promise<{ data: StepDataEntry[] | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from('step_data')
      .select('date, steps, distance_meters')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) {
      console.error('Error getting step data:', error);
      return { data: null, error };
    }

    const formatted = (data || []).map(entry => ({
      date: entry.date,
      steps: entry.steps,
      distance_meters: entry.distance_meters,
    }));

    return { data: formatted, error: null };
  } catch (err: any) {
    console.error('Error in getStepData:', err);
    return { data: null, error: err };
  }
};

/**
 * Get today's step data for a user
 */
export const getTodayStepData = async (userId: string): Promise<{ data: StepDataEntry | null; error: any }> => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('step_data')
      .select('date, steps, distance_meters')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No data for today, return null (not an error)
        return { data: null, error: null };
      }
      console.error('Error getting today step data:', error);
      return { data: null, error };
    }

    return {
      data: {
        date: data.date,
        steps: data.steps,
        distance_meters: data.distance_meters,
      },
      error: null,
    };
  } catch (err: any) {
    console.error('Error in getTodayStepData:', err);
    return { data: null, error: err };
  }
};

/**
 * Get total lifetime steps for a user
 * Sums all steps from all dates in step_data
 */
export const getTotalSteps = async (userId: string): Promise<{ data: number | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from('step_data')
      .select('steps')
      .eq('user_id', userId);

    if (error) {
      console.error('Error getting total steps:', error);
      return { data: null, error };
    }

    // Sum all steps
    const totalSteps = (data || []).reduce((sum, entry) => sum + (entry.steps || 0), 0);

    return { data: totalSteps, error: null };
  } catch (err: any) {
    console.error('Error in getTotalSteps:', err);
    return { data: null, error: err };
  }
};

/**
 * Get total lifetime distance (in kilometers) for a user
 * Sums all distance_meters from all dates in step_data and converts to km
 */
export const getTotalDistanceKm = async (userId: string): Promise<{ data: number | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from('step_data')
      .select('distance_meters')
      .eq('user_id', userId);

    if (error) {
      console.error('Error getting total distance:', error);
      return { data: null, error };
    }

    // Sum all distances in meters and convert to km
    const totalDistanceMeters = (data || []).reduce((sum, entry) => sum + (entry.distance_meters || 0), 0);
    const totalDistanceKm = totalDistanceMeters / 1000;

    return { data: totalDistanceKm, error: null };
  } catch (err: any) {
    console.error('Error in getTotalDistanceKm:', err);
    return { data: null, error: err };
  }
};

