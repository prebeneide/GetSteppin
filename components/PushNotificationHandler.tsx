/**
 * Push Notification Handler Component
 * Handles push notification registration and listeners
 */

import React, { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getPushNotificationToken,
  registerPushToken,
} from '../services/pushNotificationService';
import * as Notifications from 'expo-notifications';
import { CommonActions } from '@react-navigation/native';

// We'll use a navigation ref that's set in App.tsx
let navigationRef: any = null;

export const setNavigationRef = (ref: any) => {
  navigationRef = ref;
};

export default function PushNotificationHandler() {
  const { user } = useAuth();
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  // Register push token when user logs in
  useEffect(() => {
    if (!user) {
      // User logged out - cleanup listeners
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
        notificationListener.current = null;
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
        responseListener.current = null;
      }
      return;
    }

    const registerToken = async () => {
      try {
        console.log('📱 Registering push notification token...');
        const token = await getPushNotificationToken();
        
        if (token) {
          console.log('✅ Got push token:', token.substring(0, 20) + '...');
          const { error } = await registerPushToken(user.id, token);
          if (error) {
            console.error('❌ Error registering push token:', error);
          } else {
            console.log('✅ Push token registered successfully');
          }
        } else {
          console.log('⚠️ No push token available (permissions not granted)');
        }
      } catch (err) {
        console.error('Error in registerToken:', err);
      }
    };

    registerToken();
  }, [user]);

  // Setup notification listeners
  useEffect(() => {
    if (!user) return;

    // Listener for notifications received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log('📬 Notification received:', notification);
      // Notification is automatically shown by our handler configuration
    });

    // Listener for when user taps on a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('👆 Notification tapped:', response);
      
      const notification = response.notification;
      const data = notification.request.content.data;

      // Navigate based on notification type
      if (navigationRef) {
        if (data?.type && ['like', 'comment', 'reply', 'comment_like'].includes(data.type) && data?.post_id) {
          // Social notification - navigate to post detail
          navigationRef.dispatch(
            CommonActions.navigate({
              name: 'Main',
              params: {
                screen: 'HomeTab',
                params: {
                  screen: 'HomeMain',
                  params: {
                    screen: 'PostDetail',
                    params: { postId: data.post_id },
                  },
                },
              },
            })
          );
        } else if (data?.type && ['weekly_average', 'top_percentage', 'goal_streak', 'weekly_goal'].includes(data.type)) {
          // Activity notification - navigate to notifications screen
          navigationRef.dispatch(
            CommonActions.navigate({
              name: 'Main',
              params: {
                screen: 'HomeTab',
                params: {
                  screen: 'HomeMain',
                  params: {
                    screen: 'Notifications',
                  },
                },
              },
            })
          );
        }
      }
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [user]);

  return null; // This component doesn't render anything
}

