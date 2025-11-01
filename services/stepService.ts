import { supabase } from '../lib/supabase';

export interface StepDataEntry {
  date: string; // YYYY-MM-DD format
  steps: number;
  distance_meters: number;
}

/**
 * Save or update step data for a user or device for today
 * Supports both logged in users (userId) and anonymous users (deviceId)
 */
export const saveStepData = async (
  userId: string | null, 
  steps: number, 
  distanceMeters: number,
  deviceId?: string | null
): Promise<{ error: any }> => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Determine if we're dealing with logged in user or anonymous
    const isLoggedIn = userId !== null && userId !== undefined && userId !== '';

    // Check if entry exists for today
    let query;
    
    if (isLoggedIn) {
      query = supabase
        .from('step_data')
        .select('id')
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
        .select('id')
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

    if (existing) {
      // Update existing entry
      const { error } = await supabase
        .from('step_data')
        .update({
          steps,
          distance_meters: distanceMeters,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) {
        console.error('Error updating step data:', error);
        return { error };
      }
    } else {
      // Insert new entry
      const insertData: any = {
        date: today,
        steps,
        distance_meters: distanceMeters,
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

