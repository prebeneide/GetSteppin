import React, { useEffect, useState, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { setNavigationRef } from './components/PushNotificationHandler';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
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

  // Load count on mount and when user changes
  useEffect(() => {
    loadUnviewedCount();
    loadUnreadMessagesCount();
    
    // Refresh count every 30 seconds
    const interval = setInterval(() => {
      loadUnviewedCount();
      loadUnreadMessagesCount();
    }, 30000);
    return () => clearInterval(interval);
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
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
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
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 24 }}>🏠</Text>
          ),
        }}
      />
      <Tab.Screen
        name="WalksTab"
        component={WalksStack}
        listeners={{
          focus: () => {
            // Refresh count when screen comes into focus
            loadUnviewedCount();
          },
        }}
        options={{
          tabBarLabel: t('navigation.myWalks'),
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 24 }}>👣</Text>
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
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 24 }}>📰</Text>
          ),
        }}
      />
      <Tab.Screen
        name="MessagesTab"
        component={MessagesStack}
        listeners={{
          focus: () => {
            // Refresh count when screen comes into focus
            loadUnreadMessagesCount();
          },
        }}
        options={{
          tabBarLabel: t('navigation.messages'),
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 24 }}>💬</Text>
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
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 24 }}>👥</Text>
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
          <>
            <Stack.Screen name="Main" component={MainTabs} />
          </>
        ) : (
          // User is not logged in - show auth screens
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
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
      console.log('🚀 App starting - showing splash screen');
      console.log('📱 appIsReady:', appIsReady);
      
      try {
        // Initialize migrations and storage on app start
        console.log('⏳ Initializing app...');
        await initializeApp();
        console.log('✅ App initialized');
        
        // Add a minimum delay to ensure splash screen is visible
        // This ensures users see the splash screen even if initialization is fast
        // In Expo Go, we need a longer delay to see the custom splash screen
        console.log('⏳ Waiting 3 seconds for splash screen (Expo Go needs more time)...');
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3 seconds for Expo Go
        console.log('✅ Splash screen delay complete');
      } catch (e) {
        console.warn('Error during app initialization:', e);
        // Even on error, wait minimum time
        await new Promise(resolve => setTimeout(resolve, 3000));
      } finally {
        // Tell the application to render
        console.log('✅ Setting appIsReady to true');
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
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <AuthProvider>
        <AppWithLanguage />
        <PushNotificationHandler />
      </AuthProvider>
    </View>
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
