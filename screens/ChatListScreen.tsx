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
import {
  getConversations,
  type ChatConversation,
} from '../services/chatService';

interface ChatListScreenProps {
  navigation: any;
}

export default function ChatListScreen({ navigation }: ChatListScreenProps) {
  const { user } = useAuth();
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

    if (messageDate.getTime() === today.getTime()) {
      return date.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleString('nb-NO', { 
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
            <Text style={styles.backButtonText}>← Tilbake</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.content}>
          <Text style={styles.loginPrompt}>Du må logge inn for å se samtaler</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Tilbake</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meldinger</Text>
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
            <Text style={styles.emptyText}>Ingen samtaler ennå</Text>
            <Text style={styles.emptySubtext}>
              Gå til venner for å starte en samtale
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
                      style={styles.conversationPreview}
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

