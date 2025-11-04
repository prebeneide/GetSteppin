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
} from '../services/postService';
import AlertModal from '../components/AlertModal';
import MediaGallery from '../components/MediaGallery';
import { getAllImageUrls } from '../services/postService';

interface PostDetailScreenProps {
  navigation: any;
  route: { params: { postId: string } };
}

export default function PostDetailScreen({ navigation, route }: PostDetailScreenProps) {
  const { user } = useAuth();
  const { postId } = route.params;
  const [post, setPost] = useState<PostWithDetails | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [liking, setLiking] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  useEffect(() => {
    loadPostAndComments();
  }, [postId]);

  const loadPostAndComments = async () => {
    setLoading(true);
    try {
      // Load post details
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .select(`
          *,
          user:user_profiles!posts_user_id_fkey(username, avatar_url),
          walk:walks(*),
          likes:post_likes(count),
          comments:post_comments(count)
        `)
        .eq('id', postId)
        .single();

      if (postError) throw postError;

      // Transform post data
      const transformedPost: PostWithDetails = {
        id: postData.id,
        user_id: postData.user_id,
        walk_id: postData.walk_id,
        content: postData.content,
        image_url: postData.image_url || null,
        images: postData.images || null,
        primary_image_index: postData.primary_image_index || 0,
        map_position: postData.map_position !== undefined ? postData.map_position : -1,
        created_at: postData.created_at,
        updated_at: postData.updated_at,
        username: postData.user?.username || 'Ukjent',
        avatar_url: postData.user?.avatar_url || null,
        walk: postData.walk || null,
        likes_count: postData.likes?.length || 0,
        comments_count: postData.comments?.length || 0,
        is_liked: false,
        has_user_liked: false,
      };

      // Check if user liked this post
      if (user) {
        const { data: likeData } = await supabase
          .from('post_likes')
          .select('id')
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .single();

        transformedPost.is_liked = !!likeData;
        transformedPost.has_user_liked = !!likeData;
      }

      setPost(transformedPost);

      // Load comments
      const { data: commentsData, error: commentsError } = await getPostComments(postId);

      if (commentsError) throw commentsError;
      setComments(commentsData || []);
    } catch (err) {
      console.error('Error loading post:', err);
      setAlertMessage('Kunne ikke laste innlegg');
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
      setAlertMessage('Kunne ikke like innlegg');
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
      setAlertMessage('Kunne ikke legge til kommentar');
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
      setAlertMessage('Kunne ikke slette kommentar');
      setAlertVisible(true);
    } finally {
      setSubmitting(false);
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

  if (loading || !post) {
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
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1ED760" />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
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
      >
        {/* Post */}
        <View style={styles.postCard}>
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

          <View style={styles.postActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleLike}
              disabled={!user || liking}
            >
              <Text style={[
                styles.actionText,
                post.is_liked && styles.actionTextLiked
              ]}>
                {post.is_liked ? '❤️' : '🤍'} {post.likes_count || 0}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Comments */}
        <View style={styles.commentsSection}>
          <Text style={styles.commentsTitle}>
            Kommentarer ({comments.length})
          </Text>

          {comments.length === 0 ? (
            <Text style={styles.noComments}>Ingen kommentarer ennå</Text>
          ) : (
            comments.map((comment) => (
              <View key={comment.id} style={styles.commentCard}>
                <View style={styles.commentHeader}>
                  <View style={styles.userInfo}>
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
                    >
                      <Text style={styles.deleteButton}>Slett</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.commentContent}>{comment.content}</Text>
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
            placeholder="Legg til en kommentar..."
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
              <Text style={styles.sendButtonText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <AlertModal
        visible={alertVisible}
        title="Feil"
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
      />
    </KeyboardAvoidingView>
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

