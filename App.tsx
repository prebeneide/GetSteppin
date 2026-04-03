import React, { useEffect, useState, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { setNavigationRef } from './components/PushNotificationHandler';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from './lib/supabase';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { initializeApp } from './services/initService';
import { getUnviewedWalksCount } from './services/walkService';
import { getDeviceId } from './lib/deviceId';
import { getUnreadMessagesCount } from './services/chatService';
import { useTranslation, LanguageProvider } from './lib/i18n';
import CustomSplashScreen from './components/SplashScreen';
import LoginScreen from './screens/LoginScreen';
import SignUpScreen from './screens/SignUpScreen';
import HomeScreen from './screens/HomeScreen';
import SettingsScreen from './screens/SettingsScreen';
import GoalSettingsScreen from './screens/GoalSettingsScreen';
import PasswordSettingsScreen from './screens/PasswordSettingsScreen';
import ProfileScreen from './screens/ProfileScreen';
import FriendsScreen from './screens/FriendsScreen';
import AddFriendScreen from './screens/AddFriendScreen';
import FriendProfileScreen from './screens/FriendProfileScreen';
import ChatScreen from './screens/ChatScreen';
import ChatListScreen from './screens/ChatListScreen';
import MyWalksScreen from './screens/MyWalksScreen';
import WalkDetailScreen from './screens/WalkDetailScreen';
import FeedScreen from './screens/FeedScreen';
import PostDetailScreen from './screens/PostDetailScreen';
import PostWalkDetailScreen from './screens/PostWalkDetailScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import PushNotificationHandler from './components/PushNotificationHandler';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Home Stack (includes Settings, Profile, etc.)
function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="GoalSettings" component={GoalSettingsScreen} />
      <Stack.Screen name="PasswordSettings" component={PasswordSettingsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
      <Stack.Screen name="PostWalkDetail" component={PostWalkDetailScreen} />
    </Stack.Navigator>
  );
}

// Walks Stack
function WalksStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MyWalksMain" component={MyWalksScreen} />
      <Stack.Screen name="WalkDetail" component={WalkDetailScreen} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
    </Stack.Navigator>
  );
}

// Feed Stack
function FeedStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FeedMain" component={FeedScreen} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
      <Stack.Screen name="PostWalkDetail" component={PostWalkDetailScreen} />
      <Stack.Screen name="WalkDetail" component={WalkDetailScreen} />
    </Stack.Navigator>
  );
}

// Messages Stack
function MessagesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ChatListMain" component={ChatListScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
    </Stack.Navigator>
  );
}

// Friends Stack
function FriendsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FriendsMain" component={FriendsScreen} />
      <Stack.Screen name="AddFriend" component={AddFriendScreen} />
      <Stack.Screen name="FriendProfile" component={FriendProfileScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
      <Stack.Screen name="PostWalkDetail" component={PostWalkDetailScreen} />
    </Stack.Navigator>
  );
}

// Main Tab Navigator
function MainTabs() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [unviewedWalksCount, setUnviewedWalksCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  // Load unviewed walks count
  const loadUnviewedCount = async () => {
    try {
      let deviceId: string | null = null;
      if (!user) {
        deviceId = await getDeviceId();
      }
      const count = await getUnviewedWalksCount(user?.id || null, deviceId);
      setUnviewedWalksCount(count);
    } catch (err) {
      console.error('Error loading unviewed walks count:', err);
    }
  };

  // Load unread messages count
  const loadUnreadMessagesCount = async () => {
    try {
      if (!user) {
        setUnreadMessagesCount(0);
        return;
      }
      const { data, error } = await getUnreadMessagesCount(user.id);
      if (error) {
        console.error('Error loading unread messages count:', error);
      } else {
        setUnreadMessagesCount(data);
      }
    } catch (err) {
      console.error('Error loading unread messages count:', err);
    }
  };

  // Load count on mount and when user changes, then subscribe to real-time updates
  useEffect(() => {
    loadUnviewedCount();
    loadUnreadMessagesCount();

    if (!user) return;

    // Subscribe to new walks being saved (increments walks badge in real-time)
    const walksChannel = supabase
      .channel(`unviewed-walks-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'walks', filter: `user_id=eq.${user.id}` },
        () => setUnviewedWalksCount(prev => prev + 1)
      )
      .subscribe();

    // Subscribe to new incoming messages (increments messages badge in real-time)
    const messagesChannel = supabase
      .channel(`unread-messages-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
        () => setUnreadMessagesCount(prev => prev + 1)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(walksChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, [user]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1ED760',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#e0e0e0',
          paddingTop: 5,
          height: 55 + insets.bottom,
          paddingBottom: insets.bottom,
        },
      }}
      screenListeners={{
        tabPress: (e) => {
          // Refresh count when tab is pressed
          if (e.target?.startsWith('WalksTab')) {
            loadUnviewedCount();
          } else if (e.target?.startsWith('MessagesTab')) {
            loadUnreadMessagesCount();
          }
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{
          tabBarLabel: t('navigation.home'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="WalksTab"
        component={WalksStack}
        listeners={{
          focus: () => {
            loadUnviewedCount();
          },
        }}
        options={{
          tabBarLabel: t('navigation.myWalks'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'footsteps' : 'footsteps-outline'} size={24} color={color} />
          ),
          tabBarBadge: unviewedWalksCount > 0 ? unviewedWalksCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#F44336',
            color: '#fff',
            fontSize: 12,
            fontWeight: 'bold',
          },
        }}
      />
      <Tab.Screen
        name="FeedTab"
        component={FeedStack}
        options={{
          tabBarLabel: t('navigation.feed'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'newspaper' : 'newspaper-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="MessagesTab"
        component={MessagesStack}
        listeners={{
          focus: () => {
            loadUnreadMessagesCount();
          },
        }}
        options={{
          tabBarLabel: t('navigation.messages'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={24} color={color} />
          ),
          tabBarBadge: unreadMessagesCount > 0 ? unreadMessagesCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#F44336',
            color: '#fff',
            fontSize: 12,
            fontWeight: 'bold',
          },
        }}
      />
      <Tab.Screen
        name="FriendsTab"
        component={FriendsStack}
        options={{
          tabBarLabel: t('navigation.friends'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Root Navigator (handles auth)
function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1ED760" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={(ref) => setNavigationRef(ref)}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          // User is logged in - show main tabs
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          // User is not logged in - require login
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Wrapper component to provide LanguageProvider with access to user
function AppWithLanguage() {
  const { user } = useAuth();
  
  return (
    <LanguageProvider user={user}>
      <RootNavigator />
    </LanguageProvider>
  );
}

// Keep the splash screen visible while we fetch resources
// Note: In Expo Go, native splash screen may not work, so we use custom component
try {
  SplashScreen.preventAutoHideAsync();
} catch (e) {
  console.log('⚠️ Could not prevent auto hide (expected in Expo Go):', e);
}

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await initializeApp();
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        console.warn('Error during app initialization:', e);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      // Small delay before hiding to ensure smooth transition
      await new Promise(resolve => setTimeout(resolve, 300));
      // This tells the splash screen to hide
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  // Show custom splash screen while app is loading
  // In Expo Go, native splash screen may not work, so we use custom component
  if (!appIsReady) {
    return (
      <View style={{ flex: 1 }}>
        <CustomSplashScreen />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <AuthProvider>
          <AppWithLanguage />
          <PushNotificationHandler />
        </AuthProvider>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
