import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { getUserWalks, Walk, markWalksAsViewed } from '../services/walkService';
import { getDeviceId } from '../lib/deviceId';
import { getPostByWalkId, getAllImageUrls, PostWithDetails, likePost, unlikePost } from '../services/postService';
import { supabase } from '../lib/supabase';
import AlertModal from '../components/AlertModal';
import MediaGallery from '../components/MediaGallery';
import LikesModal from '../components/LikesModal';
import WalkMapView from '../components/WalkMapView';
import { useFocusEffect } from '@react-navigation/native';
import { formatDistance, DistanceUnit } from '../lib/formatters';
import { getUserPreferences } from '../lib/userPreferences';
import { useTranslation } from '../lib/i18n';

interface MyWalksScreenProps {
  navigation: any;
}

interface WalkWithPost extends Walk {
  post?: PostWithDetails | null;
}

export default function MyWalksScreen({ navigation }: MyWalksScreenProps) {
  const { user } = useAuth();
  const { t, language } = useTranslation();
  const [walks, setWalks] = useState<WalkWithPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [likingPostId, setLikingPostId] = useState<string | null>(null);
  const [likesModalVisible, setLikesModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('km');

  useEffect(() => {
    loadWalks();
    loadPreferences();
  }, [user]);

  const loadPreferences = async () => {
    try {
      const preferences = await getUserPreferences(user?.id || null);
      setDistanceUnit(preferences.distance_unit);
    } catch (err) {
      console.error('Error loading preferences:', err);
    }
  };

  // Mark walks as viewed when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const markAsViewed = async () => {
        // Reload preferences when screen comes into focus
        await loadPreferences();
        // Reload walks to get current state
        const currentWalks = await loadWalks();
        
        if (currentWalks && currentWalks.length > 0) {
          const unviewedWalkIds = currentWalks
            .filter(walk => !walk.is_viewed)
            .map(walk => walk.id);
          
          if (unviewedWalkIds.length > 0) {
            let deviceId: string | null = null;
            if (!user) {
              deviceId = await getDeviceId();
            }
            
            await markWalksAsViewed(user?.id || null, deviceId, unviewedWalkIds);
            
            // Reload walks to reflect updated state
            loadWalks();
          }
        }
      };

      markAsViewed();
    }, [user])
  );

  const loadWalks = async (): Promise<WalkWithPost[]> => {
    setLoading(true);
    try {
      let deviceId: string | null = null;
      if (!user) {
        deviceId = await getDeviceId();
      }

      const { data, error } = await getUserWalks(user?.id || null, deviceId, 50);

      if (error) throw error;

      // Load post data for shared walks
      const walksWithPosts: WalkWithPost[] = await Promise.all(
        (data || []).map(async (walk: Walk): Promise<WalkWithPost> => {
          if (walk.is_shared && user) {
            try {
              const { data: postData } = await getPostByWalkId(walk.id);
              
              if (postData) {
                // Get full post details (likes, comments, etc.)
                const { data: fullPostData, error: postError } = await supabase
                  .from('posts')
                  .select(`
                    *,
                    user:user_profiles!posts_user_id_fkey(username, avatar_url)
                  `)
                  .eq('id', postData.id)
                  .single();

                if (!postError && fullPostData) {
                  // Count likes and comments
                  const [likesResult, commentsResult, likeCheckResult] = await Promise.all([
                    supabase
                      .from('post_likes')
                      .select('id', { count: 'exact', head: true })
                      .eq('post_id', fullPostData.id),
                    supabase
                      .from('post_comments')
                      .select('id', { count: 'exact', head: true })
                      .eq('post_id', fullPostData.id),
                    user ? supabase
                      .from('post_likes')
                      .select('id')
                      .eq('post_id', fullPostData.id)
                      .eq('user_id', user.id)
                      .single() : Promise.resolve({ data: null })
                  ]);

                  const likesCount = likesResult.count || 0;
                  const commentsCount = commentsResult.count || 0;
                  const isLiked = !!likeCheckResult.data;

                  const postWithDetails: PostWithDetails = {
                    id: fullPostData.id,
                    user_id: fullPostData.user_id,
                    walk_id: fullPostData.walk_id,
                    content: fullPostData.content,
                    image_url: fullPostData.image_url || null,
                    images: fullPostData.images || null,
                    primary_image_index: fullPostData.primary_image_index || 0,
                    map_position: fullPostData.map_position !== undefined ? fullPostData.map_position : -1,
                    display_settings: fullPostData.display_settings || null,
                    created_at: fullPostData.created_at,
                    updated_at: fullPostData.updated_at,
                    username: fullPostData.user?.username || t('screens.myWalks.unknown'),
                    avatar_url: fullPostData.user?.avatar_url || null,
                    walk: walk,
                    likes_count: likesCount,
                    comments_count: commentsCount,
                    is_liked: isLiked,
                    has_user_liked: isLiked,
                  };
                  return { ...walk, post: postWithDetails };
                }
              }
            } catch (err) {
              console.error('Error loading post for walk:', err);
            }
          }
          return { ...walk, post: null };
        })
      );

      setWalks(walksWithPosts);
      return walksWithPosts;
    } catch (err) {
      console.error('Error loading walks:', err);
      setAlertMessage(t('screens.myWalks.couldNotLoad'));
      setAlertVisible(true);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // formatDistance is now imported from lib/formatters.ts

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}t ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return t('screens.myWalks.now');
    } else if (diffMins < 60) {
      return `${diffMins} ${t('screens.myWalks.minutesAgo')}`;
    } else if (diffHours < 24) {
      return `${diffHours} ${t('screens.myWalks.hoursAgo')}`;
    } else if (diffDays < 7) {
      return `${diffDays} ${t('screens.myWalks.daysAgo')}`;
    } else {
      const locale = language === 'en' ? 'en-US' : 'no-NO';
      return date.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
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
      setWalks(prevWalks =>
        prevWalks.map(walk => {
          if (walk.post && walk.post.id === postId) {
            return {
              ...walk,
              post: {
                ...walk.post,
                is_liked: !walk.post.is_liked,
                has_user_liked: !walk.post.has_user_liked,
                likes_count: currentlyLiked ? walk.post.likes_count - 1 : walk.post.likes_count + 1,
              }
            };
          }
          return walk;
        })
      );
    } catch (err) {
      console.error('Error liking post:', err);
      setAlertMessage(t('screens.myWalks.couldNotLike'));
      setAlertVisible(true);
    } finally {
      setLikingPostId(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← {t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('screens.myWalks.title')}</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1ED760" />
        </View>
      ) : walks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>👣</Text>
          <Text style={styles.emptyText}>{t('screens.myWalks.empty')}</Text>
          <Text style={styles.emptySubtext}>
            {t('screens.myWalks.emptySubtext')}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {walks.map((walk) => {
            // If walk has a post, show it like in feed
            if (walk.post) {
              return (
                <TouchableOpacity
                  key={walk.id}
                  style={styles.postCard}
                  onPress={() => {
                    navigation.navigate('WalkDetail', { walkId: walk.id });
                  }}
                  activeOpacity={0.95}
                >
                  {/* Post Header */}
                  <View style={styles.postHeader}>
                    <View style={styles.userInfo}>
                      {walk.post.avatar_url ? (
                        <Image
                          source={{ uri: walk.post.avatar_url }}
                          style={styles.avatar}
                        />
                      ) : (
                        <View style={styles.avatarPlaceholder}>
                          <Text style={styles.avatarText}>
                            {(walk.post.username || '?').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View>
                        <Text style={styles.username}>{walk.post.username}</Text>
                        <Text style={styles.postDate}>{formatDate(walk.post.created_at)}</Text>
                      </View>
                    </View>
                    {/* Shared badge - show "Delt" or "Ikke delt" based on is_public */}
                    {walk.is_shared && (
                      <View style={[
                        styles.sharedBadge,
                        walk.post?.display_settings?.is_public === false && styles.notSharedBadge
                      ]}>
                        <Text style={[
                          styles.sharedBadgeText,
                          walk.post?.display_settings?.is_public === false && styles.notSharedBadgeText
                        ]}>
                          {walk.post?.display_settings?.is_public === false ? `✗ ${t('screens.myWalks.notShared')}` : `✓ ${t('screens.myWalks.shared')}`}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Walk Info */}
                  {walk.post.walk && (
                    <View style={styles.walkInfo}>
                      <Text style={styles.walkTitle}>
                        👣 {formatDistance(walk.post.walk.distance_meters, distanceUnit)} {t('common.walk')}
                      </Text>
                      <Text style={styles.walkStats}>
                        {walk.post.display_settings?.show_duration !== false && formatDuration(walk.post.walk.duration_minutes)}
                        {walk.post.display_settings?.show_duration !== false && walk.post.walk.steps > 0 && ' • '}
                        {walk.post.walk.steps > 0 && `${walk.post.walk.steps.toLocaleString()} ${t('common.steps')}`}
                      </Text>
                    </View>
                  )}

                  {/* Post Content */}
                  {walk.post.content && (
                    <Text style={styles.postContent}>{walk.post.content}</Text>
                  )}

                  {/* Media Gallery (images + map in same slider, like Strava) */}
                  {(() => {
                    const imageUrls = getAllImageUrls(walk.post);
                    const hasImages = imageUrls.length > 0;
                    const hasMap = walk.post.walk && walk.post.walk.route_coordinates && walk.post.walk.route_coordinates.length > 0;
                    
                    if (hasImages || hasMap) {
                      return (
                        <MediaGallery
                          images={imageUrls}
                          coordinates={walk.post.walk?.route_coordinates || undefined}
                          primaryImageIndex={walk.post.primary_image_index || 0}
                          mapPosition={walk.post.map_position !== undefined ? walk.post.map_position : -1}
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
                        handleLike(walk.post!.id, walk.post!.is_liked);
                      }}
                      disabled={!user || likingPostId === walk.post!.id}
                      onLongPress={(e) => {
                        e.stopPropagation();
                        if (walk.post!.likes_count > 0) {
                          setSelectedPostId(walk.post!.id);
                          setLikesModalVisible(true);
                        }
                      }}
                    >
                      <Text style={[
                        styles.actionText,
                        walk.post.is_liked && styles.actionTextLiked
                      ]}>
                        {walk.post.is_liked ? '❤️' : '🤍'} {walk.post.likes_count || 0}
                      </Text>
                    </TouchableOpacity>
                    {walk.post.likes_count > 0 && (
                      <TouchableOpacity
                        style={styles.likesCountButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          setSelectedPostId(walk.post!.id);
                          setLikesModalVisible(true);
                        }}
                      >
                        <Text style={styles.likesCountText}>
                          {walk.post.likes_count === 1 
                            ? t('screens.myWalks.onePersonLiked') 
                            : `${walk.post.likes_count} ${t('screens.myWalks.peopleLiked')}`}
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        navigation.navigate('PostDetail', { postId: walk.post!.id });
                      }}
                    >
                      <Text style={styles.actionText}>
                        💬 {walk.post.comments_count || 0}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            }

            // Otherwise, show as regular walk card
            return (
              <TouchableOpacity
                key={walk.id}
                style={styles.walkCard}
                onPress={() => navigation.navigate('WalkDetail', { walkId: walk.id })}
              >
                {/* Map preview */}
                {Array.isArray(walk.route_coordinates) && walk.route_coordinates.length >= 2 && (
                  <View style={styles.mapWrapper}>
                    <WalkMapView
                      coordinates={walk.route_coordinates}
                      height={180}
                      showOpenButton={false}
                    />
                  </View>
                )}

                <View style={styles.walkHeader}>
                  <Text style={styles.walkDistance}>
                    {formatDistance(walk.distance_meters, distanceUnit)}
                  </Text>
                  {/* Shared badge - show "Delt" or "Ikke delt" based on is_public */}
                  {walk.is_shared && walk.post && (
                    <View style={[
                      styles.sharedBadge,
                      (walk.post as PostWithDetails).display_settings?.is_public === false && styles.notSharedBadge
                    ]}>
                      <Text style={[
                        styles.sharedBadgeText,
                        (walk.post as PostWithDetails).display_settings?.is_public === false && styles.notSharedBadgeText
                      ]}>
                        {(walk.post as PostWithDetails).display_settings?.is_public === false ? `✗ ${t('screens.myWalks.notShared')}` : `✓ ${t('screens.myWalks.shared')}`}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.walkStatsContainer}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>{t('common.duration')}</Text>
                    <Text style={styles.statValue}>
                      {formatDuration(walk.duration_minutes)}
                    </Text>
                  </View>
                  {walk.average_speed_kmh && (
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Hastighet</Text>
                      <Text style={styles.statValue}>
                        {walk.average_speed_kmh.toFixed(1)} km/h
                      </Text>
                    </View>
                  )}
                  {walk.steps > 0 && (
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Skritt</Text>
                      <Text style={styles.statValue}>
                        {walk.steps.toLocaleString()}
                      </Text>
                    </View>
                  )}
                </View>

                <Text style={styles.walkDate}>
                  {formatDate(walk.start_time)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

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
          setLikesModalVisible(false);
          setSelectedPostId(null);
          navigation.navigate('FriendProfile', { friendId: userId });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  backButtonText: {
    fontSize: 16,
    color: '#1ED760',
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  // Post card styles (same as FeedScreen)
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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1ED760',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  postDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
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
  sharedBadge: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1.5,
    borderColor: '#1ED760',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  notSharedBadge: {
    backgroundColor: '#FFEBEE',
    borderColor: '#F44336',
  },
  sharedBadgeText: {
    color: '#1ED760',
    fontSize: 12,
    fontWeight: '600',
  },
  notSharedBadgeText: {
    color: '#F44336',
  },
  // Regular walk card styles (for non-shared walks)
  walkCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  mapWrapper: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#f0f0f0',
  },
  walkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  walkDistance: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1ED760',
  },
  walkStatsContainer: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  walkDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
});

