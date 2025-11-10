import React, { useState, useEffect, useCallback } from 'react';
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
import {
  getConversations,
  type ChatConversation,
} from '../services/chatService';
import OnlineIndicator from '../components/OnlineIndicator';
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

interface ChatListScreenProps {
  navigation: any;
}

export default function ChatListScreen({ navigation }: ChatListScreenProps) {
  const { user } = useAuth();
  const { t, language } = useTranslation();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        loadConversations();
      }
    }, [user])
  );

  const loadConversations = async () => {
    if (!user) return;

    try {
      const { data, error } = await getConversations(user.id);

      if (error) {
        console.error('Error loading conversations:', error);
      } else {
        setConversations(data || []);
      }
    } catch (err) {
      console.error('Error in loadConversations:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadConversations();
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const locale = language === 'en' ? 'en-US' : 'nb-NO';

    if (messageDate.getTime() === today.getTime()) {
      return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleString(locale, { 
        day: 'numeric', 
        month: 'short',
      });
    }
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>← {t('common.back')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.content}>
          <Text style={styles.loginPrompt}>{t('screens.messages.loginPrompt')}</Text>
        </View>
      </View>
    );
  }

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← {t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('screens.messages.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {conversations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('screens.messages.empty')}</Text>
            <Text style={styles.emptySubtext}>
              {t('screens.messages.emptySubtext')}
            </Text>
          </View>
        ) : (
          conversations.map((conversation) => (
            <TouchableOpacity
              key={conversation.user_id}
              style={styles.conversationCard}
              onPress={() =>
                navigation.navigate('Chat', {
                  friendId: conversation.user_id,
                  friendUsername: conversation.username,
                  friendAvatarUrl: conversation.avatar_url,
                })
              }
            >
              <View style={styles.conversationInfo}>
                <View style={styles.avatarWrapper}>
                  {conversation.avatar_url ? (
                    <Image
                      source={{ uri: conversation.avatar_url }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarPlaceholderText}>
                        {conversation.username.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <OnlineIndicator isOnline={isUserOnline(conversation.last_active)} size="small" />
                </View>
                <View style={styles.conversationTextContainer}>
                  <View style={styles.conversationHeader}>
                    <Text style={styles.conversationUsername}>
                      {conversation.username}
                    </Text>
                    {conversation.last_message && (
                      <Text style={styles.conversationTime}>
                        {formatTime(conversation.last_message.created_at)}
                      </Text>
                    )}
                  </View>
                  {conversation.last_message && (
                    <Text
                      style={[
                        styles.conversationPreview,
                        conversation.unread_count > 0 && styles.conversationPreviewUnread,
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {conversation.last_message.content}
                    </Text>
                  )}
                </View>
              </View>
              {conversation.unread_count > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {conversation.unread_count > 9 ? '9+' : conversation.unread_count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
  headerSpacer: {
    width: 70,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  loginPrompt: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 40,
  },
  emptyContainer: {
    padding: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  conversationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
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
  avatarPlaceholderText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  conversationTextContainer: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  conversationTime: {
    fontSize: 12,
    color: '#999',
  },
  conversationPreview: {
    fontSize: 14,
    color: '#666',
  },
  conversationPreviewUnread: {
    fontWeight: '600',
    color: '#333',
  },
  unreadBadge: {
    backgroundColor: '#1ED760',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

