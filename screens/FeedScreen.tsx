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
import { useAuth } from '../contexts/AuthContext';
import { getFeedPosts, PostWithDetails, likePost, unlikePost } from '../services/postService';
import AlertModal from '../components/AlertModal';
import WalkMapView from '../components/WalkMapView';

interface FeedScreenProps {
  navigation: any;
}

export default function FeedScreen({ navigation }: FeedScreenProps) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [likingPostId, setLikingPostId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadPosts();
    }
  }, [user]);

  const loadPosts = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await getFeedPosts(user.id, 20, 0);

      if (error) throw error;
      setPosts(data || []);
    } catch (err) {
      console.error('Error loading posts:', err);
      setAlertMessage('Kunne ikke laste innlegg');
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPosts();
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
      setAlertMessage('Kunne ikke like innlegg');
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
      return 'Nå';
    } else if (diffMins < 60) {
      return `${diffMins} min siden`;
    } else if (diffHours < 24) {
      return `${diffHours} timer siden`;
    } else if (diffDays < 7) {
      return `${diffDays} dager siden`;
    } else {
      return date.toLocaleDateString('no-NO', {
        day: 'numeric',
        month: 'short',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
  };

  const formatDistance = (meters: number): string => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${meters} m`;
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}t ${mins}m`;
    }
    return `${mins}m`;
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>← Tilbake</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Logg inn for å se feed</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Tilbake</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Feed</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1ED760" />
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>📰</Text>
          <Text style={styles.emptyText}>Ingen innlegg ennå</Text>
          <Text style={styles.emptySubtext}>
            Innlegg fra venner og populære innlegg vil vises her
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {posts.map((post) => (
            <View key={post.id} style={styles.postCard}>
              {/* Post Header */}
              <View style={styles.postHeader}>
                <View style={styles.userInfo}>
                  {post.avatar_url ? (
                    <Image
                      source={{ uri: post.avatar_url }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarText}>
                        {post.username.charAt(0).toUpperCase()}
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
                <>
                  <View style={styles.walkInfo}>
                    <Text style={styles.walkTitle}>
                      👣 {formatDistance(post.walk.distance_meters)} tur
                    </Text>
                    <Text style={styles.walkStats}>
                      {formatDuration(post.walk.duration_minutes)} •{' '}
                      {post.walk.steps > 0 && `${post.walk.steps.toLocaleString()} skritt`}
                    </Text>
                  </View>
                  
                  {/* Map View */}
                  {post.walk.route_coordinates && post.walk.route_coordinates.length > 0 && (
                    <WalkMapView
                      coordinates={post.walk.route_coordinates}
                      height={200}
                      showOpenButton={false}
                    />
                  )}
                </>
              )}

              {/* Post Content */}
              {post.content && (
                <Text style={styles.postContent}>{post.content}</Text>
              )}

              {/* Post Image */}
              {post.image_url && (
                <Image
                  source={{ uri: post.image_url }}
                  style={styles.postImage}
                  resizeMode="cover"
                />
              )}

              {/* Post Actions */}
              <View style={styles.postActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleLike(post.id, post.is_liked)}
                  disabled={likingPostId === post.id}
                >
                  <Text style={[
                    styles.actionText,
                    post.is_liked && styles.actionTextLiked
                  ]}>
                    {post.is_liked ? '❤️' : '🤍'} {post.likes_count || 0}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
                >
                  <Text style={styles.actionText}>
                    💬 {post.comments_count || 0}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <AlertModal
        visible={alertVisible}
        title="Feil"
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
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
  viewWalkButton: {
    alignSelf: 'flex-start',
  },
  viewWalkText: {
    fontSize: 14,
    color: '#1ED760',
    fontWeight: '600',
  },
  postContent: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
    marginBottom: 12,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
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
});

