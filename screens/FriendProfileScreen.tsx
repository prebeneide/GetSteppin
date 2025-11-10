import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import StatisticsView from '../components/StatisticsView';
import AchievementsView from '../components/AchievementsView';
import OnlineIndicator from '../components/OnlineIndicator';
import { getFriendCount } from '../services/friendService';
import { getTotalSteps, getTotalDistanceKm } from '../services/stepService';
import { formatDistance, DistanceUnit } from '../lib/formatters';
import { getUserPreferences } from '../lib/userPreferences';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../lib/i18n';

/**
 * Sjekker om en bruker har vært online/innlogget de siste 10 minuttene
 */
const isUserOnline = (lastActive: string | null | undefined): boolean => {
  if (!lastActive) return false;
  
  try {
    const lastActiveTime = new Date(lastActive).getTime();
    const now = new Date().getTime();
    const tenMinutesInMs = 10 * 60 * 1000; // 10 minutter i millisekunder
    
    return (now - lastActiveTime) <= tenMinutesInMs;
  } catch (err) {
    return false;
  }
};

/**
 * Formaterer store tall på en lesbar måte
 * F.eks: 1234 -> "1,2k", 1234567 -> "1,2M"
 */
const formatLargeNumber = (num: number | null): string => {
  if (num === null || num === undefined) return '-';
  
  if (num < 1000) {
    return num.toString();
  } else if (num < 1000000) {
    // Kilo: 1.2k, 12.3k, 123k
    const thousands = num / 1000;
    if (thousands >= 100) {
      return `${Math.round(thousands)}k`;
    }
    return `${thousands.toFixed(1)}k`;
  } else if (num < 1000000000) {
    // Million: 1.2M, 12.3M, 123M
    const millions = num / 1000000;
    if (millions >= 100) {
      return `${Math.round(millions)}M`;
    }
    return `${millions.toFixed(1)}M`;
  } else {
    // Milliard: 1.2B
    const billions = num / 1000000000;
    return `${billions.toFixed(1)}B`;
  }
};

/**
 * Formaterer km-tall på en lesbar måte
 * F.eks: 12.3, 123.4, 1234.5, 12.3k
 */
const formatKm = (km: number | null): string => {
  if (km === null || km === undefined) return '-';
  
  if (km < 1000) {
    // Vis med én desimal for små tall
    return `${km.toFixed(1)}`;
  } else if (km < 1000000) {
    // Kilo: 1.2k km, 12.3k km
    const thousands = km / 1000;
    if (thousands >= 100) {
      return `${Math.round(thousands)}k`;
    }
    return `${thousands.toFixed(1)}k`;
  } else if (km < 1000000000) {
    // Million: 1.2M km
    const millions = km / 1000000;
    if (millions >= 100) {
      return `${Math.round(millions)}M`;
    }
    return `${millions.toFixed(1)}M`;
  } else {
    // Milliard: 1.2B km
    const billions = km / 1000000000;
    return `${billions.toFixed(1)}B`;
  }
};

interface FriendProfileScreenProps {
  navigation: any;
  route?: {
    params?: {
      friendId: string;
      friendUsername?: string;
      friendAvatarUrl?: string | null;
    };
  };
}

interface UserProfile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  daily_step_goal: number | null;
}

interface FriendProfile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  daily_step_goal: number | null;
  bio: string | null;
}

export default function FriendProfileScreen({
  navigation,
  route,
}: FriendProfileScreenProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const friendId = route?.params?.friendId || '';
  const initialUsername = route?.params?.friendUsername;
  const initialAvatarUrl = route?.params?.friendAvatarUrl;
  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [lastActive, setLastActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [friendCount, setFriendCount] = useState<number | null>(null);
  const [totalSteps, setTotalSteps] = useState<number | null>(null);
  const [totalKm, setTotalKm] = useState<number | null>(null);
  const [totalDistanceMeters, setTotalDistanceMeters] = useState<number | null>(null);
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('km');

  useEffect(() => {
    if (friendId) {
      loadFriendProfile();
    } else {
      setError('Ingen venn ID oppgitt');
      setLoading(false);
    }
    loadPreferences();
  }, [friendId]);

  useEffect(() => {
    loadPreferences();
  }, [user]);

  // Reload preferences when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadPreferences();
    }, [user])
  );

  const loadPreferences = async () => {
    try {
      const preferences = await getUserPreferences(user?.id || null);
      setDistanceUnit(preferences.distance_unit);
    } catch (err) {
      console.error('Error loading preferences:', err);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      if (friendId) {
        loadFriendProfile();
      }
    }, [friendId])
  );

  const loadFriendProfile = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, username, full_name, avatar_url, daily_step_goal, bio')
        .eq('id', friendId)
        .single();

      if (profileError) {
        console.error('Error loading friend profile:', profileError);
        setError(t('screens.friendProfile.couldNotLoad'));
      } else if (data) {
        setProfile(data);
      }

      // Hent siste aktivitet (last_active) fra step_data
      const { data: stepData } = await supabase
        .from('step_data')
        .select('updated_at')
        .eq('user_id', friendId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (stepData?.updated_at) {
        setLastActive(stepData.updated_at);
      }

      // Hent antall venner
      const { data: friendsCount, error: friendsError } = await getFriendCount(friendId);
      if (!friendsError && friendsCount !== null) {
        setFriendCount(friendsCount);
      }

      // Hent totalt antall steg
      const { data: totalStepsData, error: stepsError } = await getTotalSteps(friendId);
      if (!stepsError && totalStepsData !== null) {
        setTotalSteps(totalStepsData);
      }

      // Hent totalt antall km (for backwards compatibility)
      const { data: totalKmData, error: kmError } = await getTotalDistanceKm(friendId);
      if (!kmError && totalKmData !== null) {
        setTotalKm(totalKmData);
        // Convert km to meters for formatDistance
        setTotalDistanceMeters(totalKmData * 1000);
      }
    } catch (err) {
      console.error('Error in loadFriendProfile:', err);
      setError(t('common.somethingWentWrong'));
    } finally {
      setLoading(false);
    }
  };

  // Use loaded profile or fallback to route params
  const displayUsername = profile?.username || initialUsername || t('screens.friendProfile.friend');
  const displayAvatarUrl = profile?.avatar_url || initialAvatarUrl;

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>← {t('common.back')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1ED760" />
        </View>
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>← {t('common.back')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {error || t('screens.friendProfile.couldNotLoad')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>{t('common.backArrow')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('screens.friendProfile.title')}</Text>
        <TouchableOpacity
          style={styles.chatButton}
          onPress={() =>
            navigation.navigate('Chat', {
              friendId: friendId,
              friendUsername: displayUsername,
              friendAvatarUrl: displayAvatarUrl,
            })
          }
        >
          <Text style={styles.chatButtonText}>💬</Text>
        </TouchableOpacity>
      </View>

      {/* Profile Info Section */}
      <View style={styles.profileSection}>
        <View style={styles.avatarWrapper}>
          <View style={styles.avatarContainer}>
            {displayAvatarUrl ? (
              <Image source={{ uri: displayAvatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>
                  {displayUsername.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <OnlineIndicator isOnline={isUserOnline(lastActive)} size="large" />
        </View>
        <Text style={styles.username}>{displayUsername}</Text>
        {profile.full_name && (
          <Text style={styles.fullName}>{profile.full_name}</Text>
        )}

        {/* Bio Section */}
        {profile.bio && (
          <View style={styles.bioContainer}>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </View>
        )}

        {/* Stats Section (Instagram-style) */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {formatLargeNumber(friendCount)}
            </Text>
            <Text style={styles.statLabel}>{t('screens.friendProfile.friends')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {formatLargeNumber(totalSteps)}
            </Text>
            <Text style={styles.statLabel}>{t('screens.home.steps')} {t('screens.home.total')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {totalDistanceMeters !== null ? formatDistance(totalDistanceMeters, distanceUnit) : '-'}
            </Text>
            <Text style={styles.statLabel}>{t('screens.home.total')}</Text>
          </View>
        </View>

        {profile.daily_step_goal && (
          <View style={styles.goalContainer}>
            <Text style={styles.goalLabel}>{t('screens.home.goal')}</Text>
            <Text style={styles.goalValue}>
              {profile.daily_step_goal.toLocaleString()} {t('screens.home.steps')}
            </Text>
          </View>
        )}
      </View>

      {/* Statistics Section */}
      <View style={styles.section}>
        <StatisticsView userId={friendId} isLoggedIn={true} />
      </View>

      {/* Achievements Section */}
      <View style={styles.section}>
        <AchievementsView userId={friendId} isLoggedIn={true} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButtonText: {
    fontSize: 16,
    color: '#1ED760',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  chatButton: {
    padding: 4,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatButtonText: {
    fontSize: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
    marginTop: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
  },
  profileSection: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#f9f9f9',
    marginBottom: 20,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 15,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#1ED760',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1ED760',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 40,
    fontWeight: '600',
    color: '#fff',
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  fullName: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingVertical: 15,
    paddingHorizontal: 30,
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 300,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 20,
  },
  goalContainer: {
    alignItems: 'center',
    marginTop: 10,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 300,
  },
  goalLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  goalValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1ED760',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  bioContainer: {
    marginTop: 10,
    marginBottom: 20,
    paddingHorizontal: 30,
    paddingVertical: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    width: '100%',
    maxWidth: 300,
  },
  bioText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    textAlign: 'center',
  },
});

