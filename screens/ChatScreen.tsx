import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import {
  getMessages,
  sendMessage,
  markMessagesAsRead,
  subscribeToMessages,
  unsubscribeFromMessages,
  type Message,
} from '../services/chatService';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import OnlineIndicator from '../components/OnlineIndicator';

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

interface ChatScreenProps {
  navigation: any;
  route?: {
    params?: {
      friendId: string;
      friendUsername?: string;
      friendAvatarUrl?: string | null;
    };
  };
}

export default function ChatScreen({ navigation, route }: ChatScreenProps) {
  const { user } = useAuth();
  const friendId = route?.params?.friendId || '';
  const initialUsername = route?.params?.friendUsername || 'Venn';
  const initialAvatarUrl = route?.params?.friendAvatarUrl;

  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [friendProfile, setFriendProfile] = useState<{
    username: string;
    avatar_url: string | null;
  } | null>(null);
  const [lastActive, setLastActive] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!user || !friendId) {
      setLoading(false);
      return;
    }

    loadFriendProfile();
    loadMessages();

    // Subscribe to real-time messages
    const channel = subscribeToMessages(user.id, friendId, (newMessage) => {
      setMessages(prev => {
        // Avoid duplicates
        if (prev.some(m => m.id === newMessage.id)) {
          return prev;
        }
        return [...prev, newMessage];
      });
      
      // Scroll to bottom when new message arrives
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    channelRef.current = channel;

    // Mark messages as read
    markMessagesAsRead(user.id, friendId);

    return () => {
      if (channelRef.current) {
        unsubscribeFromMessages(channelRef.current);
      }
    };
  }, [user, friendId]);

  useFocusEffect(
    React.useCallback(() => {
      if (user && friendId) {
        loadMessages();
        markMessagesAsRead(user.id, friendId);
      }
    }, [user, friendId])
  );

  const loadFriendProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('username, avatar_url')
        .eq('id', friendId)
        .single();

      if (!error && data) {
        setFriendProfile(data);
      }

      // Hent siste aktivitet (last_active) fra step_data
      const { data: stepData } = await supabase
        .from('step_data')
        .select('updated_at')
        .eq('user_id', friendId)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (stepData && stepData.length > 0 && stepData[0].updated_at) {
        setLastActive(stepData[0].updated_at);
      } else {
        setLastActive(null);
      }
    } catch (err) {
      console.error('Error loading friend profile:', err);
    }
  };

  const loadMessages = async () => {
    if (!user || !friendId) return;

    setLoading(true);
    try {
      const { data, error } = await getMessages(user.id, friendId);

      if (error) {
        console.error('Error loading messages:', error);
      } else {
        setMessages(data || []);
        // Scroll to bottom after loading
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: false });
        }, 100);
      }
    } catch (err) {
      console.error('Error in loadMessages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!user || !friendId || !messageText.trim() || sending) return;

    setSending(true);
    try {
      const { data, error } = await sendMessage(user.id, friendId, messageText.trim());

      if (error) {
        console.error('Error sending message:', error);
      } else {
        setMessageText('');
        if (data) {
          setMessages(prev => [...prev, data]);
          // Scroll to bottom after sending
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
        // Mark as read
        await markMessagesAsRead(user.id, friendId);
      }
    } catch (err) {
      console.error('Error in handleSendMessage:', err);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (messageDate.getTime() === today.getTime()) {
      // Today - show time only
      return date.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
    } else {
      // Other day - show date and time
      return date.toLocaleString('nb-NO', { 
        day: 'numeric', 
        month: 'short', 
        hour: '2-digit', 
        minute: '2-digit' 
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
        <View style={styles.loginContainer}>
          <Text style={styles.loginPrompt}>Du må logge inn for å sende meldinger</Text>
        </View>
      </View>
    );
  }

  const displayUsername = friendProfile?.username || initialUsername;
  const displayAvatarUrl = friendProfile?.avatar_url || initialAvatarUrl;

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Tilbake</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.headerAvatarWrapper}>
            {displayAvatarUrl ? (
              <Image source={{ uri: displayAvatarUrl }} style={styles.headerAvatar} />
            ) : (
              <View style={styles.headerAvatarPlaceholder}>
                <Text style={styles.headerAvatarText}>
                  {displayUsername.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <OnlineIndicator isOnline={isUserOnline(lastActive)} size="small" />
          </View>
          <Text style={styles.headerTitle}>{displayUsername}</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1ED760" />
        </View>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {messages.map((message) => {
            const isMyMessage = message.sender_id === user.id;
            return (
              <View
                key={message.id}
                style={[
                  styles.messageContainer,
                  isMyMessage ? styles.myMessage : styles.friendMessage,
                ]}
              >
                <Text style={[
                  styles.messageText,
                  isMyMessage ? styles.myMessageText : styles.friendMessageText,
                ]}>
                  {message.content}
                </Text>
                <Text style={[
                  styles.messageTime,
                  isMyMessage ? styles.myMessageTime : styles.friendMessageTime,
                ]}>
                  {formatTime(message.created_at)}
                </Text>
              </View>
            );
          })}
          {messages.length === 0 && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                Ingen meldinger ennå. Start samtalen!
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Skriv en melding..."
          value={messageText}
          onChangeText={setMessageText}
          multiline
          maxLength={1000}
          editable={!sending}
          onSubmitEditing={handleSendMessage}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!messageText.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSendMessage}
          disabled={!messageText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 50,
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
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    gap: 10,
  },
  headerAvatarWrapper: {
    position: 'relative',
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  headerAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1ED760',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerSpacer: {
    width: 70,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loginPrompt: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  messagesContent: {
    padding: 15,
    paddingBottom: 15,
  },
  messageContainer: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#1ED760',
    borderBottomRightRadius: 4,
  },
  friendMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  messageText: {
    fontSize: 16,
    marginBottom: 4,
  },
  myMessageText: {
    color: '#fff',
  },
  friendMessageText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 11,
    alignSelf: 'flex-end',
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  friendMessageTime: {
    color: '#666',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 15 : 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
    gap: 10,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
    backgroundColor: '#f9f9f9',
    minHeight: 40,
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
    backgroundColor: '#cccccc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

