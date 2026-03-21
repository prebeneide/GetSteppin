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
import { useAuth } from '../contexts/AuthContext';
import { getFeedPosts, PostWithDetails, likePost, unlikePost } from '../services/postService';
import { getFriends } from '../services/friendService';
import { getFriendsRecentActivities, FriendActivity } from '../services/achievementService';
import AlertModal from '../components/AlertModal';
import MediaGallery from '../components/MediaGallery';
import LikesModal from '../components/LikesModal';
import { getAllImageUrls } from '../services/postService';
import { formatDistance, DistanceUnit } from '../lib/formatters';
import { getUserPreferences } from '../lib/userPreferences';
import { useTranslation } from '../lib/i18n';

interface FeedScreenProps {
  navigation: any;
}

type FeedItem =
  | { kind: 'post'; data: PostWithDetails }
  | { kind: 'activity'; data: FriendActivity };

export default function FeedScreen({ navigation }: FeedScreenProps) {
  const { user } = useAuth();
  const { t, language } = useTranslation();
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [likingPostId, setLikingPostId] = useState<string | null>(null);
  const [likesModalVisible, setLikesModalVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('km');
  const [hasFriends, setHasFriends] = useState<boolean | null>(null);

  useEffect(() => {
    if (user) {
      loadFeed();
      loadPreferences();
    }
  }, [user]);

  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        loadFeed();
        loadPreferences();
      }
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

  const loadFeed = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data: friends, error: friendsError } = await getFriends(user.id);
      if (friendsError) {
        console.error('Error loading friends:', friendsError);
        setHasFriends(null);
      } else {
        setHasFriends((friends || []).length > 0);
      }

      const friendIds = (friends || []).map(f => f.id);

      const [postsResult, activitiesResult] = await Promise.all([
        getFeedPosts(user.id, 20, 0),
        friendIds.length > 0 ? getFriendsRecentActivities(friendIds) : Promise.resolve({ data: [], error: null }),
      ]);

      if (postsResult.error) throw postsResult.error;

      const posts: FeedItem[] = (postsResult.data || []).map(p => ({ kind: 'post', data: p }));
      const activities: FeedItem[] = (activitiesResult.data || []).map(a => ({ kind: 'activity', data: a }));

      // Merge and sort by date descending
      const merged = [...posts, ...activities].sort((a, b) => {
        const dateA = a.kind === 'post' ? a.data.created_at : a.data.earned_at;
        const dateB = b.kind === 'post' ? b.data.created_at : b.data.earned_at;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });

      setFeedItems(merged);
    } catch (err) {
      console.error('Error loading feed:', err);
      setAlertMessage(t('screens.feed.couldNotLoad'));
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFeed();
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

      setFeedItems(prev =>
        prev.map(item =>
          item.kind === 'post' && item.data.id === postId
            ? {
                ...item,
                data: {
                  ...item.data,
                  is_liked: !item.data.is_liked,
                  has_user_liked: !item.data.has_user_liked,
                  likes_count: currentlyLiked ? item.data.likes_count - 1 : item.data.likes_count + 1,
                },
              }
            : item
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
    if (hours > 0) return `${hours}t ${mins}m`;
    return `${mins}m`;
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>← {t('common.back')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{t('screens.feed.loginPrompt')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← {t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('screens.feed.title')}</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1ED760" />
        </View>
      ) : feedItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📰</Text>
          <Text style={styles.emptyText}>
            {hasFriends === false ? t('screens.feed.noFriends') : t('screens.feed.noPosts')}
          </Text>
          <Text style={styles.emptySubtext}>
            {hasFriends === false ? t('screens.feed.noFriendsSubtext') : t('screens.feed.noPostsSubtext')}
          </Text>
          {hasFriends === false && (
            <TouchableOpacity
              style={styles.addFriendsButton}
              onPress={() => navigation.navigate('AddFriend')}
            >
              <Text style={styles.addFriendsButtonText}>
                {language === 'en' ? 'Find Friends' : 'Finn venner'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {feedItems.map((item, index) => {
            if (item.kind === 'activity') {
              const act = item.data;
              return (
                <View key={`activity-${act.user_id}-${act.earned_at}-${index}`} style={styles.activityCard}>
                  <View style={styles.activityLeft}>
                    {act.avatar_url ? (
                      <Image source={{ uri: act.avatar_url }} style={styles.activityAvatar} />
                    ) : (
                      <View style={styles.activityAvatarPlaceholder}>
                        <Text style={styles.activityAvatarText}>
                          {(act.username || '?').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.activityBody}>
                    <Text style={styles.activityText}>
                      <Text style={styles.activityUsername}>{act.username}</Text>
                      {' '}
                      {language === 'en' ? 'earned' : 'fikk'}
                      {' '}
                      <Text style={styles.activityBadge}>{act.achievement_emoji} {act.achievement_name}</Text>
                    </Text>
                    <Text style={styles.activityTime}>{formatDate(act.earned_at)}</Text>
                  </View>
                </View>
              );
            }

            const post = item.data;
            return (
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
                      <Image source={{ uri: post.avatar_url }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarText}>
                          {(post.username || '?').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View>
                      <Text style={styles.username}>{post.username}</Text>
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

                {/* Media Gallery */}
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
                    <Text style={[styles.actionText, post.is_liked && styles.actionTextLiked]}>
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
                    <Text style={styles.actionText}>💬 {post.comments_count || 0}</Text>
                  </TouchableOpacity>
                </View>
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
        onUserPress={() => {
          setLikesModalVisible(false);
          setSelectedPostId(null);
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
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  addFriendsButton: {
    backgroundColor: '#1ED760',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  addFriendsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  // Activity card
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0faf4',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#d0edd8',
  },
  activityLeft: {
    marginRight: 12,
  },
  activityAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  activityAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1ED760',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  activityBody: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  activityUsername: {
    fontWeight: '700',
    color: '#222',
  },
  activityBadge: {
    fontWeight: '600',
    color: '#1a9e4a',
  },
  activityTime: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  // Walk post card
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
});
