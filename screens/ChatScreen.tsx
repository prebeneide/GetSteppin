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
  Modal,
  Dimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
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
import { useTranslation } from '../lib/i18n';
import { pickImages, uploadMessageImage } from '../services/imageService';
import { Alert } from 'react-native';

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
  const { t, language } = useTranslation();
  const friendId = route?.params?.friendId || '';
  const initialUsername = route?.params?.friendUsername || t('screens.chat.friend');
  const initialAvatarUrl = route?.params?.friendAvatarUrl;

  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [friendProfile, setFriendProfile] = useState<{
    username: string;
    avatar_url: string | null;
  } | null>(null);
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);
  const [lastActive, setLastActive] = useState<string | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
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

      // Load my avatar
      if (user) {
        const { data: myProfile } = await supabase
          .from('user_profiles')
          .select('avatar_url')
          .eq('id', user.id)
          .single();
        
        if (myProfile) {
          setMyAvatarUrl(myProfile.avatar_url);
        }
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

  const handlePickImage = async () => {
    if (!user || uploadingImage) return;

    try {
      const imageUris = await pickImages(1);
      if (imageUris.length > 0) {
        setSelectedImageUri(imageUris[0]);
      }
    } catch (err: any) {
      console.error('Error picking image:', err);
      Alert.alert(
        t('common.error'),
        err.message || t('screens.chat.couldNotPickImage')
      );
    }
  };

  const handleRemoveImage = () => {
    setSelectedImageUri(null);
  };

  const handleSendMessage = async () => {
    if (!user || !friendId || sending || uploadingImage) return;
    
    // Must have either text or image
    if (!messageText.trim() && !selectedImageUri) return;

    setSending(true);
    let imageUrl: string | null = null;

    try {
      // Upload image if selected
      if (selectedImageUri) {
        setUploadingImage(true);
        try {
          imageUrl = await uploadMessageImage(selectedImageUri, user.id);
        } catch (uploadError: any) {
          console.error('Error uploading image:', uploadError);
          Alert.alert(
            t('common.error'),
            uploadError.message || t('screens.chat.couldNotUploadImage')
          );
          setSending(false);
          setUploadingImage(false);
          return;
        } finally {
          setUploadingImage(false);
        }
      }

      // Send message with text and/or image
      const { data, error } = await sendMessage(
        user.id,
        friendId,
        messageText.trim() || '',
        imageUrl
      );

      if (error) {
        console.error('Error sending message:', error);
        Alert.alert(t('common.error'), t('screens.chat.couldNotSend'));
      } else {
        setMessageText('');
        setSelectedImageUri(null);
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
      Alert.alert(t('common.error'), t('screens.chat.couldNotSend'));
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const locale = language === 'en' ? 'en-US' : 'nb-NO';

    if (messageDate.getTime() === today.getTime()) {
      // Today - show time only
      return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    } else {
      // Other day - show date and time
      return date.toLocaleString(locale, { 
        day: 'numeric', 
        month: 'short', 
        year: messageDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
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
            <Ionicons name="chevron-back" size={24} color="#1ED760" />
          </TouchableOpacity>
        </View>
        <View style={styles.loginContainer}>
          <Text style={styles.loginPrompt}>{t('screens.chat.loginPrompt')}</Text>
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
            <Ionicons name="chevron-back" size={24} color="#1ED760" />
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
            const avatarUrl = isMyMessage ? myAvatarUrl : friendProfile?.avatar_url;
            
            return (
              <View
                key={message.id}
                style={[
                  styles.messageRow,
                  isMyMessage ? styles.messageRowMy : styles.messageRowFriend,
                ]}
              >
                {/* Avatar for friend messages (left side) */}
                {!isMyMessage && (
                  <View style={styles.avatarContainer}>
                    {avatarUrl ? (
                      <Image source={{ uri: avatarUrl }} style={styles.messageAvatar} />
                    ) : (
                      <View style={styles.messageAvatarPlaceholder}>
                        <Text style={styles.messageAvatarText}>
                          {friendProfile?.username?.charAt(0).toUpperCase() || '?'}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
                
                <View
                  style={[
                    styles.messageContainer,
                    isMyMessage ? styles.myMessage : styles.friendMessage,
                    message.image_url && !message.content && styles.messageWithImageOnly,
                  ]}
                >
                  {message.image_url && (
                    <TouchableOpacity
                      style={[styles.imageWrapper, !message.content && styles.imageWrapperNoText]}
                      onPress={() => setFullscreenImage(message.image_url!)}
                      activeOpacity={0.9}
                    >
                      <ExpoImage
                        source={{ uri: message.image_url }}
                        style={styles.messageImage}
                        contentFit="cover"
                        transition={200}
                      />
                    </TouchableOpacity>
                  )}
                  {message.content ? (
                    <View style={[
                      styles.textContainer,
                      isMyMessage && message.image_url && styles.textContainerWithImageMyMessage,
                      !isMyMessage && message.image_url && styles.textContainerWithImageFriendMessage,
                    ]}>
                      <Text style={[
                        styles.messageText,
                        isMyMessage ? styles.myMessageText : styles.friendMessageText,
                        message.image_url && styles.messageTextWithImage,
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
                  ) : message.image_url ? (
                    // Show time without background when there's only image
                    <Text style={[
                      styles.messageTime,
                      isMyMessage ? styles.messageTimeImageOnly : styles.friendMessageTime,
                    ]}>
                      {formatTime(message.created_at)}
                    </Text>
                  ) : (
                    // Fallback: show time without container (shouldn't happen)
                    <Text style={[
                      styles.messageTime,
                      isMyMessage ? styles.myMessageTime : styles.friendMessageTime,
                    ]}>
                      {formatTime(message.created_at)}
                    </Text>
                  )}
                </View>

                {/* Avatar for my messages (right side) */}
                {isMyMessage && (
                  <View style={styles.avatarContainer}>
                    {avatarUrl ? (
                      <Image source={{ uri: avatarUrl }} style={styles.messageAvatar} />
                    ) : (
                      <View style={styles.messageAvatarPlaceholder}>
                        <Text style={styles.messageAvatarText}>
                          {user?.email?.charAt(0).toUpperCase() || '?'}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}
          {messages.length === 0 && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {t('screens.chat.noMessages')}
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Fullscreen Image Modal */}
      <Modal
        visible={fullscreenImage !== null}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setFullscreenImage(null)}
      >
        <View style={styles.fullscreenModalContainer}>
          <TouchableOpacity
            style={styles.fullscreenCloseButton}
            onPress={() => setFullscreenImage(null)}
          >
            <View style={styles.closeButtonContent}>
              <View style={styles.closeButtonLine1} />
              <View style={styles.closeButtonLine2} />
            </View>
          </TouchableOpacity>

          {fullscreenImage && (
            <ExpoImage
              source={{ uri: fullscreenImage }}
              style={styles.fullscreenImage}
              contentFit="contain"
            />
          )}
        </View>
      </Modal>

      {selectedImageUri && (
        <View style={styles.selectedImageContainer}>
          <Image
            source={{ uri: selectedImageUri }}
            style={styles.selectedImage}
            resizeMode="cover"
          />
          <TouchableOpacity
            style={styles.removeImageButton}
            onPress={handleRemoveImage}
          >
            <Text style={styles.removeImageButtonText}>×</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.inputContainer}>
        <TouchableOpacity
          style={styles.imageButton}
          onPress={handlePickImage}
          disabled={sending || uploadingImage}
        >
          <Text style={styles.imageButtonText}>📷</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder={t('screens.chat.typeMessage')}
          value={messageText}
          onChangeText={setMessageText}
          multiline
          maxLength={1000}
          editable={!sending && !uploadingImage}
          onSubmitEditing={handleSendMessage}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            ((!messageText.trim() && !selectedImageUri) || sending || uploadingImage) && styles.sendButtonDisabled
          ]}
          onPress={handleSendMessage}
          disabled={(!messageText.trim() && !selectedImageUri) || sending || uploadingImage}
        >
          {(sending || uploadingImage) ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>{t('common.send')}</Text>
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
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
    gap: 8,
  },
  messageRowMy: {
    justifyContent: 'flex-end',
  },
  messageRowFriend: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    width: 20,
    height: 20,
    flexShrink: 0,
  },
  messageAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  messageAvatarPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#1ED760',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageAvatarText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#fff',
  },
  messageContainer: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
  },
  myMessage: {
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
  // Special styling for messages with images only (no text)
  messageWithImageOnly: {
    backgroundColor: 'transparent', // Remove background for image-only messages
  },
  textContainer: {
    // Container for text and time when there's an image
  },
  textContainerWithImageMyMessage: {
    backgroundColor: '#1ED760',
    borderRadius: 12,
    padding: 8,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  textContainerWithImageFriendMessage: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  messageText: {
    fontSize: 16,
    marginBottom: 4,
  },
  messageTextWithImage: {
    marginTop: 0, // No extra margin since container handles spacing
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
  messageTimeImageOnly: {
    color: '#1ED760', // Light green color
    alignSelf: 'flex-end',
    marginTop: 4,
    fontSize: 11,
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
  selectedImageContainer: {
    position: 'relative',
    marginHorizontal: 15,
    marginTop: 10,
    marginBottom: 5,
    alignSelf: 'flex-start',
  },
  selectedImage: {
    width: 150,
    height: 150,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  removeImageButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 20,
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
  imageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageButtonText: {
    fontSize: 20,
  },
  imageWrapper: {
    width: 150,
    marginBottom: 8,
    marginTop: 0,
    borderRadius: 12,
    overflow: 'hidden',
  },
  imageWrapperNoText: {
    marginBottom: 0, // No margin if there's no text below
  },
  messageImage: {
    width: 150,
    height: 150,
    borderRadius: 12,
    backgroundColor: '#f0f0f0', // Background color while loading
  },
  fullscreenModalContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenCloseButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 40,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 22,
  },
  closeButtonContent: {
    width: 20,
    height: 20,
    position: 'relative',
  },
  closeButtonLine1: {
    position: 'absolute',
    width: 20,
    height: 2,
    backgroundColor: '#fff',
    transform: [{ rotate: '45deg' }],
  },
  closeButtonLine2: {
    position: 'absolute',
    width: 20,
    height: 2,
    backgroundColor: '#fff',
    transform: [{ rotate: '-45deg' }],
  },
  fullscreenImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
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

