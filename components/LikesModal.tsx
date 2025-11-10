import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { getPostLikes, getCommentLikes } from '../services/postService';
import { useTranslation } from '../lib/i18n';

interface LikesModalProps {
  visible: boolean;
  postId?: string | null;
  commentId?: string | null;
  onClose: () => void;
  onUserPress?: (userId: string) => void;
}

interface LikeUser {
  user_id: string;
  username: string;
  avatar_url: string | null;
  full_name: string | null;
  created_at: string;
}

export default function LikesModal({ visible, postId, commentId, onClose, onUserPress }: LikesModalProps) {
  const { t, language } = useTranslation();
  const [likes, setLikes] = useState<LikeUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && (postId || commentId)) {
      loadLikes();
    } else {
      setLikes([]);
    }
  }, [visible, postId, commentId]);

  const loadLikes = async () => {
    if (!postId && !commentId) return;

    setLoading(true);
    try {
      let data, error;
      if (commentId) {
        const result = await getCommentLikes(commentId);
        data = result.data;
        error = result.error;
      } else if (postId) {
        const result = await getPostLikes(postId);
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error('Error loading likes:', error);
      } else {
        setLikes(data || []);
      }
    } catch (err) {
      console.error('Error in loadLikes:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('screens.likesModal.now');
    if (diffMins < 60) return `${diffMins}${t('screens.likesModal.minutesAgo')}`;
    if (diffHours < 24) return `${diffHours}${t('screens.likesModal.hoursAgo')}`;
    if (diffDays < 7) return `${diffDays}${t('screens.likesModal.daysAgo')}`;
    const locale = language === 'en' ? 'en-US' : 'nb-NO';
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t('screens.likesModal.title')}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.contentContainer}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#1ED760" />
              </View>
            ) : likes.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyEmoji}>🤍</Text>
                <Text style={styles.emptyText}>{t('screens.likesModal.noLikesYet')}</Text>
              </View>
            ) : (
              <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {likes.map((like) => (
                  <TouchableOpacity
                    key={like.user_id}
                    style={styles.userItem}
                    onPress={() => {
                      if (onUserPress) {
                        onUserPress(like.user_id);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.userInfo}>
                      {like.avatar_url ? (
                        <Image
                          source={{ uri: like.avatar_url }}
                          style={styles.avatar}
                        />
                      ) : (
                        <View style={styles.avatarPlaceholder}>
                          <Text style={styles.avatarText}>
                            {like.username.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={styles.userDetails}>
                        <Text style={styles.username}>
                          {like.full_name || like.username}
                        </Text>
                        {like.full_name && (
                          <Text style={styles.usernameSecondary}>
                            @{like.username}
                          </Text>
                        )}
                      </View>
                    </View>
                    <Text style={styles.timeText}>{formatTime(like.created_at)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    height: '80%',
    paddingTop: 20,
    flexDirection: 'column',
  },
  contentContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 60,
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  content: {
    flex: 1,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1ED760',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  userDetails: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  usernameSecondary: {
    fontSize: 14,
    color: '#999',
  },
  timeText: {
    fontSize: 12,
    color: '#999',
  },
});

