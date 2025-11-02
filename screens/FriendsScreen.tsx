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

interface FriendsScreenProps {
  navigation: any;
}

export default function FriendsScreen({ navigation }: FriendsScreenProps) {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

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
        showAlert('Feil', 'Kunne ikke akseptere forespørsel');
      } else {
        await loadData();
      }
    } catch (err) {
      showAlert('Feil', 'Noe gikk galt');
    }
  };

  const handleDeclineRequest = async (friendshipId: string) => {
    if (!user) return;

    try {
      const { error } = await declineFriendRequest(friendshipId, user.id);
      if (error) {
        showAlert('Feil', 'Kunne ikke avslå forespørsel');
      } else {
        await loadData();
      }
    } catch (err) {
      showAlert('Feil', 'Noe gikk galt');
    }
  };

  const handleRemoveFriend = async (friendshipId: string, friendUsername: string) => {
    if (!user) return;

    try {
      const { error } = await removeFriend(friendshipId, user.id);
      if (error) {
        showAlert('Feil', 'Kunne ikke fjerne venn');
      } else {
        await loadData();
        showAlert('Suksess', `${friendUsername} er fjernet som venn`);
      }
    } catch (err) {
      showAlert('Feil', 'Noe gikk galt');
    }
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
            <Text style={styles.backButtonText}>← Tilbake</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.content}>
          <Text style={styles.loginPrompt}>
            Du må logge inn for å se venner
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginButtonText}>Logg inn</Text>
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
        <Text style={styles.headerTitle}>Venner</Text>
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
            <Text style={styles.sectionTitle}>Venneforespørsler</Text>
            {receivedRequests.map(request => (
              <View key={request.id} style={styles.requestCard}>
                <View style={styles.requestInfo}>
                  {request.avatar_url ? (
                    <Image
                      source={{ uri: request.avatar_url }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarPlaceholderText}>
                        {request.username.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
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
            Mine venner ({friends.length})
          </Text>
          {friends.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                Du har ingen venner ennå
              </Text>
              <TouchableOpacity
                style={styles.addFriendButton}
                onPress={() => navigation.navigate('AddFriend')}
              >
                <Text style={styles.addFriendButtonText}>
                  Legg til venner
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            friends.map(friend => (
              <TouchableOpacity
                key={friend.id}
                style={styles.friendCard}
                onPress={() =>
                  navigation.navigate('FriendProfile', {
                    friendId: friend.id,
                    friendUsername: friend.username,
                    friendAvatarUrl: friend.avatar_url,
                  })
                }
              >
                <View style={styles.friendInfo}>
                  {friend.avatar_url ? (
                    <Image
                      source={{ uri: friend.avatar_url }}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarPlaceholderText}>
                        {friend.username.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.friendTextContainer}>
                    <View style={styles.friendNameRow}>
                      <Text style={styles.friendUsername}>{friend.username}</Text>
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
                        <Text style={styles.chatIcon}>💬</Text>
                      </TouchableOpacity>
                    </View>
                    {friend.full_name && (
                      <Text style={styles.friendFullName}>{friend.full_name}</Text>
                    )}
                  </View>
                </View>
                <View style={styles.friendActions}>
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
                    <Text style={styles.viewButtonText}>Se profil</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleRemoveFriend(friend.friendship_id, friend.username);
                    }}
                  >
                    <Text style={styles.removeButtonText}>Fjern</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
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
    justifyContent: 'space-between',
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  friendActions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  viewButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1ED760',
  },
  viewButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  friendInfo: {
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
  requestTextContainer: {
    flex: 1,
  },
  friendTextContainer: {
    flex: 1,
  },
  requestUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  friendNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  friendUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  chatIconButton: {
    padding: 4,
    marginLeft: 8,
  },
  chatIcon: {
    fontSize: 20,
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
  removeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#ffebee',
  },
  removeButtonText: {
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
});

