import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Image,
  RefreshControl,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  getConversations,
  type ChatConversation,
} from '../services/chatService';
import { getFriends, type Friend } from '../services/friendService';
import OnlineIndicator from '../components/OnlineIndicator';
import { useTranslation } from '../lib/i18n';

const isUserOnline = (lastActive: string | null | undefined): boolean => {
  if (!lastActive) return false;
  try {
    return Date.now() - new Date(lastActive).getTime() <= 10 * 60 * 1000;
  } catch {
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
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendSearch, setFriendSearch] = useState('');
  const [loadingFriends, setLoadingFriends] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user) return;
    loadConversations();
    subscribeToMessages();
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [user]);

  useFocusEffect(
    React.useCallback(() => {
      if (user) loadConversations();
    }, [user])
  );

  const subscribeToMessages = () => {
    if (!user) return;
    channelRef.current = supabase
      .channel(`messages-list-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload: any) => {
          if (payload.new?.receiver_id === user.id || payload.new?.sender_id === user.id) {
            loadConversations();
          }
        }
      )
      .subscribe();
  };

  const loadConversations = async () => {
    if (!user) return;
    try {
      const { data, error } = await getConversations(user.id);
      if (!error) setConversations(data || []);
    } catch (err) {
      console.error('Error in loadConversations:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const openNewChat = async () => {
    setShowNewChat(true);
    setFriendSearch('');
    if (friends.length === 0) {
      setLoadingFriends(true);
      const { data } = await getFriends(user!.id);
      setFriends(data || []);
      setLoadingFriends(false);
    }
  };

  const startChat = (friend: Friend) => {
    setShowNewChat(false);
    navigation.navigate('Chat', {
      friendId: friend.id,
      friendUsername: friend.username,
      friendAvatarUrl: friend.avatar_url,
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const locale = language === 'en' ? 'en-US' : 'nb-NO';
    const diffDays = Math.round((today.getTime() - msgDate.getTime()) / 86400000);

    if (diffDays === 0) return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return language === 'en' ? 'Yesterday' : 'I går';
    if (diffDays < 7) return date.toLocaleDateString(locale, { weekday: 'short' });
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  };

  const getMessagePreview = (conv: ChatConversation): string => {
    if (!conv.last_message) return language === 'en' ? 'No messages yet' : 'Ingen meldinger ennå';
    if (conv.last_message.image_url && !conv.last_message.content) {
      return language === 'en' ? '📷 Image' : '📷 Bilde';
    }
    if (conv.last_message.image_url && conv.last_message.content) {
      return `📷 ${conv.last_message.content}`;
    }
    return conv.last_message.content;
  };

  const isSentByMe = (conv: ChatConversation): boolean => {
    return conv.last_message?.sender_id === user?.id;
  };

  const filteredConversations = conversations.filter(c =>
    c.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFriends = friends.filter(f =>
    f.username?.toLowerCase().includes(friendSearch.toLowerCase())
  );

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color="#1ED760" />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Text style={styles.loginPrompt}>{t('screens.messages.loginPrompt')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#1ED760" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('screens.messages.title')}</Text>
        <TouchableOpacity style={styles.newChatBtn} onPress={openNewChat}>
          <Ionicons name="create-outline" size={24} color="#1ED760" />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder={language === 'en' ? 'Search conversations…' : 'Søk i samtaler…'}
          placeholderTextColor="#bbb"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#bbb" />
          </TouchableOpacity>
        )}
      </View>

      {/* Conversation list */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1ED760" />
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={item => item.user_id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadConversations(); }} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={56} color="#ddd" />
              <Text style={styles.emptyTitle}>
                {searchQuery
                  ? (language === 'en' ? 'No results' : 'Ingen treff')
                  : t('screens.messages.empty')}
              </Text>
              {!searchQuery && (
                <>
                  <Text style={styles.emptySubtext}>{t('screens.messages.emptySubtext')}</Text>
                  <TouchableOpacity style={styles.startChatBtn} onPress={openNewChat}>
                    <Ionicons name="create-outline" size={18} color="#fff" />
                    <Text style={styles.startChatBtnText}>
                      {language === 'en' ? 'Start a conversation' : 'Start en samtale'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          }
          renderItem={({ item: conv }) => {
            const preview = getMessagePreview(conv);
            const sentByMe = isSentByMe(conv);
            const unread = conv.unread_count > 0;

            return (
              <TouchableOpacity
                style={styles.conversationCard}
                onPress={() =>
                  navigation.navigate('Chat', {
                    friendId: conv.user_id,
                    friendUsername: conv.username,
                    friendAvatarUrl: conv.avatar_url,
                  })
                }
                activeOpacity={0.7}
              >
                <View style={styles.avatarWrapper}>
                  {conv.avatar_url ? (
                    <Image source={{ uri: conv.avatar_url }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarInitial}>
                        {(conv.username || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <OnlineIndicator isOnline={isUserOnline(conv.last_active)} size="small" />
                </View>

                <View style={styles.convInfo}>
                  <View style={styles.convRow}>
                    <Text style={[styles.convName, unread && styles.convNameUnread]}>
                      {conv.username}
                    </Text>
                    {conv.last_message && (
                      <Text style={[styles.convTime, unread && styles.convTimeUnread]}>
                        {formatTime(conv.last_message.created_at)}
                      </Text>
                    )}
                  </View>
                  <View style={styles.convRow}>
                    <Text
                      style={[styles.convPreview, unread && styles.convPreviewUnread]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {sentByMe
                        ? `${language === 'en' ? 'You: ' : 'Du: '}${preview}`
                        : preview}
                    </Text>
                    {unread && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>
                          {conv.unread_count > 9 ? '9+' : conv.unread_count}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* New Chat Modal */}
      <Modal
        visible={showNewChat}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowNewChat(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowNewChat(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {language === 'en' ? 'New conversation' : 'Ny samtale'}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color="#999" />
            <TextInput
              style={styles.searchInput}
              placeholder={language === 'en' ? 'Search friends…' : 'Søk etter venn…'}
              placeholderTextColor="#bbb"
              value={friendSearch}
              onChangeText={setFriendSearch}
              autoFocus
            />
          </View>

          {loadingFriends ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#1ED760" />
            </View>
          ) : filteredFriends.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#ddd" />
              <Text style={styles.emptyTitle}>
                {friendSearch
                  ? (language === 'en' ? 'No friends found' : 'Ingen venner funnet')
                  : (language === 'en' ? 'No friends yet' : 'Ingen venner ennå')}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredFriends}
              keyExtractor={f => f.id}
              renderItem={({ item: friend }) => (
                <TouchableOpacity
                  style={styles.friendRow}
                  onPress={() => startChat(friend)}
                  activeOpacity={0.7}
                >
                  {friend.avatar_url ? (
                    <Image source={{ uri: friend.avatar_url }} style={styles.friendAvatar} />
                  ) : (
                    <View style={styles.friendAvatarPlaceholder}>
                      <Text style={styles.avatarInitial}>
                        {(friend.username || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendName}>{friend.username}</Text>
                    {friend.full_name && (
                      <Text style={styles.friendFullName}>{friend.full_name}</Text>
                    )}
                  </View>
                  <Ionicons name="chatbubble-outline" size={20} color="#1ED760" />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>
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
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
  },
  newChatBtn: {
    padding: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f4f4f4',
    marginHorizontal: 16,
    marginVertical: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    padding: 0,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginPrompt: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginHorizontal: 32,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bbb',
    textAlign: 'center',
  },
  startChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1ED760',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 8,
  },
  startChatBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  // Conversation row
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1ED760',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  convInfo: {
    flex: 1,
    gap: 3,
  },
  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  convName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111',
  },
  convNameUnread: {
    fontWeight: '700',
  },
  convTime: {
    fontSize: 12,
    color: '#bbb',
  },
  convTimeUnread: {
    color: '#1ED760',
    fontWeight: '600',
  },
  convPreview: {
    fontSize: 14,
    color: '#999',
    flex: 1,
    marginRight: 8,
  },
  convPreviewUnread: {
    color: '#333',
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: '#1ED760',
    borderRadius: 11,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 20 : 16,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f7f7f7',
  },
  friendAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  friendAvatarPlaceholder: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#1ED760',
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  friendFullName: {
    fontSize: 13,
    color: '#999',
    marginTop: 1,
  },
});
