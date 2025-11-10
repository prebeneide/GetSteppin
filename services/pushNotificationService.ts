/**
 * Push Notification Service
 * Handles registration and management of push notification tokens
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { getDeviceId } from '../lib/deviceId';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface PushNotificationToken {
  id: string;
  user_id: string;
  token: string;
  device_id: string | null;
  platform: 'ios' | 'android' | 'web';
  created_at: string;
  updated_at: string;
}

/**
 * Request notification permissions
 */
export const requestNotificationPermissions = async (): Promise<boolean> => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch (err) {
    console.error('Error requesting notification permissions:', err);
    return false;
  }
};

/**
 * Get push notification token
 */
export const getPushNotificationToken = async (): Promise<string | null> => {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('Notification permissions not granted');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '209447ea-d2c2-47f0-bfd4-e5c351a8560e', // From app.json
    });

    return tokenData.data;
  } catch (err) {
    console.error('Error getting push notification token:', err);
    return null;
  }
};

/**
 * Register push notification token for a user
 */
export const registerPushToken = async (
  userId: string,
  token: string
): Promise<{ error: any }> => {
  try {
    const deviceId = await getDeviceId();
    const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

    // Check if token already exists
    const { data: existing, error: checkError } = await supabase
      .from('push_notification_tokens')
      .select('id')
      .eq('user_id', userId)
      .eq('token', token)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 means no rows found, which is fine
      console.error('Error checking existing token:', checkError);
      return { error: checkError };
    }

    if (existing) {
      // Token already exists, just update updated_at
      const { error: updateError } = await supabase
        .from('push_notification_tokens')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', existing.id);

      if (updateError) {
        console.error('Error updating token:', updateError);
        return { error: updateError };
      }

      return { error: null };
    }

    // Insert new token
    const { error: insertError } = await supabase
      .from('push_notification_tokens')
      .insert({
        user_id: userId,
        token: token,
        device_id: deviceId,
        platform: platform,
      });

    if (insertError) {
      console.error('Error inserting push token:', insertError);
      return { error: insertError };
    }

    return { error: null };
  } catch (err: any) {
    console.error('Error in registerPushToken:', err);
    return { error: err };
  }
};

/**
 * Unregister push notification token for a user
 */
export const unregisterPushToken = async (
  userId: string,
  token: string
): Promise<{ error: any }> => {
  try {
    const { error } = await supabase
      .from('push_notification_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('token', token);

    if (error) {
      console.error('Error deleting push token:', error);
      return { error };
    }

    return { error: null };
  } catch (err: any) {
    console.error('Error in unregisterPushToken:', err);
    return { error: err };
  }
};

/**
 * Get all push tokens for a user
 */
export const getUserPushTokens = async (
  userId: string
): Promise<{ data: PushNotificationToken[] | null; error: any }> => {
  try {
    const { data, error } = await supabase
      .from('push_notification_tokens')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching push tokens:', error);
      return { data: null, error };
    }

    return { data: data || [], error: null };
  } catch (err: any) {
    console.error('Error in getUserPushTokens:', err);
    return { data: null, error: err };
  }
};

/**
 * Setup notification listeners
 */
export const setupNotificationListeners = (
  onNotificationReceived: (notification: Notifications.Notification) => void,
  onNotificationTapped: (notification: Notifications.NotificationResponse) => void
) => {
  // Listener for notifications received while app is in foreground
  const receivedListener = Notifications.addNotificationReceivedListener(onNotificationReceived);

  // Listener for when user taps on a notification
  const responseListener = Notifications.addNotificationResponseReceivedListener(onNotificationTapped);

  return () => {
    Notifications.removeNotificationSubscription(receivedListener);
    Notifications.removeNotificationSubscription(responseListener);
  };
};

/**
 * Send push notification to user's devices
 * Uses Expo Push Notification API
 */
export const sendPushNotification = async (
  userId: string,
  type: string,
  metadata: any,
  language: 'nb' | 'en' = 'nb'
): Promise<{ sent: number; errors: any[] }> => {
  const results = {
    sent: 0,
    errors: [] as any[],
  };

  try {
    // Get user's push tokens
    const { data: tokens, error: tokensError } = await getUserPushTokens(userId);
    
    if (tokensError || !tokens || tokens.length === 0) {
      console.log('No push tokens found for user:', userId);
      return results;
    }

    // Format notification message
    const { title, body } = formatNotificationMessage(type, metadata, language);

    // Send to all user's devices
    const messages = tokens.map(token => ({
      to: token.token,
      sound: 'default',
      title: title,
      body: body,
      data: {
        type: type,
        metadata: metadata,
        userId: userId,
      },
      badge: 1, // Show badge on app icon
    }));

    // Send via Expo Push Notification API
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error sending push notifications:', errorText);
      results.errors.push(new Error(`HTTP ${response.status}: ${errorText}`));
      return results;
    }

    const result = await response.json();
    
    // Count successful sends
    if (Array.isArray(result.data)) {
      result.data.forEach((item: any) => {
        if (item.status === 'ok') {
          results.sent++;
        } else {
          results.errors.push(new Error(item.message || 'Unknown error'));
        }
      });
    }

    console.log(`✅ Sent ${results.sent} push notification(s) to user ${userId}`);
    return results;
  } catch (err: any) {
    console.error('Error in sendPushNotification:', err);
    results.errors.push(err);
    return results;
  }
};

/**
 * Format notification message based on notification type and metadata
 */
export const formatNotificationMessage = (
  type: string,
  metadata: any,
  language: 'nb' | 'en' = 'nb'
): { title: string; body: string } => {
  if (type === 'weekly_average' && metadata?.weekly_average) {
    const { avg_steps, difference } = metadata.weekly_average;
    return {
      title: language === 'en' ? 'Weekly Summary' : 'Ukentlig oppsummering',
      body:
        language === 'en'
          ? `You walked on avg ${avg_steps.toLocaleString()} steps per day last week. ${Math.abs(difference).toLocaleString()} daily steps ${difference >= 0 ? 'more' : 'less'} than the week before.`
          : `Du gikk i gjennomsnitt ${avg_steps.toLocaleString()} skritt per dag forrige uke. ${Math.abs(difference).toLocaleString()} daglige skritt ${difference >= 0 ? 'mer' : 'mindre'} enn uken før.`,
    };
  }

  if (type === 'top_percentage' && metadata?.top_percentage) {
    const { global_percentage, country_percentage, steps, country } = metadata.top_percentage;
    const countryText =
      country_percentage && country
        ? language === 'en'
          ? ` and top ${country_percentage}% in ${country}`
          : ` og topp ${country_percentage}% i ${country}`
        : '';
    return {
      title: language === 'en' ? 'Top Achievement!' : 'Topp prestasjon!',
      body:
        language === 'en'
          ? `Wow! You were in the top ${global_percentage}% of all GetSteppin users${countryText} with ${steps.toLocaleString()} steps yesterday!`
          : `Wow! Du var i topp ${global_percentage}% av alle GetSteppin-brukere${countryText} med ${steps.toLocaleString()} skritt i går!`,
    };
  }

  if (type === 'goal_streak' && metadata?.goal_streak) {
    const { streak_days, goal } = metadata.goal_streak;
    return {
      title: language === 'en' ? 'Goal Streak!' : 'Mål-streak!',
      body:
        language === 'en'
          ? `Nailed it! You're on a ${streak_days} day streak for your goal of ${goal.toLocaleString()} steps!`
          : `Nailed it! Du er på en ${streak_days} dagers streak for målet ditt på ${goal.toLocaleString()} skritt!`,
    };
  }

  if (type === 'weekly_goal' && metadata?.weekly_goal) {
    const { avg_steps, difference } = metadata.weekly_goal;
    return {
      title: language === 'en' ? 'Weekly Goal Achieved!' : 'Ukentlig mål oppnådd!',
      body:
        language === 'en'
          ? `Nice! You walked on avg ${avg_steps.toLocaleString()} steps per day last week. ${difference.toLocaleString()} daily steps more than your goal.`
          : `Nice! Du gikk i gjennomsnitt ${avg_steps.toLocaleString()} skritt per dag forrige uke. ${difference.toLocaleString()} daglige skritt mer enn målet ditt.`,
    };
  }

  // Default fallback
  return {
    title: language === 'en' ? 'New Notification' : 'Ny notifikasjon',
    body: language === 'en' ? 'You have a new notification' : 'Du har en ny notifikasjon',
  };
};

