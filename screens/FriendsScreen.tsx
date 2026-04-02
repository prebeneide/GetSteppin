import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import {
  getFriends,
  getReceivedFriendRequests,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  type Friend,
  type FriendRequest,
} from '../services/friendService';
import AlertModal from '../components/AlertModal';
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

interface FriendsScreenProps {
  navigation: any;
}

export default function FriendsScreen({ navigation }: FriendsScreenProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [menuVisibleFor, setMenuVisibleFor] = useState<string | null>(null);
  const [confirmRemoveVisible, setConfirmRemoveVisible] = useState(false);
  const [friendToRemove, setFriendToRemove] = useState<{ friendshipId: string; username: string } | null>(null);

  const loadData = async () => {
    if (!user) return;

    try {
      const [friendsResult, requestsResult] = await Promise.all([
        getFriends(user.id),
        getReceivedFriendRequests(user.id),
      ]);

      if (friendsResult.error) {
        console.error('Error loading friends:', friendsResult.error);
      } else {
        setFriends(friendsResult.data || []);
      }

      if (requestsResult.error) {
        console.error('Error loading friend requests:', requestsResult.error);
      } else {
        setReceivedRequests(requestsResult.data || []);
      }
    } catch (err) {
      console.error('Error loading friend data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Reload when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [user])
  );

  const showAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  const handleAcceptRequest = async (friendshipId: string) => {
    if (!user) return;

    try {
      const { error } = await acceptFriendRequest(friendshipId, user.id);
      if (error) {
        showAlert(t('common.error'), t('screens.friends.couldNotAccept'));
      } else {
        await loadData();
      }
    } catch (err) {
      showAlert(t('common.error'), t('common.somethingWentWrong'));
    }
  };

  const handleDeclineRequest = async (friendshipId: string) => {
    if (!user) return;

    try {
      const { error } = await declineFriendRequest(friendshipId, user.id);
      if (error) {
        showAlert(t('common.error'), t('screens.friends.couldNotDecline'));
      } else {
        await loadData();
      }
    } catch (err) {
      showAlert(t('common.error'), t('common.somethingWentWrong'));
    }
  };

  const handleRemoveFriend = async (friendshipId: string, friendUsername: string) => {
    if (!user) return;

    try {
      const { error } = await removeFriend(friendshipId, user.id);
      if (error) {
        showAlert(t('common.error'), t('screens.friends.couldNotRemove'));
      } else {
        await loadData();
        showAlert(t('common.success'), `${friendUsername} ${t('screens.friends.removedAsFriend')}`);
      }
    } catch (err) {
      showAlert(t('common.error'), t('common.somethingWentWrong'));
    }
  };

  const showRemoveConfirmation = (friendshipId: string, friendUsername: string) => {
    setFriendToRemove({ friendshipId, username: friendUsername });
    setConfirmRemoveVisible(true);
    setMenuVisibleFor(null); // Close menu
  };

  const confirmRemoveFriend = async () => {
    if (!friendToRemove) return;
    setConfirmRemoveVisible(false);
    await handleRemoveFriend(friendToRemove.friendshipId, friendToRemove.username);
    setFriendToRemove(null);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color="#1ED760" />
          </TouchableOpacity>
        </View>
        <View style={styles.content}>
          <Text style={styles.loginPrompt}>
            {t('screens.friends.loginPrompt')}
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginButtonText}>{t('screens.login.loginButton')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color="#1ED760" />
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
        <Text style={styles.headerTitle}>{t('screens.friends.title')}</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('AddFriend')}
          style={styles.addButton}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Mottatte forespørsler */}
        {receivedRequests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('screens.friends.friendRequests')}</Text>
            {receivedRequests.map(request => (
              <View key={request.id} style={styles.requestCard}>
                <View style={styles.requestInfo}>
                  <View style={styles.avatarWrapper}>
                    {request.avatar_url ? (
                      <Image
                        source={{ uri: request.avatar_url }}
                        style={styles.avatar}
                      />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarPlaceholderText}>
                          {(request.username || '?').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <OnlineIndicator isOnline={isUserOnline(request.last_active)} size="small" />
                  </View>
                  <View style={styles.requestTextContainer}>
                    <Text style={styles.requestUsername}>{request.username}</Text>
                    {request.full_name && (
                      <Text style={styles.requestFullName}>{request.full_name}</Text>
                    )}
                  </View>
                </View>
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={[styles.requestButton, styles.acceptButton]}
                    onPress={() => handleAcceptRequest(request.friendship_id)}
                  >
                    <Text style={styles.acceptButtonText}>✓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.requestButton, styles.declineButton]}
                    onPress={() => handleDeclineRequest(request.friendship_id)}
                  >
                    <Text style={styles.declineButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Venner */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('screens.friends.title')} ({friends.length})
          </Text>
          {friends.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                {t('screens.friends.empty')}
              </Text>
              <TouchableOpacity
                style={styles.addFriendButton}
                onPress={() => navigation.navigate('AddFriend')}
              >
                <Text style={styles.addFriendButtonText}>
                  {t('screens.friends.addFriend')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            friends.map(friend => (
              <View key={friend.id} style={styles.friendCard}>
                <TouchableOpacity
                  style={styles.friendInfo}
                  onPress={() =>
                    navigation.navigate('FriendProfile', {
                      friendId: friend.id,
                      friendUsername: friend.username,
                      friendAvatarUrl: friend.avatar_url,
                    })
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.avatarWrapper}>
                    {friend.avatar_url ? (
                      <Image
                        source={{ uri: friend.avatar_url }}
                        style={styles.avatar}
                      />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarPlaceholderText}>
                          {(friend.username || '?').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <OnlineIndicator isOnline={isUserOnline(friend.last_active)} size="small" />
                  </View>
                  <View style={styles.friendTextContainer}>
                    <Text style={styles.friendUsername} numberOfLines={1}>
                      {friend.username}
                    </Text>
                    {friend.full_name && (
                      <Text style={styles.friendFullName} numberOfLines={1}>
                        {friend.full_name}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
                <View style={styles.friendActions}>
                  <TouchableOpacity
                    style={styles.chatIconButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      navigation.navigate('Chat', {
                        friendId: friend.id,
                        friendUsername: friend.username,
                        friendAvatarUrl: friend.avatar_url,
                      });
                    }}
                  >
                    <Ionicons name="chatbubble-outline" size={20} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.viewButton}
                    onPress={() =>
                      navigation.navigate('FriendProfile', {
                        friendId: friend.id,
                        friendUsername: friend.username,
                        friendAvatarUrl: friend.avatar_url,
                      })
                    }
                  >
                    <Text style={styles.viewButtonText}>{t('screens.friends.viewProfile')}</Text>
                  </TouchableOpacity>
                  <View style={styles.menuContainer}>
                    <TouchableOpacity
                      style={styles.menuButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        setMenuVisibleFor(menuVisibleFor === friend.id ? null : friend.id);
                      }}
                    >
                      <Text style={styles.menuIcon}>⋯</Text>
                    </TouchableOpacity>
                    {menuVisibleFor === friend.id && (
                      <View style={styles.menuDropdown}>
                        <TouchableOpacity
                          style={styles.menuItem}
                          onPress={(e) => {
                            e.stopPropagation();
                            showRemoveConfirmation(friend.friendship_id, friend.username);
                          }}
                        >
                          <Text style={styles.menuItemText}>{t('screens.friendProfile.removeFriend')}</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <AlertModal
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
      />
      
      {/* Remove Friend Confirmation Modal */}
      <AlertModal
        visible={confirmRemoveVisible}
        title={t('screens.friends.confirmRemoveTitle')}
        message={friendToRemove ? `${t('screens.friends.confirmRemoveMessage')} ${friendToRemove.username}?` : ''}
        onClose={() => {
          setConfirmRemoveVisible(false);
          setFriendToRemove(null);
        }}
        buttons={[
          {
            text: t('common.cancel'),
            onPress: () => {
              setConfirmRemoveVisible(false);
              setFriendToRemove(null);
            },
            style: 'cancel',
          },
          {
            text: t('screens.friendProfile.removeFriend'),
            onPress: confirmRemoveFriend,
            style: 'destructive',
          },
        ]}
      />
      
      {/* Close menu when tapping outside */}
      {menuVisibleFor && (
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisibleFor(null)}
        />
      )}
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
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1ED760',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  requestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    gap: 12,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0, // Allow flex to shrink below content size
  },
  friendActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexShrink: 0, // Don't shrink buttons
  },
  viewButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1ED760',
    minWidth: 80,
  },
  viewButtonText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
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
  requestTextContainer: {
    flex: 1,
  },
  friendTextContainer: {
    flex: 1,
    minWidth: 0, // Allow text to shrink
    marginRight: 8,
  },
  requestUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  friendUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flexShrink: 1,
  },
  chatIconButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    marginRight: 4,
  },
  chatIcon: {
    fontSize: 18,
  },
  requestFullName: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  friendFullName: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 10,
  },
  requestButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#1ED760',
  },
  acceptButtonText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
  },
  declineButton: {
    backgroundColor: '#f0f0f0',
  },
  declineButtonText: {
    fontSize: 18,
    color: '#666',
    fontWeight: 'bold',
  },
  menuContainer: {
    position: 'relative',
  },
  menuButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    minWidth: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuIcon: {
    fontSize: 20,
    color: '#666',
    fontWeight: 'bold',
    lineHeight: 20,
  },
  menuDropdown: {
    position: 'absolute',
    top: 40,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    minWidth: 150,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemText: {
    fontSize: 14,
    color: '#F44336',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  addFriendButton: {
    backgroundColor: '#1ED760',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addFriendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loginPrompt: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  loginButton: {
    backgroundColor: '#1ED760',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: 'center',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    backgroundColor: 'transparent',
  },
});

