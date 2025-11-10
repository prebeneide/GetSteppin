import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import {
  supabase,
} from '../lib/supabase';
import {
  getPostComments,
  addComment,
  deleteComment,
  PostWithDetails,
  PostComment,
  likePost,
  unlikePost,
  likeComment,
  unlikeComment,
  getCommentLikes,
} from '../services/postService';
import AlertModal from '../components/AlertModal';
import MediaGallery from '../components/MediaGallery';
import LikesModal from '../components/LikesModal';
import { getAllImageUrls } from '../services/postService';
import { formatDistance, DistanceUnit } from '../lib/formatters';
import { getUserPreferences } from '../lib/userPreferences';
import { useTranslation } from '../lib/i18n';

interface PostDetailScreenProps {
  navigation: any;
  route: { params: { postId: string } };
}

export default function PostDetailScreen({ navigation, route }: PostDetailScreenProps) {
  const { user } = useAuth();
  const { t, language } = useTranslation();
  const { postId } = route.params;
  const [post, setPost] = useState<PostWithDetails | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [liking, setLiking] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [likesModalVisible, setLikesModalVisible] = useState(false);
  const [commentLikesModalVisible, setCommentLikesModalVisible] = useState(false);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [likingCommentId, setLikingCommentId] = useState<string | null>(null);
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('km');

  useEffect(() => {
    loadPostAndComments();
    loadPreferences();
  }, [postId]);

  useEffect(() => {
    if (user) {
      loadPreferences();
    }
  }, [user]);

  const loadPreferences = async () => {
    try {
      const preferences = await getUserPreferences(user?.id || null);
      setDistanceUnit(preferences.distance_unit);
    } catch (err) {
      console.error('Error loading preferences:', err);
    }
  };

  const loadPostAndComments = async () => {
    setLoading(true);
    try {
      // Load post details
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .select(`
          *,
          user:user_profiles!posts_user_id_fkey(username, avatar_url),
          walk:walks(*)
        `)
        .eq('id', postId)
        .single();

      if (postError) throw postError;

      // Transform post data first
      const transformedPost: PostWithDetails = {
        id: postData.id,
        user_id: postData.user_id,
        walk_id: postData.walk_id,
        content: postData.content,
        image_url: postData.image_url || null,
        images: postData.images || null,
        primary_image_index: postData.primary_image_index || 0,
        map_position: postData.map_position !== undefined ? postData.map_position : -1,
        display_settings: postData.display_settings || null,
        created_at: postData.created_at,
        updated_at: postData.updated_at,
        username: postData.user?.username || t('screens.postDetail.unknown'),
        avatar_url: postData.user?.avatar_url || null,
        walk: postData.walk || null,
        likes_count: 0,
        comments_count: 0,
        is_liked: false,
        has_user_liked: false,
      };

      // Count likes and comments
      const [likesResult, commentsResult, likeCheckResult] = await Promise.all([
        supabase
          .from('post_likes')
          .select('id', { count: 'exact', head: true })
          .eq('post_id', postId),
        supabase
          .from('post_comments')
          .select('id', { count: 'exact', head: true })
          .eq('post_id', postId),
        user ? supabase
          .from('post_likes')
          .select('id')
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .single() : Promise.resolve({ data: null })
      ]);

      const likesCount = likesResult.count || 0;
      const commentsCount = commentsResult.count || 0;
      const isLiked = !!likeCheckResult.data;

      // Update transformed post with counts and like status
      transformedPost.likes_count = likesCount;
      transformedPost.comments_count = commentsCount;
      transformedPost.is_liked = isLiked;
      transformedPost.has_user_liked = isLiked;

      setPost(transformedPost);

      // Load comments
      const { data: commentsData, error: commentsError } = await getPostComments(postId, user?.id || null);

      if (commentsError) throw commentsError;
      setComments(commentsData || []);
    } catch (err) {
      console.error('Error loading post:', err);
      setAlertMessage(t('screens.postDetail.couldNotLoad'));
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (!user || !post || liking) return;

    setLiking(true);
    try {
      if (post.is_liked) {
        await unlikePost(post.id, user.id);
        setPost({
          ...post,
          is_liked: false,
          has_user_liked: false,
          likes_count: post.likes_count - 1,
        });
      } else {
        await likePost(post.id, user.id);
        setPost({
          ...post,
          is_liked: true,
          has_user_liked: true,
          likes_count: post.likes_count + 1,
        });
      }
    } catch (err) {
      console.error('Error liking post:', err);
      setAlertMessage(t('screens.postDetail.couldNotLike'));
      setAlertVisible(true);
    } finally {
      setLiking(false);
    }
  };

  const handleAddComment = async () => {
    if (!user || !commentText.trim() || submitting) return;

    setSubmitting(true);
    try {
      const { data, error } = await addComment(postId, user.id, commentText.trim());

      if (error) throw error;

      if (data) {
        setComments([...comments, data]);
        setPost({
          ...post!,
          comments_count: post!.comments_count + 1,
        });
        setCommentText('');
      }
    } catch (err) {
      console.error('Error adding comment:', err);
      setAlertMessage(t('screens.postDetail.couldNotAddComment'));
      setAlertVisible(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user || submitting) return;

    setSubmitting(true);
    try {
      const { error } = await deleteComment(commentId, user.id);

      if (error) throw error;

      setComments(comments.filter(c => c.id !== commentId));
      setPost({
        ...post!,
        comments_count: Math.max(0, post!.comments_count - 1),
      });
    } catch (err) {
      console.error('Error deleting comment:', err);
      setAlertMessage(t('screens.postDetail.couldNotDeleteComment'));
      setAlertVisible(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLikeComment = async (commentId: string, currentlyLiked: boolean) => {
    if (!user || likingCommentId) return;

    setLikingCommentId(commentId);
    try {
      if (currentlyLiked) {
        await unlikeComment(commentId, user.id);
      } else {
        await likeComment(commentId, user.id);
      }
      
      // Update local state
      setComments(prevComments =>
        prevComments.map(comment =>
          comment.id === commentId
            ? {
                ...comment,
                is_liked: !comment.is_liked,
                likes_count: currentlyLiked ? (comment.likes_count || 0) - 1 : (comment.likes_count || 0) + 1,
              }
            : comment
        )
      );
    } catch (err) {
      console.error('Error liking comment:', err);
      setAlertMessage(t('screens.postDetail.couldNotLikeComment'));
      setAlertVisible(true);
    } finally {
      setLikingCommentId(null);
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
      return t('screens.postDetail.now');
    } else if (diffMins < 60) {
      return `${diffMins} ${t('screens.postDetail.minutesAgo')}`;
    } else if (diffHours < 24) {
      return `${diffHours} ${t('screens.postDetail.hoursAgo')}`;
    } else if (diffDays < 7) {
      return `${diffDays} ${t('screens.postDetail.daysAgo')}`;
    } else {
      const locale = language === 'en' ? 'en-US' : 'no-NO';
      return date.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
  };

  if (loading || !post) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>{t('common.backArrow')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1ED760" />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Tilbake</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {/* Post */}
        <TouchableOpacity
          style={styles.postCard}
          onPress={() => {
            if (post.walk) {
              navigation.navigate('PostWalkDetail', { postId: post.id });
            }
          }}
          activeOpacity={0.95}
          disabled={!post.walk}
        >
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
                <View pointerEvents="box-none">
                  <MediaGallery
                    images={imageUrls}
                    coordinates={post.walk?.route_coordinates || undefined}
                    primaryImageIndex={post.primary_image_index || 0}
                    mapPosition={post.map_position !== undefined ? post.map_position : -1}
                    height={300}
                  />
                </View>
              );
            }
            return null;
          })()}

          <View style={styles.postActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleLike}
              disabled={!user || liking}
              onLongPress={() => {
                if (post.likes_count > 0) {
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
                onPress={() => setLikesModalVisible(true)}
              >
                <Text style={styles.likesCountText}>
                  {post.likes_count === 1 
                    ? `1 ${t('screens.postDetail.personLiked')}` 
                    : `${post.likes_count} ${t('screens.postDetail.peopleLiked')}`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>

        {/* Comments */}
        <View style={styles.commentsSection}>
          <Text style={styles.commentsTitle}>
            {t('screens.postDetail.comments')} ({comments.length})
          </Text>

          {comments.length === 0 ? (
            <Text style={styles.noComments}>{t('screens.postDetail.noComments')}</Text>
          ) : (
            comments.map((comment) => (
              <View key={comment.id} style={styles.commentCard}>
                <View style={styles.commentHeader}>
                  <View style={styles.commentUserInfo}>
                    {comment.avatar_url ? (
                      <Image
                        source={{ uri: comment.avatar_url }}
                        style={styles.commentAvatar}
                      />
                    ) : (
                      <View style={styles.commentAvatarPlaceholder}>
                        <Text style={styles.commentAvatarText}>
                          {comment.username.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.commentInfo}>
                      <Text style={styles.commentUsername}>{comment.username}</Text>
                      <Text style={styles.commentDate}>
                        {formatDate(comment.created_at)}
                      </Text>
                    </View>
                  </View>
                  {user && comment.user_id === user.id && (
                    <TouchableOpacity
                      onPress={() => handleDeleteComment(comment.id)}
                      disabled={submitting}
                      style={styles.deleteButtonContainer}
                    >
                      <Text style={styles.deleteButton}>{t('screens.postDetail.deleteComment')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.commentContent}>{comment.content}</Text>
                {/* Comment Actions */}
                <View style={styles.commentActions}>
                  <TouchableOpacity
                    style={styles.commentActionButton}
                    onPress={() => handleLikeComment(comment.id, comment.is_liked || false)}
                    disabled={!user || likingCommentId === comment.id}
                  >
                    <Text style={[
                      styles.commentActionText,
                      comment.is_liked && styles.commentActionTextLiked
                    ]}>
                      {`${comment.is_liked ? '❤️' : '🤍'} ${comment.likes_count || 0}`}
                    </Text>
                  </TouchableOpacity>
                  {comment.likes_count && comment.likes_count > 0 && (
                    <TouchableOpacity
                      style={styles.commentLikesCountButton}
                      onPress={() => {
                        setSelectedCommentId(comment.id);
                        setCommentLikesModalVisible(true);
                      }}
                    >
                      <Text style={styles.commentLikesCountText}>
                        {comment.likes_count === 1 
                          ? `1 ${t('screens.postDetail.personLiked')}` 
                          : `${comment.likes_count} ${t('screens.postDetail.peopleLiked')}`}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Comment Input */}
      {user && (
        <View style={styles.commentInputContainer}>
          <TextInput
            style={styles.commentInput}
            placeholder={t('screens.postDetail.writeComment')}
            value={commentText}
            onChangeText={setCommentText}
            multiline
            maxLength={500}
            editable={!submitting}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!commentText.trim() || submitting) && styles.sendButtonDisabled
            ]}
            onPress={handleAddComment}
            disabled={!commentText.trim() || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.sendButtonText}>{t('common.save')}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <AlertModal
        visible={alertVisible}
        title={t('common.error')}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
      />

      <LikesModal
        visible={likesModalVisible}
        postId={postId}
        onClose={() => setLikesModalVisible(false)}
        onUserPress={(userId: string) => {
          // Navigate to user profile if needed
          // For now, just close the modal
          setLikesModalVisible(false);
        }}
      />

      <LikesModal
        visible={commentLikesModalVisible}
        commentId={selectedCommentId}
        onClose={() => {
          setCommentLikesModalVisible(false);
          setSelectedCommentId(null);
        }}
        onUserPress={(userId: string) => {
          // Navigate to user profile if needed
          // For now, just close the modal
          setCommentLikesModalVisible(false);
          setSelectedCommentId(null);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
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
  },
  backButtonText: {
    fontSize: 16,
    color: '#1ED760',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  postCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
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
  likesCountButton: {
    flex: 1,
    paddingVertical: 4,
  },
  likesCountText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  commentsSection: {
    marginTop: 20,
  },
  commentsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  noComments: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    padding: 20,
  },
  commentCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    width: '100%',
  },
  commentUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  commentInfo: {
    flex: 1,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  commentAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1ED760',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentAvatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  commentDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  commentContent: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 8,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  commentActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentActionText: {
    fontSize: 14,
    color: '#666',
  },
  commentActionTextLiked: {
    color: '#1ED760',
  },
  commentLikesCountButton: {
    flex: 1,
    paddingVertical: 4,
  },
  commentLikesCountText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  deleteButtonContainer: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deleteButton: {
    fontSize: 12,
    color: '#F44336',
    fontWeight: '600',
  },
  commentInputContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
    gap: 12,
    position: 'relative',
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
    backgroundColor: '#f9f9f9',
  },
  sendButton: {
    backgroundColor: '#1ED760',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

