import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import StatisticsView from '../components/StatisticsView';
import AchievementsView from '../components/AchievementsView';
import OnlineIndicator from '../components/OnlineIndicator';
import MediaGallery from '../components/MediaGallery';
import LikesModal from '../components/LikesModal';
import AlertModal from '../components/AlertModal';
import { getFriendCount } from '../services/friendService';
import { getTotalSteps, getTotalDistanceKm } from '../services/stepService';
import { getUserPosts, PostWithDetails, likePost, unlikePost, getAllImageUrls } from '../services/postService';
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
  const { t, language } = useTranslation();
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
  const [posts, setPosts] = useState<PostWithDetails[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [likingPostId, setLikingPostId] = useState<string | null>(null);
  const [likesModalVisible, setLikesModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  useEffect(() => {
    if (friendId) {
      loadFriendProfile();
      loadPosts();
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
        loadPosts();
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

  const loadPosts = async () => {
    if (!friendId) return;
    
    setLoadingPosts(true);
    try {
      const { data, error } = await getUserPosts(friendId, user?.id || null, 50, 0);

      if (error) throw error;
      setPosts(data || []);
    } catch (err) {
      console.error('Error loading posts:', err);
      setAlertMessage(t('screens.feed.couldNotLoad'));
      setAlertVisible(true);
    } finally {
      setLoadingPosts(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadFriendProfile(), loadPosts()]);
    setRefreshing(false);
  };

  const handleLike = async (postId: string, currentlyLiked: boolean) => {
    if (!user || likingPostId) return;

    setLikingPostId(postId);
    try {
      if (currentlyLiked) {
        await unlikePost(postId, user.id);
      } else {
        await likePost(postId, user.id);
      }
      
      // Update local state
      setPosts(prevPosts =>
        prevPosts.map(post =>
          post.id === postId
            ? {
                ...post,
                is_liked: !post.is_liked,
                has_user_liked: !post.has_user_liked,
                likes_count: currentlyLiked ? post.likes_count - 1 : post.likes_count + 1,
              }
            : post
        )
      );
    } catch (err) {
      console.error('Error liking post:', err);
      setAlertMessage(t('screens.feed.couldNotLike'));
      setAlertVisible(true);
    } finally {
      setLikingPostId(null);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return t('screens.feed.now');
    } else if (diffMins < 60) {
      return `${diffMins} ${t('screens.feed.minutesAgo')}`;
    } else if (diffHours < 24) {
      return `${diffHours} ${t('screens.feed.hoursAgo')}`;
    } else if (diffDays < 7) {
      return `${diffDays} ${t('screens.feed.daysAgo')}`;
    } else {
      const locale = language === 'en' ? 'en-US' : 'no-NO';
      return date.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}t ${mins}m`;
    }
    return `${mins}m`;
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
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
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
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
              {formatLargeNumber(friendCount)}
            </Text>
            <Text style={styles.statLabel}>{t('screens.friendProfile.friends')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
              {formatLargeNumber(totalSteps)}
            </Text>
            <Text style={styles.statLabel} numberOfLines={2}>{t('screens.home.steps')} {t('screens.home.total')}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
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

      {/* Achievements Section - Moved above Statistics */}
      <View style={styles.section}>
        <AchievementsView userId={friendId} isLoggedIn={true} />
      </View>

      {/* Statistics Section */}
      <View style={styles.section}>
        <StatisticsView userId={friendId} isLoggedIn={true} />
      </View>

      {/* Shared Walks Section */}
      <View style={styles.sharedWalksSection}>
        <Text style={styles.sectionTitle}>{t('screens.friendProfile.sharedWalks')}</Text>
        {loadingPosts ? (
          <View style={styles.postsLoadingContainer}>
            <ActivityIndicator size="small" color="#1ED760" />
          </View>
        ) : posts.length === 0 ? (
          <View style={styles.emptyPostsContainer}>
            <Text style={styles.emptyPostsText}>
              {t('screens.friendProfile.noSharedWalks')}
            </Text>
          </View>
        ) : (
          <View style={styles.postsContainer}>
            {posts.map((post) => (
            <TouchableOpacity
              key={post.id}
              style={styles.postCard}
              onPress={() => {
                if (post.walk) {
                  navigation.navigate('PostWalkDetail', { postId: post.id });
                }
              }}
              activeOpacity={0.95}
            >
              {/* Post Header */}
              <View style={styles.postHeader}>
                <View style={styles.userInfo}>
                  {post.avatar_url ? (
                    <Image
                      source={{ uri: post.avatar_url }}
                      style={styles.postAvatar}
                    />
                  ) : (
                    <View style={styles.postAvatarPlaceholder}>
                      <Text style={styles.avatarText}>
                        {post.username.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View>
                    <Text style={styles.postUsername}>{post.username}</Text>
                    <Text style={styles.postDate}>{formatDate(post.created_at)}</Text>
                  </View>
                </View>
              </View>

              {/* Walk Info */}
              {post.walk && (
                <View style={styles.walkInfo}>
                  <Text style={styles.walkTitle}>
                    👣 {formatDistance(post.walk.distance_meters, distanceUnit)} {t('common.walk')}
                  </Text>
                  <Text style={styles.walkStats}>
                    {post.display_settings?.show_duration !== false && formatDuration(post.walk.duration_minutes)}
                    {post.display_settings?.show_duration !== false && post.walk.steps > 0 && ' • '}
                    {post.walk.steps > 0 && `${post.walk.steps.toLocaleString()} ${t('common.steps')}`}
                  </Text>
                </View>
              )}

              {/* Post Content */}
              {post.content && (
                <Text style={styles.postContent}>{post.content}</Text>
              )}

              {/* Media Gallery (images + map in same slider, like Strava) */}
              {(() => {
                const imageUrls = getAllImageUrls(post);
                const hasImages = imageUrls.length > 0;
                const hasMap = post.walk && post.walk.route_coordinates && post.walk.route_coordinates.length > 0;
                
                if (hasImages || hasMap) {
                  return (
                    <MediaGallery
                      images={imageUrls}
                      coordinates={post.walk?.route_coordinates || undefined}
                      primaryImageIndex={post.primary_image_index || 0}
                      mapPosition={post.map_position !== undefined ? post.map_position : -1}
                      height={300}
                    />
                  );
                }
                return null;
              })()}

              {/* Post Actions */}
              <View style={styles.postActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleLike(post.id, post.is_liked);
                  }}
                  disabled={likingPostId === post.id}
                  onLongPress={(e) => {
                    e.stopPropagation();
                    if (post.likes_count > 0) {
                      setSelectedPostId(post.id);
                      setLikesModalVisible(true);
                    }
                  }}
                >
                  <Text style={[
                    styles.actionText,
                    post.is_liked && styles.actionTextLiked
                  ]}>
                    {post.is_liked ? '❤️' : '🤍'} {post.likes_count || 0}
                  </Text>
                </TouchableOpacity>
                {post.likes_count > 0 && (
                  <TouchableOpacity
                    style={styles.likesCountButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      setSelectedPostId(post.id);
                      setLikesModalVisible(true);
                    }}
                  >
                    <Text style={styles.likesCountText}>
                        {post.likes_count === 1 
                        ? t('screens.feed.onePersonLiked') 
                        : `${post.likes_count} ${t('screens.feed.peopleLiked')}`}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    navigation.navigate('PostDetail', { postId: post.id });
                  }}
                >
                  <Text style={styles.actionText}>
                    💬 {post.comments_count || 0}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <AlertModal
        visible={alertVisible}
        title={t('common.error')}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
      />

      <LikesModal
        visible={likesModalVisible}
        postId={selectedPostId}
        onClose={() => {
          setLikesModalVisible(false);
          setSelectedPostId(null);
        }}
        onUserPress={(userId: string) => {
          // Navigate to user profile if needed
          // For now, just close the modal
          setLikesModalVisible(false);
          setSelectedPostId(null);
        }}
      />
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
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingVertical: 15,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: '100%',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    minWidth: 90,
    paddingHorizontal: 5,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
    flexShrink: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 10,
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
  sharedWalksSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  postsContainer: {
    // Container for posts - spacing handled by postCard marginBottom
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
  postsLoadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyPostsContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyPostsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  postCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  postDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  postUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  postAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1ED760',
    justifyContent: 'center',
    alignItems: 'center',
  },
  walkInfo: {
    backgroundColor: '#e8f5e9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  walkTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1ED760',
    marginBottom: 4,
  },
  walkStats: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  postContent: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
    marginBottom: 12,
  },
  postActions: {
    flexDirection: 'row',
    gap: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 16,
    color: '#666',
  },
  actionTextLiked: {
    color: '#1ED760',
  },
  likesCountButton: {
    flex: 1,
    paddingVertical: 4,
  },
  likesCountText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
});

