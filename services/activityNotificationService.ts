/**
 * Activity Notification Service
 * Handles creation of activity-based notifications:
 * - Weekly average steps
 * - Top percentage achievements
 * - Goal streaks
 * - Weekly goal achievements
 */

import { supabase } from '../lib/supabase';
import { getStepData } from './stepService';
import { sendPushNotification } from './pushNotificationService';
import { getUserPreferences } from '../lib/userPreferences';

export interface ActivityNotificationMetadata {
  weekly_average?: {
    avg_steps: number;
    previous_week_avg: number;
    difference: number;
    week_start: string;
    week_end: string;
  };
  top_percentage?: {
    global_percentage: number;
    country_percentage: number | null;
    steps: number;
    date: string;
    country: string | null;
  };
  goal_streak?: {
    streak_days: number;
    goal: number;
  };
  weekly_goal?: {
    avg_steps: number;
    goal: number;
    difference: number;
  };
}

/**
 * Get Monday of a given week (ISO week)
 */
function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
}

/**
 * Get Sunday of a given week
 */
function getSundayOfWeek(date: Date): Date {
  const monday = getMondayOfWeek(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return sunday;
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Check if activity notifications are enabled for a user
 */
export const areActivityNotificationsEnabled = async (
  userId: string | null,
  notificationType: 'weekly_average' | 'top_percentage' | 'goal_streak' | 'weekly_goal'
): Promise<boolean> => {
  try {
    if (!userId) return false;

    const { data, error } = await supabase
      .from('user_profiles')
      .select('activity_notifications_enabled, weekly_average_notifications_enabled, top_percentage_notifications_enabled, goal_streak_notifications_enabled, weekly_goal_notifications_enabled')
      .eq('id', userId)
      .single();

    if (error || !data) return false;

    // Check master toggle
    if (data.activity_notifications_enabled === false) return false;

    // Check specific notification type
    switch (notificationType) {
      case 'weekly_average':
        return data.weekly_average_notifications_enabled !== false;
      case 'top_percentage':
        return data.top_percentage_notifications_enabled !== false;
      case 'goal_streak':
        return data.goal_streak_notifications_enabled !== false;
      case 'weekly_goal':
        return data.weekly_goal_notifications_enabled !== false;
      default:
        return false;
    }
  } catch (err) {
    console.error('Error checking activity notifications enabled:', err);
    return false;
  }
};

/**
 * Check if a notification of a specific type already exists for a user
 */
const notificationExists = async (
  userId: string,
  type: 'weekly_average' | 'top_percentage' | 'goal_streak' | 'weekly_goal',
  dateKey: string // e.g., week_start date, yesterday date, etc.
): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('type', type)
      .limit(1);

    if (error) {
      console.error('Error checking existing notification:', error);
      return false;
    }

    if (!data || data.length === 0) return false;

    // Check metadata to see if it's for the same period
    // We'll need to fetch the full notification to check metadata
    const { data: fullData } = await supabase
      .from('notifications')
      .select('metadata')
      .eq('user_id', userId)
      .eq('type', type)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!fullData || !fullData.metadata) return false;

    const metadata = fullData.metadata as ActivityNotificationMetadata;

    // Check based on type
    if (type === 'weekly_average' && metadata.weekly_average) {
      return metadata.weekly_average.week_start === dateKey;
    }
    if (type === 'top_percentage' && metadata.top_percentage) {
      return metadata.top_percentage.date === dateKey;
    }
    if (type === 'goal_streak' && metadata.goal_streak) {
      // For streaks, check if there's a notification from today
      const today = formatDate(new Date());
      const { data: todayNotif } = await supabase
        .from('notifications')
        .select('created_at')
        .eq('user_id', userId)
        .eq('type', 'goal_streak')
        .gte('created_at', `${today}T00:00:00`)
        .lt('created_at', `${today}T23:59:59`)
        .limit(1);
      return (todayNotif && todayNotif.length > 0);
    }
    if (type === 'weekly_goal' && metadata.weekly_goal) {
      // Check if notification exists for this week
      const today = new Date();
      const lastMonday = getMondayOfWeek(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000));
      const lastWeekStart = formatDate(lastMonday);
      return metadata.weekly_goal && dateKey === lastWeekStart;
    }

    return false;
  } catch (err) {
    console.error('Error in notificationExists:', err);
    return false;
  }
};

/**
 * Create a weekly average notification
 * Checks last week's average and compares to previous week
 */
export const checkAndCreateWeeklyAverageNotification = async (
  userId: string
): Promise<{ created: boolean; error: any }> => {
  try {
    // Check if enabled
    const enabled = await areActivityNotificationsEnabled(userId, 'weekly_average');
    if (!enabled) {
      return { created: false, error: null };
    }

    const today = new Date();
    const lastMonday = getMondayOfWeek(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000));
    const lastSunday = getSundayOfWeek(lastMonday);
    const previousMonday = new Date(lastMonday);
    previousMonday.setDate(lastMonday.getDate() - 7);
    const previousSunday = getSundayOfWeek(previousMonday);

    const lastWeekStart = formatDate(lastMonday);
    const lastWeekEnd = formatDate(lastSunday);
    const previousWeekStart = formatDate(previousMonday);
    const previousWeekEnd = formatDate(previousSunday);

    // Check if notification already exists for this week
    const exists = await notificationExists(userId, 'weekly_average', lastWeekStart);
    if (exists) {
      return { created: false, error: null };
    }

    // Get step data for last week
    const { data: lastWeekData, error: lastWeekError } = await getStepData(userId, lastWeekStart, lastWeekEnd);
    if (lastWeekError || !lastWeekData || lastWeekData.length === 0) {
      return { created: false, error: lastWeekError };
    }

    // Calculate average for last week
    const lastWeekTotal = lastWeekData.reduce((sum, entry) => sum + entry.steps, 0);
    const lastWeekAvg = Math.round(lastWeekTotal / lastWeekData.length);

    // Get step data for previous week
    const { data: previousWeekData, error: previousWeekError } = await getStepData(userId, previousWeekStart, previousWeekEnd);
    
    let previousWeekAvg = 0;
    let difference = lastWeekAvg;
    
    if (!previousWeekError && previousWeekData && previousWeekData.length > 0) {
      const previousWeekTotal = previousWeekData.reduce((sum, entry) => sum + entry.steps, 0);
      previousWeekAvg = Math.round(previousWeekTotal / previousWeekData.length);
      difference = lastWeekAvg - previousWeekAvg;
    }

    // Only create notification if there's meaningful data
    if (lastWeekAvg === 0) {
      return { created: false, error: null };
    }

    // Create notification
    const metadata: ActivityNotificationMetadata = {
      weekly_average: {
        avg_steps: lastWeekAvg,
        previous_week_avg: previousWeekAvg,
        difference: difference,
        week_start: lastWeekStart,
        week_end: lastWeekEnd,
      },
    };

    const { error: insertError } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'weekly_average',
        post_id: null,
        actor_id: null, // System-generated
        comment_id: null,
        metadata: metadata,
      });

    if (insertError) {
      console.error('Error creating weekly average notification:', insertError);
      return { created: false, error: insertError };
    }

    // Send push notification
    try {
      const preferences = await getUserPreferences(userId);
      const language = (preferences.language || 'nb') as 'nb' | 'en';
      await sendPushNotification(userId, 'weekly_average', metadata, language);
    } catch (pushError) {
      console.error('Error sending push notification for weekly average:', pushError);
      // Don't fail the whole operation if push notification fails
    }

    return { created: true, error: null };
  } catch (err: any) {
    console.error('Error in checkAndCreateWeeklyAverageNotification:', err);
    return { created: false, error: err };
  }
};

/**
 * Create a top percentage notification
 * Checks yesterday's ranking globally and by country
 */
export const checkAndCreateTopPercentageNotification = async (
  userId: string
): Promise<{ created: boolean; error: any }> => {
  try {
    // Check if enabled
    const enabled = await areActivityNotificationsEnabled(userId, 'top_percentage');
    if (!enabled) {
      return { created: false, error: null };
    }

    // Get yesterday's date
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = formatDate(yesterday);

    // Check if notification already exists for yesterday
    const exists = await notificationExists(userId, 'top_percentage', yesterdayStr);
    if (exists) {
      return { created: false, error: null };
    }

    // Get global ranking for yesterday
    const { data: allUsersData, error: rankingError } = await supabase
      .rpc('get_global_step_ranking', { target_date: yesterdayStr });

    if (rankingError || !allUsersData || allUsersData.length < 20) {
      // Minimum 20 users required
      return { created: false, error: rankingError };
    }

    // Find user's data
    const userData = allUsersData.find((d: { user_id: string; steps: number }) => d.user_id === userId);
    if (!userData || userData.steps === 0) {
      return { created: false, error: null };
    }

    // Calculate global percentage
    const userIndex = allUsersData.findIndex((d: { user_id: string; steps: number }) => d.user_id === userId);
    const rank = userIndex + 1;
    const totalUsers = allUsersData.length;
    const globalPercentage = Math.round((rank / totalUsers) * 100);

    // Only notify if in top 25%
    if (globalPercentage > 25) {
      return { created: false, error: null };
    }

    // Get user's country code
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('country_code')
      .eq('id', userId)
      .single();

    let countryPercentage: number | null = null;
    let country: string | null = userProfile?.country_code || null;

    // Calculate country percentage if country code exists
    if (country) {
      // Get all users with same country code for yesterday
      const { data: countryUsersData } = await supabase
        .from('step_data')
        .select('user_id, steps')
        .eq('date', yesterdayStr)
        .not('user_id', 'is', null);

      if (countryUsersData && countryUsersData.length > 0) {
        // Get country codes for these users
        const userIds = countryUsersData.map(d => d.user_id);
        const { data: countryProfiles } = await supabase
          .from('user_profiles')
          .select('id, country_code')
          .in('id', userIds)
          .eq('country_code', country);

        if (countryProfiles && countryProfiles.length >= 4) {
          // Minimum 4 users for meaningful percentage (top 25% = 1 user)
          const countryUserIds = countryProfiles.map(p => p.id);
          const countrySteps = countryUsersData
            .filter(d => countryUserIds.includes(d.user_id))
            .sort((a, b) => b.steps - a.steps);

          const countryUserIndex = countrySteps.findIndex(d => d.user_id === userId);
          if (countryUserIndex !== -1) {
            const countryRank = countryUserIndex + 1;
            countryPercentage = Math.round((countryRank / countrySteps.length) * 100);
          }
        }
      }
    }

    // Create notification
    const metadata: ActivityNotificationMetadata = {
      top_percentage: {
        global_percentage: globalPercentage,
        country_percentage: countryPercentage,
        steps: userData.steps,
        date: yesterdayStr,
        country: country,
      },
    };

    const { error: insertError } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'top_percentage',
        post_id: null,
        actor_id: null,
        comment_id: null,
        metadata: metadata,
      });

    if (insertError) {
      console.error('Error creating top percentage notification:', insertError);
      return { created: false, error: insertError };
    }

    // Send push notification
    try {
      const preferences = await getUserPreferences(userId);
      const language = (preferences.language || 'nb') as 'nb' | 'en';
      await sendPushNotification(userId, 'top_percentage', metadata, language);
    } catch (pushError) {
      console.error('Error sending push notification for top percentage:', pushError);
      // Don't fail the whole operation if push notification fails
    }

    return { created: true, error: null };
  } catch (err: any) {
    console.error('Error in checkAndCreateTopPercentageNotification:', err);
    return { created: false, error: err };
  }
};

/**
 * Create a goal streak notification
 * Checks how many consecutive days user has reached their goal
 */
export const checkAndCreateGoalStreakNotification = async (
  userId: string
): Promise<{ created: boolean; error: any }> => {
  try {
    // Check if enabled
    const enabled = await areActivityNotificationsEnabled(userId, 'goal_streak');
    if (!enabled) {
      return { created: false, error: null };
    }

    // Get user's daily goal
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('daily_step_goal')
      .eq('id', userId)
      .single();

    if (profileError || !userProfile || !userProfile.daily_step_goal) {
      return { created: false, error: profileError };
    }

    const goal = userProfile.daily_step_goal;

    // Check if notification already exists for today
    const today = formatDate(new Date());
    const exists = await notificationExists(userId, 'goal_streak', today);
    if (exists) {
      return { created: false, error: null };
    }

    // Calculate streak by checking days backwards
    let streak = 0;
    const todayDate = new Date();
    
    for (let day = 0; day < 365; day++) {
      const checkDate = new Date(todayDate);
      checkDate.setDate(todayDate.getDate() - day);
      const dateStr = formatDate(checkDate);

      const { data: stepData } = await getStepData(userId, dateStr, dateStr);
      
      if (!stepData || stepData.length === 0) {
        break; // No data for this day, streak ends
      }

      const daySteps = stepData.reduce((sum, entry) => sum + entry.steps, 0);
      
      if (daySteps >= goal) {
        streak++;
      } else {
        break; // Goal not reached, streak ends
      }
    }

    // Only notify if streak is 3 or more days
    if (streak < 3) {
      return { created: false, error: null };
    }

    // Check if streak has increased (only notify on milestone days: 3, 7, 14, 30, etc.)
    const milestones = [3, 7, 14, 30, 60, 90, 180, 365];
    const isMilestone = milestones.includes(streak);
    
    // Also notify if it's a new streak (check yesterday's streak)
    if (!isMilestone) {
      // Check if we notified yesterday
      const yesterday = new Date(todayDate);
      yesterday.setDate(todayDate.getDate() - 1);
      const yesterdayStr = formatDate(yesterday);
      
      // Check if notification exists for yesterday with same or lower streak
      const { data: yesterdayNotif } = await supabase
        .from('notifications')
        .select('metadata')
        .eq('user_id', userId)
        .eq('type', 'goal_streak')
        .gte('created_at', `${yesterdayStr}T00:00:00`)
        .lt('created_at', `${yesterdayStr}T23:59:59`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (yesterdayNotif && yesterdayNotif.metadata) {
        const yesterdayMetadata = yesterdayNotif.metadata as ActivityNotificationMetadata;
        if (yesterdayMetadata.goal_streak && yesterdayMetadata.goal_streak.streak_days >= streak) {
          // Streak hasn't increased, don't notify
          return { created: false, error: null };
        }
      }
    }

    // Create notification
    const metadata: ActivityNotificationMetadata = {
      goal_streak: {
        streak_days: streak,
        goal: goal,
      },
    };

    const { error: insertError } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'goal_streak',
        post_id: null,
        actor_id: null,
        comment_id: null,
        metadata: metadata,
      });

    if (insertError) {
      console.error('Error creating goal streak notification:', insertError);
      return { created: false, error: insertError };
    }

    // Send push notification
    try {
      const preferences = await getUserPreferences(userId);
      const language = (preferences.language || 'nb') as 'nb' | 'en';
      await sendPushNotification(userId, 'goal_streak', metadata, language);
    } catch (pushError) {
      console.error('Error sending push notification for goal streak:', pushError);
      // Don't fail the whole operation if push notification fails
    }

    return { created: true, error: null };
  } catch (err: any) {
    console.error('Error in checkAndCreateGoalStreakNotification:', err);
    return { created: false, error: err };
  }
};

/**
 * Create a weekly goal notification
 * Checks if last week's average exceeded daily goal
 */
export const checkAndCreateWeeklyGoalNotification = async (
  userId: string
): Promise<{ created: boolean; error: any }> => {
  try {
    // Check if enabled
    const enabled = await areActivityNotificationsEnabled(userId, 'weekly_goal');
    if (!enabled) {
      return { created: false, error: null };
    }

    // Get user's daily goal
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('daily_step_goal')
      .eq('id', userId)
      .single();

    if (profileError || !userProfile || !userProfile.daily_step_goal) {
      return { created: false, error: profileError };
    }

    const goal = userProfile.daily_step_goal;

    // Get last week's dates
    const today = new Date();
    const lastMonday = getMondayOfWeek(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000));
    const lastSunday = getSundayOfWeek(lastMonday);
    const lastWeekStart = formatDate(lastMonday);

    // Check if notification already exists for this week
    const exists = await notificationExists(userId, 'weekly_goal', lastWeekStart);
    if (exists) {
      return { created: false, error: null };
    }

    // Get step data for last week
    const { data: lastWeekData, error: lastWeekError } = await getStepData(
      userId,
      formatDate(lastMonday),
      formatDate(lastSunday)
    );

    if (lastWeekError || !lastWeekData || lastWeekData.length === 0) {
      return { created: false, error: lastWeekError };
    }

    // Calculate average for last week
    const lastWeekTotal = lastWeekData.reduce((sum, entry) => sum + entry.steps, 0);
    const lastWeekAvg = Math.round(lastWeekTotal / lastWeekData.length);

    // Only notify if average exceeds goal
    if (lastWeekAvg < goal) {
      return { created: false, error: null };
    }

    const difference = lastWeekAvg - goal;

    // Create notification
    const metadata: ActivityNotificationMetadata = {
      weekly_goal: {
        avg_steps: lastWeekAvg,
        goal: goal,
        difference: difference,
      },
    };

    const { error: insertError } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'weekly_goal',
        post_id: null,
        actor_id: null,
        comment_id: null,
        metadata: metadata,
      });

    if (insertError) {
      console.error('Error creating weekly goal notification:', insertError);
      return { created: false, error: insertError };
    }

    // Send push notification
    try {
      const preferences = await getUserPreferences(userId);
      const language = (preferences.language || 'nb') as 'nb' | 'en';
      await sendPushNotification(userId, 'weekly_goal', metadata, language);
    } catch (pushError) {
      console.error('Error sending push notification for weekly goal:', pushError);
      // Don't fail the whole operation if push notification fails
    }

    return { created: true, error: null };
  } catch (err: any) {
    console.error('Error in checkAndCreateWeeklyGoalNotification:', err);
    return { created: false, error: err };
  }
};

/**
 * Check and create all activity notifications for a user
 * Call this when app opens or periodically
 */
export const checkAndCreateAllActivityNotifications = async (
  userId: string
): Promise<{ created: number; errors: any[] }> => {
  const results = {
    created: 0,
    errors: [] as any[],
  };

  try {
    // Check all notification types
    const [weeklyAvg, topPercent, goalStreak, weeklyGoal] = await Promise.all([
      checkAndCreateWeeklyAverageNotification(userId),
      checkAndCreateTopPercentageNotification(userId),
      checkAndCreateGoalStreakNotification(userId),
      checkAndCreateWeeklyGoalNotification(userId),
    ]);

    if (weeklyAvg.created) results.created++;
    if (weeklyAvg.error) results.errors.push(weeklyAvg.error);

    if (topPercent.created) results.created++;
    if (topPercent.error) results.errors.push(topPercent.error);

    if (goalStreak.created) results.created++;
    if (goalStreak.error) results.errors.push(goalStreak.error);

    if (weeklyGoal.created) results.created++;
    if (weeklyGoal.error) results.errors.push(weeklyGoal.error);

    return results;
  } catch (err: any) {
    console.error('Error in checkAndCreateAllActivityNotifications:', err);
    results.errors.push(err);
    return results;
  }
};

