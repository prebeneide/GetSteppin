import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Image, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useStepCounter } from '../hooks/useStepCounter';
import { useWalkTracker } from '../hooks/useWalkTracker';
import { saveStepData } from '../services/stepService';
import { checkAllAchievements, getCurrentStreak } from '../services/achievementService';
import { supabase } from '../lib/supabase';
import { getDeviceId } from '../lib/deviceId';
import { isWalkTrackingEnabled } from '../services/walkService';
import { getUnreadNotificationsCount } from '../services/notificationService';
import { checkAndCreateAllActivityNotifications } from '../services/activityNotificationService';
import OnboardingScreen from './OnboardingScreen';
import LiveWalkCard from '../components/LiveWalkCard';
import CircularProgress from '../components/CircularProgress';
import StatisticsView from '../components/StatisticsView';
import AchievementsView from '../components/AchievementsView';
import FriendsStepsChart from '../components/FriendsStepsChart';
import OnlineIndicator from '../components/OnlineIndicator';
import { useTranslation } from '../lib/i18n';
import { formatDistance, DistanceUnit } from '../lib/formatters';
import { getUserPreferences } from '../lib/userPreferences';

interface HomeScreenProps {
  navigation: any;
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { user, signOut } = useAuth();
  const { t, language } = useTranslation();
  const { stepData, error: stepErrorCode } = useStepCounter();
  const latestStepDataRef = useRef(stepData);
  const latestDailyGoalRef = useRef<number | null>(null);
  const walkTracker = useWalkTracker(); // Initialize walk tracking
  const [saving, setSaving] = useState(false);
  const [dailyGoal, setDailyGoal] = useState<number | null>(null);
  const [goalLoaded, setGoalLoaded] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [profile, setProfile] = useState<{ username: string | null; avatar_url: string | null } | null>(null);
  const [anonymousAvatarUrl, setAnonymousAvatarUrl] = useState<string | null>(null);
  const [walkTrackingEnabled, setWalkTrackingEnabled] = useState<boolean | null>(null);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('km');
  const [currentStreak, setCurrentStreak] = useState(0);

  // Keep refs updated with latest values so the interval always has fresh data
  useEffect(() => {
    latestStepDataRef.current = stepData;
  }, [stepData]);

  useEffect(() => {
    latestDailyGoalRef.current = dailyGoal;
  }, [dailyGoal]);

  // Save step data to Supabase on a fixed 30-second interval.
  // Using refs so we never restart the interval on every step increment.
  useEffect(() => {
    if (!stepData.isAvailable) return;

    const saveData = async () => {
      const { steps, distance, isAvailable } = latestStepDataRef.current;
      if (!isAvailable || steps === 0) return;

      setSaving(true);
      try {
        let savedUserId: string | null = null;
        let savedDeviceId: string | null = null;

        if (user) {
          await saveStepData(user.id, steps, distance, null);
          savedUserId = user.id;
        } else {
          const deviceId = await getDeviceId();
          await saveStepData(null, steps, distance, deviceId);
          savedDeviceId = deviceId;
        }

        await checkAllAchievements(
          savedUserId,
          steps,
          distance,
          latestDailyGoalRef.current,
          savedDeviceId || undefined
        );
      } catch (err) {
        console.error('Error saving step data:', err);
      } finally {
        setSaving(false);
      }
    };

    // Initial save when pedometer first becomes available or user changes
    saveData();
    const interval = setInterval(saveData, 30000);
    return () => clearInterval(interval);
  }, [user, stepData.isAvailable]);

  // Load walk tracking enabled status
  useEffect(() => {
    const loadWalkTrackingStatus = async () => {
      const enabled = await isWalkTrackingEnabled(user?.id || null);
      setWalkTrackingEnabled(enabled);
    };
    loadWalkTrackingStatus();
  }, [user]);

  // Load user's daily goal from profile
  const loadGoal = async () => {
      try {
        if (user) {
          // For logged in users, check their profile
          const { data, error } = await supabase
            .from('user_profiles')
            .select('daily_step_goal')
            .eq('id', user.id)
            .single();

          if (error && error.code !== 'PGRST116') {
            console.error('Error loading goal:', error);
            // Show onboarding if there's an error
            setShowOnboarding(true);
            setGoalLoaded(true);
            return;
          }

          if (data && data.daily_step_goal !== null && data.daily_step_goal !== undefined) {
            setDailyGoal(data.daily_step_goal);
            setShowOnboarding(false);
          } else {
            // User hasn't set a goal yet (null or undefined)
            setShowOnboarding(true);
          }
        } else {
          // For non-logged in users, check device_settings in Supabase
          const deviceId = await getDeviceId();
          
          const { data, error } = await supabase
            .from('device_settings')
            .select('daily_step_goal')
            .eq('device_id', deviceId)
            .single();

          if (error && error.code !== 'PGRST116') {
            // PGRST116 means no rows found, which is fine
            console.error('Error loading device goal:', error);
            setShowOnboarding(true);
          } else if (data && data.daily_step_goal !== null && data.daily_step_goal !== undefined) {
            setDailyGoal(data.daily_step_goal);
            setShowOnboarding(false);
          } else {
            // No goal set yet
            setShowOnboarding(true);
          }
        }
      } catch (err) {
        console.error('Error loading goal:', err);
        // Show onboarding if there's an error
        setShowOnboarding(true);
      } finally {
        setGoalLoaded(true);
      }
    };

  // Load goal on mount and when user changes
  useEffect(() => {
    if (goalLoaded) return; // Only load once initially
    loadGoal();
  }, [user]);

  // Load profile for profile button
  useEffect(() => {
    if (!user) {
      setProfile(null);
      // Load anonymous avatar if not logged in
      const loadAnonymousAvatar = async () => {
        try {
          const deviceId = await getDeviceId();
          const { data, error } = await supabase
            .from('device_settings')
            .select('avatar_url')
            .eq('device_id', deviceId)
            .single();

          if (!error && data && data.avatar_url) {
            setAnonymousAvatarUrl(data.avatar_url);
          } else {
            setAnonymousAvatarUrl(null);
          }
        } catch (err) {
          console.error('Error loading anonymous avatar:', err);
          setAnonymousAvatarUrl(null);
        }
      };
      loadAnonymousAvatar();
      return;
    }

    const loadProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('username, avatar_url')
          .eq('id', user.id)
          .single();

        if (!error && data) {
          setProfile({ username: data.username, avatar_url: data.avatar_url });
        }
      } catch (err) {
        console.error('Error loading profile:', err);
      }
    };

    loadProfile();
  }, [user]);

  // Load unread notifications count
  useEffect(() => {
    if (!user) {
      setUnreadNotificationsCount(0);
      return;
    }
    const loadNotificationsCount = async () => {
      try {
        const { data, error } = await getUnreadNotificationsCount(user.id);
        if (error) {
          console.error('Error loading unread notifications count:', error);
        } else {
          setUnreadNotificationsCount(data);
        }
      } catch (err) {
        console.error('Error loading unread notifications count:', err);
      }
    };
    loadNotificationsCount();
    
    // Refresh count every 30 seconds
    const interval = setInterval(loadNotificationsCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Check and create activity notifications when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (!user) return;

      const checkActivityNotifications = async () => {
        try {
          console.log('Checking for activity notifications...');
          const { created, errors } = await checkAndCreateAllActivityNotifications(user.id);
          if (created > 0) {
            console.log(`Created ${created} activity notification(s)`);
            // Refresh notification count after creating new ones
            const { data } = await getUnreadNotificationsCount(user.id);
            if (data !== undefined) {
              setUnreadNotificationsCount(data);
            }
          }
          if (errors.length > 0) {
            console.error('Errors creating activity notifications:', errors);
          }
        } catch (err) {
          console.error('Error checking activity notifications:', err);
        }
      };

      // Small delay to avoid blocking UI
      const timeout = setTimeout(checkActivityNotifications, 1000);
      return () => clearTimeout(timeout);
    }, [user])
  );

  // Load preferences function - defined outside useEffect so it can be reused
  const loadPreferences = React.useCallback(async () => {
    const preferences = await getUserPreferences(user?.id || null);
    setDistanceUnit(preferences.distance_unit);
  }, [user]);

  // Load distance unit preference
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // Reload goal when screen comes into focus (e.g., returning from Settings)
  // Also reload when language changes
  useFocusEffect(
    React.useCallback(() => {
      if (goalLoaded) {
        // Reload goal when returning to this screen
        loadGoal();
      }
              // Reload profile too
              if (user) {
                supabase
                  .from('user_profiles')
                  .select('username, avatar_url')
                  .eq('id', user.id)
                  .single()
                  .then(({ data }) => {
                    if (data) {
                      setProfile({ username: data.username, avatar_url: data.avatar_url });
                    }
                  });
              } else {
                // Reload anonymous avatar
                getDeviceId().then(async (deviceId) => {
                  const { data } = await supabase
                    .from('device_settings')
                    .select('avatar_url')
                    .eq('device_id', deviceId)
                    .single();
                  if (data && data.avatar_url) {
                    setAnonymousAvatarUrl(data.avatar_url);
                  } else {
                    setAnonymousAvatarUrl(null);
                  }
                });
              }
              
              // Reload notifications count when screen comes into focus
              if (user) {
                getUnreadNotificationsCount(user.id).then(({ data, error }: { data: number; error: any }) => {
                  if (!error && data !== undefined) {
                    setUnreadNotificationsCount(data);
                  }
                });
              }
              
              // Reload preferences when screen comes into focus (e.g., language or distance unit changed)
              loadPreferences();

              // Load current streak
              const id = user?.id || null;
              getDeviceId().then(deviceId => {
                getCurrentStreak(id, id ? null : deviceId).then(setCurrentStreak);
              });
    }, [user, goalLoaded, language, loadPreferences])
  );
  
  // Reload preferences when language changes
  useEffect(() => {
    loadPreferences();
  }, [language, loadPreferences]);

  const handleGoalUpdate = (newGoal: number) => {
    console.log('Goal updated from settings:', newGoal);
    setDailyGoal(newGoal);
  };

  const handleOnboardingComplete = async (goalValue?: number) => {
    // If goal value is provided directly, use it immediately
    if (goalValue !== undefined && goalValue !== null) {
      console.log('Setting goal from onboarding:', goalValue);
      setDailyGoal(goalValue);
      setShowOnboarding(false);
      return;
    }

    // Otherwise, reload from Supabase (shouldn't happen, but fallback)
    try {
      if (user) {
        // For logged in users, reload from user_profiles
        const { data, error } = await supabase
          .from('user_profiles')
          .select('daily_step_goal')
          .eq('id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading goal after onboarding:', error);
        } else if (data && data.daily_step_goal !== null && data.daily_step_goal !== undefined) {
          console.log('Loaded goal from user_profiles:', data.daily_step_goal);
          setDailyGoal(data.daily_step_goal);
        }
      } else {
        // For non-logged in users, load from device_settings
        const deviceId = await getDeviceId();
        
        const { data, error } = await supabase
          .from('device_settings')
          .select('daily_step_goal')
          .eq('device_id', deviceId)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading device goal after onboarding:', error);
        } else if (data && data.daily_step_goal !== null && data.daily_step_goal !== undefined) {
          console.log('Loaded goal from device_settings:', data.daily_step_goal);
          setDailyGoal(data.daily_step_goal);
        }
      }
    } catch (err) {
      console.error('Error in handleOnboardingComplete:', err);
    }
    
    setShowOnboarding(false);
  };

  // Show onboarding if goal hasn't been loaded yet or if user needs to set goal
  if (!goalLoaded || showOnboarding) {
    return (
      <OnboardingScreen
        navigation={navigation}
        onComplete={handleOnboardingComplete}
      />
    );
  }

  // Calculate progress - only if goal is set
  const hasGoal = dailyGoal !== null && dailyGoal !== undefined && dailyGoal > 0;
  const currentGoal = hasGoal ? dailyGoal : 0;
  const progress = currentGoal > 0 ? (stepData.steps / currentGoal) * 100 : 0;
  const progressPercent = Math.min(progress, 100);

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => navigation.navigate('Notifications')}
          activeOpacity={0.7}
        >
          <View style={styles.notificationIconContainer}>
            <Text style={styles.notificationIcon}>🔔</Text>
            {unreadNotificationsCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        <Text style={styles.title}>{t('screens.home.title')}</Text>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => navigation.navigate('Profile')}
          activeOpacity={0.7}
        >
          <View style={styles.profileIconContainer}>
            {profile?.avatar_url ? (
              <Image
                source={{ uri: profile.avatar_url }}
                style={styles.profileAvatar}
                resizeMode="cover"
              />
            ) : profile?.username ? (
              <View style={styles.profileIconCircle}>
                <Text style={styles.profileIconText}>
                  {profile.username.charAt(0).toUpperCase()}
                </Text>
              </View>
            ) : (
              <View style={styles.menuIconContainer}>
                <View style={styles.menuIconLine} />
                <View style={styles.menuIconLine} />
                <View style={styles.menuIconLine} />
              </View>
            )}
            <OnlineIndicator isOnline={true} size="small" />
          </View>
        </TouchableOpacity>
      </View>
      
            {/* Show tracking status indicator - Always visible when user is logged in */}
            {user && walkTrackingEnabled !== null && (
              <>
                {walkTracker.isTracking && (
                  <View style={styles.trackingIndicator}>
                    <View style={[styles.trackingDot, walkTracker.isOutsideHomeArea && styles.trackingDotActive]} />
                    <Text style={styles.trackingText}>
                      {walkTracker.isOutsideHomeArea && walkTracker.currentWalk
                        ? `${t('screens.home.trackingActive')} • ${walkTracker.currentWalk.distance > 0 ? formatDistance(walkTracker.currentWalk.distance, distanceUnit) : t('screens.home.starting')}`
                        : walkTracker.isPermissionGranted
                        ? t('screens.home.trackingWaiting')
                        : t('screens.home.trackingPermission')}
                    </Text>
                  </View>
                )}
                {!walkTracker.isTracking && (
                  <View style={[styles.trackingIndicator, styles.trackingIndicatorInactive]}>
                    <View style={[styles.trackingDot, styles.trackingDotInactive]} />
                    <Text style={[styles.trackingText, styles.trackingTextInactive]}>
                      {walkTrackingEnabled
                        ? walkTracker.isPermissionGranted
                          ? t('screens.home.trackingWaiting')
                          : t('screens.home.trackingPermission')
                        : t('screens.home.gpsNotActivated')}
                    </Text>
                  </View>
                )}
              </>
            )}
      
      {/* Live walk map — shown when actively tracking outside home area */}
      {walkTracker.isTracking &&
        walkTracker.currentWalk &&
        walkTracker.currentWalk.coordinates.length >= 2 && (
          <LiveWalkCard
            coordinates={walkTracker.currentWalk.coordinates}
            distance={walkTracker.currentWalk.distance}
            startTime={walkTracker.currentWalk.startTime}
            distanceUnit={distanceUnit}
          />
        )}

      {stepErrorCode && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {stepErrorCode === 'not_available'
              ? t('screens.home.stepCounterNotAvailable')
              : stepErrorCode === 'permission_denied'
              ? t('screens.home.stepCounterPermissionDenied')
              : t('screens.home.stepCounterError')}
          </Text>
          {stepErrorCode === 'permission_denied' && (
            <TouchableOpacity
              onPress={() => Linking.openSettings()}
              style={styles.errorActionButton}
            >
              <Text style={styles.errorActionText}>
                {t('screens.home.stepCounterPermissionDeniedAction')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {stepData.isAvailable ? (
        <View style={styles.stepContainer}>
          {/* Show circular progress if goal is set */}
          {hasGoal ? (
            <View style={styles.circularProgressContainer}>
              <CircularProgress
                progress={progressPercent}
                size={220}
                strokeWidth={16}
                color="#1ED760"
                backgroundColor="#e0e0e0"
              >
                <View style={styles.circularProgressContent}>
                  <Text style={styles.circularProgressPercent}>
                    {progressPercent.toFixed(0)}%
                  </Text>
                  <Text style={styles.circularProgressLabel}>{t('screens.home.completed')}</Text>
                  <Text style={styles.circularProgressSteps}>
                    {stepData.steps.toLocaleString()} / {currentGoal.toLocaleString()}
                  </Text>
                  <Text style={styles.circularProgressRemaining}>
                    {Math.max(0, currentGoal - stepData.steps).toLocaleString()} {t('screens.home.remaining')}
                  </Text>
                </View>
              </CircularProgress>
              
              <View style={styles.goalInfoContainer}>
                <Text style={styles.goalTitle}>{t('screens.home.goal')}</Text>
                <Text style={styles.goalValue}>{currentGoal.toLocaleString()} {t('screens.home.steps')}</Text>
              </View>

              {currentStreak >= 2 && (
                <View style={styles.streakBadge}>
                  <Text style={styles.streakEmoji}>🔥</Text>
                  <Text style={styles.streakText}>
                    {currentStreak} {t('screens.home.streakDays')}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <>
              <Text style={styles.stepCount}>{stepData.steps.toLocaleString()}</Text>
              <Text style={styles.stepLabel}>{t('screens.home.steps')} {t('screens.home.today')}</Text>
              
              <View style={styles.distanceContainer}>
                <Text style={styles.distanceText}>
                  {formatDistance(stepData.distance, distanceUnit)}
                </Text>
              </View>

              <View style={styles.goalContainer}>
                <Text style={styles.noGoalText}>
                  {t('screens.home.noGoal')}
                </Text>
                <TouchableOpacity
                  style={styles.setGoalButton}
                  onPress={() => setShowOnboarding(true)}
                >
                  <Text style={styles.setGoalButtonText}>{t('screens.home.setGoal')}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          <View style={[styles.savingContainer, { opacity: saving ? 1 : 0 }]}>
            <ActivityIndicator size="small" color="#1ED760" animating={saving} />
            <Text style={styles.savingText}>{t('screens.home.saving')}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.content}>
          <Text style={styles.info}>
            {t('screens.home.startingStepCounter')}
          </Text>
        </View>
      )}

      {/* Achievements Section - Always show, works for both logged in and anonymous users */}
      <View style={styles.achievementsWrapper}>
        <AchievementsView userId={user?.id || null} isLoggedIn={!!user} />
      </View>

              {/* Friends Steps Chart - Only show if logged in */}
              {user && (
                <View style={styles.friendsChartWrapper}>
                  <FriendsStepsChart userId={user.id} isLoggedIn={!!user} />
                </View>
              )}

              {/* Statistics Section - Always show, works for both logged in and anonymous users */}
              <View style={styles.statisticsWrapper}>
                <StatisticsView userId={user?.id || null} isLoggedIn={!!user} />
              </View>


              {/* Login prompt for friends feature - Always at bottom */}
              {!user && (
                <View style={styles.loginPrompt}>
                  <Text style={styles.loginPromptText}>
                    📱 {t('screens.home.friendsActivity')}
                  </Text>
                  <View style={styles.loginButtons}>
                    <TouchableOpacity
                      style={[styles.loginButton, styles.loginButtonPrimary]}
                      onPress={() => navigation.navigate('Login')}
                    >
                      <Text style={styles.loginButtonText}>{t('screens.home.login')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.loginButton, styles.loginButtonSecondary]}
                      onPress={() => navigation.navigate('SignUp')}
                    >
                      <Text style={[styles.loginButtonText, styles.loginButtonTextSecondary]}>
                        {t('screens.home.createAccount')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 20,
    paddingHorizontal: 0,
  },
  notificationButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationIconContainer: {
    position: 'relative',
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationIcon: {
    fontSize: 24,
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#F44336',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    color: '#333',
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  loginChip: {
    backgroundColor: '#1ED760',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  loginChipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  profileIconContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  profileIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1ED760',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  profileIconText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  menuIconLine: {
    width: 22,
    height: 2.5,
    backgroundColor: '#333',
    borderRadius: 2,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    color: '#666',
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
    textAlign: 'center',
  },
  errorActionButton: {
    marginTop: 10,
    backgroundColor: '#F44336',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  errorActionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  stepContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  circularProgressContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  circularProgressContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circularProgressPercent: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#1ED760',
    marginBottom: 4,
    textShadowColor: 'rgba(30, 215, 96, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  circularProgressLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  circularProgressSteps: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  circularProgressRemaining: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  goalInfoContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    backgroundColor: '#FFF3E0',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FF9800',
    gap: 6,
  },
  streakEmoji: {
    fontSize: 18,
  },
  streakText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E65100',
  },
  goalTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  goalValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  stepCount: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#1ED760',
    marginBottom: 5,
  },
  stepLabel: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
  },
  distanceContainer: {
    marginBottom: 30,
  },
  distanceText: {
    fontSize: 24,
    color: '#333',
    fontWeight: '600',
  },
  goalContainer: {
    width: '100%',
    marginTop: 20,
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
  },
  goalLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
  },
  progressBarContainer: {
    width: '100%',
    height: 20,
    backgroundColor: '#e0e0e0',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#1ED760',
    borderRadius: 10,
  },
  progressText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 5,
  },
  progressDetails: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 5,
  },
  noGoalText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 15,
  },
  setGoalButton: {
    backgroundColor: '#1ED760',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  setGoalButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  savingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  savingText: {
    fontSize: 12,
    color: '#666',
  },
  content: {
    marginVertical: 40,
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center',
  },
  info: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  loginPrompt: {
    marginTop: 'auto',
    padding: 20,
    paddingBottom: 30,
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  loginPromptText: {
    fontSize: 16,
    color: '#1976D2',
    textAlign: 'center',
    marginBottom: 15,
  },
  loginButtons: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  loginButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  loginButtonPrimary: {
    backgroundColor: '#1ED760',
  },
  loginButtonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#1ED760',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  loginButtonTextSecondary: {
    color: '#1ED760',
  },
  achievementsWrapper: {
    width: '100%',
  },
  statisticsWrapper: {
    width: '100%',
  },
  friendsChartWrapper: {
    width: '100%',
  },
  friendsSection: {
    width: '100%',
    marginTop: 20,
  },
  friendsButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1ED760',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  friendsButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
          friendsButtonArrow: {
            fontSize: 20,
            color: '#fff',
            fontWeight: 'bold',
          },
          chatListButton: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#1ED760',
            padding: 16,
            borderRadius: 12,
            marginBottom: 20,
          },
          chatListButtonText: {
            fontSize: 18,
            fontWeight: '600',
            color: '#fff',
          },
  noStatisticsContainer: {
    marginTop: 20,
    padding: 20,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 80,
    justifyContent: 'center',
  },
  noStatisticsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  actionButtons: {
    marginTop: 'auto',
    marginBottom: 20,
    gap: 10,
  },
  settingsButton: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  settingsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#F44336',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  trackingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 10,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#1ED760',
  },
  trackingIndicatorInactive: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FF9800',
  },
  trackingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1ED760',
    marginRight: 8,
  },
  trackingDotActive: {
    backgroundColor: '#1ED760',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  trackingDotInactive: {
    backgroundColor: '#FF9800',
  },
  trackingText: {
    color: '#1ED760',
    fontSize: 14,
    fontWeight: '600',
  },
  trackingTextInactive: {
    color: '#FF9800',
  },
});

