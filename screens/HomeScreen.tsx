import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useStepCounter } from '../hooks/useStepCounter';
import { saveStepData } from '../services/stepService';
import { checkAllAchievements } from '../services/achievementService';
import { supabase } from '../lib/supabase';
import { getDeviceId } from '../lib/deviceId';
import OnboardingScreen from './OnboardingScreen';
import CircularProgress from '../components/CircularProgress';
import StatisticsView from '../components/StatisticsView';
import AchievementsView from '../components/AchievementsView';
import FriendsStepsChart from '../components/FriendsStepsChart';

interface HomeScreenProps {
  navigation: any;
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { user, signOut } = useAuth();
  const { stepData, error: stepError } = useStepCounter();
  const [saving, setSaving] = useState(false);
  const [dailyGoal, setDailyGoal] = useState<number | null>(null);
  const [goalLoaded, setGoalLoaded] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [profile, setProfile] = useState<{ username: string | null; avatar_url: string | null } | null>(null);
  const [anonymousAvatarUrl, setAnonymousAvatarUrl] = useState<string | null>(null);

  // Save step data to Supabase periodically (for both logged in and anonymous users)
  useEffect(() => {
    if (!stepData.isAvailable || stepData.steps === 0) return;

    const saveData = async () => {
      setSaving(true);
      try {
        let savedUserId: string | null = null;
        let savedDeviceId: string | null = null;

        if (user) {
          // Logged in user
          await saveStepData(user.id, stepData.steps, stepData.distance, null);
          savedUserId = user.id;
        } else {
          // Anonymous user - use device_id
          const deviceId = await getDeviceId();
          await saveStepData(null, stepData.steps, stepData.distance, deviceId);
          savedDeviceId = deviceId;
        }

        // Check and award achievements based on step data
        await checkAllAchievements(
          savedUserId,
          stepData.steps,
          stepData.distance,
          dailyGoal,
          savedDeviceId || undefined
        );
      } catch (err) {
        console.error('Error saving step data:', err);
      } finally {
        setSaving(false);
      }
    };

    // Save immediately when steps change
    saveData();

    // Also save every 30 seconds
    const interval = setInterval(saveData, 30000);

    return () => clearInterval(interval);
  }, [user, stepData.steps, stepData.distance, dailyGoal]);

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

  // Reload goal when screen comes into focus (e.g., returning from Settings)
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
    }, [user, goalLoaded])
  );

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
        <Text style={styles.title}>Velkommen til Steppin!</Text>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => navigation.navigate('Profile')}
          activeOpacity={0.7}
        >
          <View style={styles.profileIconContainer}>
            {(user && profile?.avatar_url) || (!user && anonymousAvatarUrl) ? (
              <Image
                source={{ uri: user ? profile!.avatar_url! : anonymousAvatarUrl! }}
                style={styles.profileAvatar}
                resizeMode="cover"
              />
            ) : user && profile?.username ? (
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
          </View>
        </TouchableOpacity>
      </View>
      
      {stepError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{stepError}</Text>
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
                  <Text style={styles.circularProgressLabel}>fullført</Text>
                  <Text style={styles.circularProgressSteps}>
                    {stepData.steps.toLocaleString()} / {currentGoal.toLocaleString()}
                  </Text>
                  <Text style={styles.circularProgressRemaining}>
                    {Math.max(0, currentGoal - stepData.steps).toLocaleString()} igjen
                  </Text>
                </View>
              </CircularProgress>
              
              <View style={styles.goalInfoContainer}>
                <Text style={styles.goalTitle}>Dagens mål</Text>
                <Text style={styles.goalValue}>{currentGoal.toLocaleString()} skritt</Text>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.stepCount}>{stepData.steps.toLocaleString()}</Text>
              <Text style={styles.stepLabel}>skritt i dag</Text>
              
              <View style={styles.distanceContainer}>
                <Text style={styles.distanceText}>
                  {stepData.distance >= 1000
                    ? `${(stepData.distance / 1000).toFixed(2)} km`
                    : `${stepData.distance} m`}
                </Text>
              </View>

              <View style={styles.goalContainer}>
                <Text style={styles.noGoalText}>
                  Du har ikke satt et daglig mål ennå
                </Text>
                <TouchableOpacity
                  style={styles.setGoalButton}
                  onPress={() => setShowOnboarding(true)}
                >
                  <Text style={styles.setGoalButtonText}>Sett daglig mål</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {saving && (
            <View style={styles.savingContainer}>
              <ActivityIndicator size="small" color="#1ED760" />
              <Text style={styles.savingText}>Lagrer...</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.content}>
          <Text style={styles.info}>
            Starter skrittteller...
          </Text>
        </View>
      )}

      {/* Achievements Section - Always show, works for both logged in and anonymous users */}
      <View style={styles.achievementsWrapper}>
        <AchievementsView userId={user?.id || null} isLoggedIn={!!user} />
      </View>

              {/* Statistics Section - Always show, works for both logged in and anonymous users */}
              <View style={styles.statisticsWrapper}>
                <StatisticsView userId={user?.id || null} isLoggedIn={!!user} />
              </View>

              {/* Friends Steps Chart - Only show if logged in */}
              {user && (
                <View style={styles.friendsChartWrapper}>
                  <FriendsStepsChart userId={user.id} isLoggedIn={!!user} />
                </View>
              )}

              {/* Friends Section - Only show if logged in */}
              {user && (
                <View style={styles.friendsSection}>
                  <TouchableOpacity
                    style={styles.friendsButton}
                    onPress={() => navigation.navigate('Friends')}
                  >
                    <Text style={styles.friendsButtonText}>👥 Mine venner</Text>
                    <Text style={styles.friendsButtonArrow}>→</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.chatListButton}
                    onPress={() => navigation.navigate('ChatList')}
                  >
                    <Text style={styles.chatListButtonText}>💬 Meldinger</Text>
                    <Text style={styles.friendsButtonArrow}>→</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Login prompt for friends feature - Always at bottom */}
              {!user && (
                <View style={styles.loginPrompt}>
                  <Text style={styles.loginPromptText}>
                    📱 Logg inn for å legge til venner og sammenligne skritt!
                  </Text>
                  <View style={styles.loginButtons}>
                    <TouchableOpacity
                      style={[styles.loginButton, styles.loginButtonPrimary]}
                      onPress={() => navigation.navigate('Login')}
                    >
                      <Text style={styles.loginButtonText}>Logg inn</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.loginButton, styles.loginButtonSecondary]}
                      onPress={() => navigation.navigate('SignUp')}
                    >
                      <Text style={[styles.loginButtonText, styles.loginButtonTextSecondary]}>
                        Opprett konto
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
  profileIconContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  errorText: {
    color: '#F44336',
    fontSize: 14,
    textAlign: 'center',
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
});

