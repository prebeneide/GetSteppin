import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../lib/i18n';
import { getFriendsStepsForPeriod, FriendStepData, getFriends } from '../services/friendService';
import OnlineIndicator from './OnlineIndicator';
import { supabase } from '../lib/supabase';

interface FriendsStepsChartProps {
  userId: string | null;
  isLoggedIn: boolean;
}

type Period = 'day' | 'week' | 'month' | 'year';

// Farger for søylene - forskjellige farger for hver søyle
const COLORS = [
  '#1ED760', // Spotify green (for topp-plassering)
  '#00D4FF', // Cyan
  '#FF6B6B', // Red/Coral
  '#4ECDC4', // Turquoise
  '#FFE66D', // Yellow
  '#95E1D3', // Mint
  '#F38181', // Pink
  '#AA96DA', // Purple
  '#FCBAD3', // Light Pink
  '#FFD3A5', // Peach
  '#A8E6CF', // Light Green
  '#C5E3F6', // Light Blue
  '#FFAAA5', // Salmon
  '#FFD93D', // Gold
  '#6BCB77', // Green
  '#4D96FF', // Blue
  '#FF6B9D', // Hot Pink
  '#C44569', // Deep Pink
  '#F97F51', // Orange
  '#F8B500', // Amber
];

/**
 * Sjekker om en bruker er aktiv/online (har oppdatert skritt-data innenfor siste 30 minutter)
 * Brukes for å vise aktivitetsindikator (gange/løpe emoji)
 */
const isUserActive = (lastActive: string): boolean => {
  try {
    const lastActiveTime = new Date(lastActive).getTime();
    const now = new Date().getTime();
    const thirtyMinutesInMs = 30 * 60 * 1000; // 30 minutter i millisekunder
    
    return (now - lastActiveTime) <= thirtyMinutesInMs;
  } catch (err) {
    return false;
  }
};

/**
 * Sjekker om en bruker har vært online/innlogget de siste 10 minuttene
 * Brukes for å vise grønn online-indikator
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
 * Bestemmer aktivitetstype basert på hastighet (distanse per tid)
 * Bruker endringer i skritt og distanse over tid for mer nøyaktig beregning
 * - Gange: ~4-6 km/t (1.1-1.7 m/s)
 * - Jogging: ~8-12 km/t (2.2-3.3 m/s)
 * - Løping: >12 km/t (>3.3 m/s)
 */
const getActivityType = (friend: FriendStepData): 'walking' | 'jogging' | 'running' | null => {
  // Trenger både siste oppdatering og forrige oppdatering for å beregne hastighet
  if (!friend.last_active || !friend.previous_update_time || !friend.previous_steps || !friend.previous_distance) {
    return null; // Ikke nok data for beregning
  }
  
  try {
    const lastActiveTime = new Date(friend.last_active).getTime();
    const previousUpdateTime = new Date(friend.previous_update_time).getTime();
    
    // Sjekk at forrige oppdatering ikke er for lenge siden (max 1 time for nøyaktighet)
    const timeDiffMs = lastActiveTime - previousUpdateTime;
    const oneHourInMs = 60 * 60 * 1000;
    
    if (timeDiffMs <= 0 || timeDiffMs > oneHourInMs) {
      return null; // For langt tidsspenn eller ugyldig
    }
    
    // Beregn endringer
    const stepsDiff = friend.steps - friend.previous_steps;
    const distanceDiff = friend.distance_meters - friend.previous_distance;
    
    if (stepsDiff <= 0 || distanceDiff <= 0) {
      return null; // Ingen endring eller negativ endring
    }
    
    // Beregn hastighet: distanse per tid
    const timeDiffHours = timeDiffMs / (1000 * 60 * 60); // Konverter til timer
    const speedKmh = (distanceDiff / 1000) / timeDiffHours; // km/t
    
    // Eller beregn i m/s for mer nøyaktighet
    const timeDiffSeconds = timeDiffMs / 1000;
    const speedMs = distanceDiff / timeDiffSeconds; // m/s
    
    // Bestem aktivitetstype basert på hastighet
    // Gange: ~4-6 km/t (1.1-1.7 m/s)
    // Jogging: ~8-12 km/t (2.2-3.3 m/s)  
    // Løping: >12 km/t (>3.3 m/s)
    
    if (speedMs >= 3.3 || speedKmh >= 12) {
      return 'running'; // Løping
    } else if (speedMs >= 2.2 || speedKmh >= 8) {
      return 'jogging'; // Jogging
    } else if (speedMs >= 1.1 || speedKmh >= 4) {
      return 'walking'; // Gange
    }
    
    return null; // For lav hastighet
  } catch (err) {
    console.error('Error calculating activity type:', err);
    return null;
  }
};

export default function FriendsStepsChart({ userId, isLoggedIn }: FriendsStepsChartProps) {
  const { user } = useAuth();
  const { t, language } = useTranslation();
  const [friendsSteps, setFriendsSteps] = useState<FriendStepData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);
  const [period, setPeriod] = useState<Period>('day');
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [yearOffset, setYearOffset] = useState(0);

  useEffect(() => {
    if (!isLoggedIn || !userId || !user) {
      setLoading(false);
      return;
    }

    loadFriendsSteps();

    // Realtime: refresh chart when any friend's daily_steps changes
    let channel: ReturnType<typeof supabase.channel> | null = null;
    getFriends(userId).then(({ data: friends }) => {
      const friendIds = (friends || []).map(f => f.id);
      const watchIds = [userId, ...friendIds];

      channel = supabase
        .channel(`friends-steps-${userId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'daily_steps' },
          (payload: any) => {
            if (watchIds.includes(payload.new?.user_id)) {
              loadFriendsSteps();
            }
          }
        )
        .subscribe();
    });

    // Fallback poll every 30s in case realtime misses anything
    const interval = setInterval(loadFriendsSteps, 30000);

    return () => {
      clearInterval(interval);
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId, isLoggedIn, user, period, weekOffset, monthOffset, yearOffset]);

  const getDateRange = (periodType: Period) => {
    const today = new Date();
    const endDate = new Date();
    const startDate = new Date();
    
    switch (periodType) {
      case 'day': {
        startDate.setTime(today.getTime());
        endDate.setTime(today.getTime());
        break;
      }
      case 'week': {
        const currentDay = today.getDay();
        const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
        
        const monday = new Date(today);
        monday.setDate(today.getDate() - daysFromMonday + (weekOffset * 7));
        monday.setHours(0, 0, 0, 0);
        
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        
        startDate.setTime(monday.getTime());
        endDate.setTime(sunday.getTime());
        break;
      }
      case 'month': {
        const targetMonth = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
        
        startDate.setTime(targetMonth.getTime());
        startDate.setHours(0, 0, 0, 0);
        
        endDate.setFullYear(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      }
      case 'year': {
        const targetYear = today.getFullYear() + yearOffset;
        
        startDate.setFullYear(targetYear, 0, 1);
        startDate.setHours(0, 0, 0, 0);
        
        endDate.setFullYear(targetYear, 11, 31);
        endDate.setHours(23, 59, 59, 999);
        break;
      }
    }
    
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    };
  };

  const getPeriodLabel = () => {
    if (period === 'day') return t('screens.friendsSteps.today');
    if (period === 'week') {
      if (weekOffset === 0) return t('screens.friendsSteps.thisWeek');
      if (weekOffset === -1) return t('screens.statistics.lastWeek');
      return `${t('screens.friendsSteps.week')} ${weekOffset < 0 ? Math.abs(weekOffset) : weekOffset + 1}`;
    }
    if (period === 'month') {
      const targetMonth = new Date();
      targetMonth.setMonth(targetMonth.getMonth() + monthOffset);
      const locale = language === 'en' ? 'en-US' : 'nb-NO';
      return targetMonth.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    }
    const targetYear = new Date().getFullYear() + yearOffset;
    return targetYear.toString();
  };

  const loadFriendsSteps = async () => {
    if (!userId || !user) return;

    setLoading(true);
    setError(null);

    try {
      const { start, end } = getDateRange(period);
      const { data, error: fetchError } = await getFriendsStepsForPeriod(userId, start, end, true);

      if (fetchError) {
        console.error('Error loading friends steps:', fetchError);
        
        // Check if error is due to no friends (UUID error with empty string)
        // This happens when user has no friends and the query tries to use an empty array
        const isNoFriendsError = 
          fetchError.code === '22P02' || // Invalid UUID syntax
          (fetchError.message && fetchError.message.includes('invalid input syntax for type uuid'));
        
        if (isNoFriendsError) {
          // User has no friends - show friendly message instead of error
          setFriendsSteps([]);
          setError(null); // Don't show error, just show empty state
        } else {
          // Actual error - show error message
          setError(t('screens.friendsSteps.couldNotLoad'));
        }
      } else {
        setFriendsSteps(data || []);
        
        // Finn brukerens egen rank
        const userData = data?.find(f => f.id === userId);
        setCurrentUserRank(userData?.rank || null);

        // Check competition achievements for this period
        // Import checkCompetitionAchievements dynamically to avoid circular dependency
        const { checkCompetitionAchievements } = await import('../services/achievementService');
        if (userData && userData.rank <= 3) {
          // Only check if user is in top 3
          checkCompetitionAchievements(userId, period, undefined).catch(err => {
            console.error('Error checking competition achievements:', err);
          });
        }
      }
    } catch (err) {
      console.error('Error in loadFriendsSteps:', err);
      
      // Check if error is due to no friends
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isNoFriendsError = errorMessage.includes('invalid input syntax for type uuid');
      
      if (isNoFriendsError) {
        // User has no friends - show friendly message instead of error
        setFriendsSteps([]);
        setError(null); // Don't show error, just show empty state
      } else {
        // Actual error - show error message
        setError(t('common.error'));
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isLoggedIn || !userId || !user) {
    return null; // Ikke vis for ikke-innloggede brukere
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>👥 {t('screens.friendsSteps.friendsStepsToday')}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#1ED760" />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>👥 {t('screens.friendsSteps.friendsStepsToday')}</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  if (friendsSteps.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>👥 {t('screens.friendsSteps.friendsStepsToday')}</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {t('screens.friendsSteps.addFriendsToSee')}
          </Text>
        </View>
      </View>
    );
  }

  // Beregn dynamisk maksverdi basert på faktiske data for bedre visuell sammenligning
  const calculateMaxSteps = (steps: number[]): number => {
    if (steps.length === 0) return 1000;
    
    const maxStepValue = Math.max(...steps);
    
    if (maxStepValue === 0) return 1000;
    
    // Hvis maksverdien er lav (< 2000), sett maks til maksverdi * 1.3 (min 1000)
    if (maxStepValue < 2000) {
      return Math.max(maxStepValue * 1.3, 1000);
    }
    
    // Hvis maksverdien er middels (2000-15000), sett maks til maksverdi * 1.2
    if (maxStepValue < 15000) {
      return maxStepValue * 1.2;
    }
    
    // Hvis maksverdien er høy (>= 15000), sett maks til maksverdi * 1.1, men max 35000
    return Math.min(maxStepValue * 1.1, 35000);
  };

  const stepValues = friendsSteps.map(f => f.steps);
  const maxSteps = calculateMaxSteps(stepValues);
  const chartMaxHeight = 200; // Maks høyde for søyler i pixels

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>👥 {t('screens.friendsSteps.friendsSteps')}</Text>
          <Text style={styles.periodLabel}>{getPeriodLabel()}</Text>
        </View>
        {currentUserRank !== null && (
          <Text style={styles.rankText}>
            {t('screens.friendsSteps.youAreIn')} {currentUserRank}. {t('screens.friendsSteps.place')}!
          </Text>
        )}
        
        {/* Period Navigation */}
        <View style={styles.periodNavigation}>
          <TouchableOpacity
            style={[styles.periodButton, period === 'day' && styles.periodButtonActive]}
            onPress={() => {
              setPeriod('day');
              setWeekOffset(0);
              setMonthOffset(0);
              setYearOffset(0);
            }}
          >
            <Text style={[styles.periodButtonText, period === 'day' && styles.periodButtonTextActive]}>
              {t('screens.friendsSteps.day')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodButton, period === 'week' && styles.periodButtonActive]}
            onPress={() => {
              setPeriod('week');
              setWeekOffset(0);
              setMonthOffset(0);
              setYearOffset(0);
            }}
          >
            <Text style={[styles.periodButtonText, period === 'week' && styles.periodButtonTextActive]}>
              {t('screens.friendsSteps.week')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodButton, period === 'month' && styles.periodButtonActive]}
            onPress={() => {
              setPeriod('month');
              setWeekOffset(0);
              setMonthOffset(0);
              setYearOffset(0);
            }}
          >
            <Text style={[styles.periodButtonText, period === 'month' && styles.periodButtonTextActive]}>
              {t('screens.friendsSteps.month')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodButton, period === 'year' && styles.periodButtonActive]}
            onPress={() => {
              setPeriod('year');
              setWeekOffset(0);
              setMonthOffset(0);
              setYearOffset(0);
            }}
          >
            <Text style={[styles.periodButtonText, period === 'year' && styles.periodButtonTextActive]}>
              {t('screens.friendsSteps.year')}
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Period Navigation Arrows */}
        {period !== 'day' && (
          <View style={styles.periodArrows}>
            <TouchableOpacity
              style={styles.arrowButton}
              onPress={() => {
                if (period === 'week') setWeekOffset(weekOffset - 1);
                if (period === 'month') setMonthOffset(monthOffset - 1);
                if (period === 'year') setYearOffset(yearOffset - 1);
              }}
            >
              <Text style={styles.arrowText}>←</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.arrowButton}
              onPress={() => {
                if (period === 'week') setWeekOffset(weekOffset + 1);
                if (period === 'month') setMonthOffset(monthOffset + 1);
                if (period === 'year') setYearOffset(yearOffset + 1);
              }}
            >
              <Text style={styles.arrowText}>→</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chartContainer}
        style={styles.scrollView}
      >
        {friendsSteps.map((friend, index) => {
          const isCurrentUser = friend.id === userId;
          const barHeight = maxSteps > 0 
            ? (friend.steps / maxSteps) * chartMaxHeight 
            : 0;
          const color = COLORS[index % COLORS.length];
          
          return (
            <View key={friend.id} style={styles.barWrapper}>
              <View style={styles.barContainer}>
                {/* Søyle-container med absolutt posisjonerte elementer */}
                <View style={styles.barArea}>
                  {/* Søyle */}
                  <View
                    style={[
                      styles.bar,
                      {
                        height: Math.max(barHeight, 10), // Minimum 10px høyde
                        backgroundColor: color,
                      },
                    ]}
                  />
                  
                  {/* Profilbilde, pokal og skritt-tall plassert rett over baren */}
                  {friend.steps > 0 && (
                    <View
                      style={[
                        styles.overBarContent,
                        {
                          bottom: Math.max(barHeight, 10) + 8, // Plasser rett over baren (8px spacing)
                        },
                      ]}
                    >
                      {/* Pokal for leder (rank 1) */}
                      {friend.rank === 1 && (
                        <View style={styles.trophyContainer}>
                          <Text style={styles.trophyEmoji}>🏆</Text>
                        </View>
                      )}
                      
                      {/* Profilbilde */}
                      <View style={styles.avatarWrapper}>
                        <View style={[styles.avatarContainer, isCurrentUser && styles.currentUserAvatar]}>
                          {friend.avatar_url ? (
                            <Image
                              source={{ uri: friend.avatar_url }}
                              style={styles.avatar}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={[styles.avatarPlaceholder, { backgroundColor: color }]}>
                              <Text style={styles.avatarText}>
                                {(friend.username || '?').charAt(0).toUpperCase()}
                              </Text>
                            </View>
                          )}
                        </View>
                        {/* Online indikator - grønn prikk hvis bruker har vært innlogget siste 10 minutter */}
                        {/* Plassert utenfor avatarContainer slik at den ikke kutter av prikken */}
                        <OnlineIndicator isOnline={isUserOnline(friend.last_active)} size="medium" />
                        
                        {/* Aktivitetindikator - emoji hvis aktiv innenfor siste 30 minutter */}
                        {friend.last_active && isUserActive(friend.last_active) && (() => {
                          const activityType = getActivityType(friend);
                          let emoji = '🚶'; // Default: gange
                          
                          if (activityType === 'running') {
                            emoji = '🏃'; // Løping
                          } else if (activityType === 'jogging') {
                            emoji = '🏃'; // Jogging (samme emoji, eller bruk 🏃‍♀️/🏃‍♂️)
                          } else if (activityType === 'walking') {
                            emoji = '🚶'; // Gange
                          }
                          
                          return (
                            <View style={styles.activeIndicator}>
                              <Text style={styles.activeEmoji}>{emoji}</Text>
                            </View>
                          );
                        })()}
                        
                        {/* "Du" badge for current user - på profilbildet */}
                        {isCurrentUser && (
                          <View style={styles.currentUserBadge}>
                            <Text style={styles.currentUserBadgeText}>{t('screens.friendsSteps.you')}</Text>
                          </View>
                        )}
                      </View>
                      
                      {/* Skritt-tall */}
                      {friend.steps > 0 && (
                        <View style={styles.stepsLabel}>
                          <Text style={styles.stepsText} numberOfLines={1}>
                            {friend.steps.toLocaleString()}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                {/* Rank */}
                <View style={styles.rankContainer}>
                  <Text style={styles.rankNumber}>{friend.rank}</Text>
                </View>

                {/* Brukernavn */}
                <Text style={[styles.username, isCurrentUser && styles.currentUserUsername]} numberOfLines={1}>
                  {friend.username}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 20,
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  header: {
    marginBottom: 15,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  periodLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  periodNavigation: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    marginBottom: 10,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  periodButtonActive: {
    backgroundColor: '#1ED760',
    borderColor: '#1ED760',
  },
  periodButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },
  periodButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  periodArrows: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 5,
  },
  arrowButton: {
    paddingVertical: 5,
    paddingHorizontal: 15,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  arrowText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1ED760',
  },
  rankText: {
    fontSize: 14,
    color: '#1ED760',
    fontWeight: '500',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  scrollView: {
    flexGrow: 0,
  },
  chartContainer: {
    paddingRight: 10,
    paddingTop: 80, // Gi plass for elementer over baren
    alignItems: 'flex-end',
    minHeight: 380, // Plass for barer (200) + elementer over (180)
    overflow: 'visible', // Sørg for at elementer utenfor kan vises
  },
  barWrapper: {
    marginHorizontal: 8,
    alignItems: 'center',
    width: 70,
    overflow: 'visible', // Sørg for at elementer utenfor kan vises
  },
  barContainer: {
    alignItems: 'center',
    width: '100%',
  },
  barArea: {
    position: 'relative',
    width: '100%',
    height: 300, // Gi nok plass for barer (200) + elementer over (100)
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible', // Sørg for at elementer utenfor kan vises
  },
  overBarContent: {
    position: 'absolute',
    alignItems: 'center',
    width: '100%',
    zIndex: 10,
    left: 0,
    right: 0,
    transform: [{ translateY: -2 }], // Juster litt opp
  },
  trophyContainer: {
    marginBottom: 4,
    backgroundColor: '#FFD700',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  trophyEmoji: {
    fontSize: 18,
  },
  avatarWrapper: {
    position: 'relative',
    marginTop: 2,
    marginBottom: 4,
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  currentUserAvatar: {
    borderColor: '#1ED760',
    borderWidth: 3,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  activeIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#fff',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1ED760',
    zIndex: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  activeEmoji: {
    fontSize: 14,
  },
  currentUserBadge: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    backgroundColor: '#1ED760',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 2.5,
    borderColor: '#fff',
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  currentUserBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  bar: {
    width: 40,
    minHeight: 10,
    borderRadius: 8,
  },
  stepsLabel: {
    marginTop: 2,
    marginBottom: 5,
    alignItems: 'center',
    width: '100%',
    minHeight: 16,
  },
  stepsText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  rankContainer: {
    marginBottom: 5,
  },
  rankNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
  },
  username: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
    fontWeight: '500',
    width: '100%',
  },
  currentUserUsername: {
    color: '#1ED760',
    fontWeight: '600',
  },
});

