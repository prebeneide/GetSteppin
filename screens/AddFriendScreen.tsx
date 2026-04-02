import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { searchUsers, sendFriendRequest, type Friend } from '../services/friendService';
import AlertModal from '../components/AlertModal';
import { useTranslation } from '../lib/i18n';

interface AddFriendScreenProps {
  navigation: any;
}

export default function AddFriendScreen({ navigation }: AddFriendScreenProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [searching, setSearching] = useState(false);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  const showAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  const handleSearch = async () => {
    if (!user || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await searchUsers(searchQuery.trim(), user.id);

      if (error) {
        console.error('Error searching users:', error);
        showAlert(t('common.error'), t('screens.addFriend.noResults'));
        setSearchResults([]);
      } else {
        setSearchResults(data || []);
      }
    } catch (err) {
      console.error('Error in handleSearch:', err);
      showAlert(t('common.error'), t('common.error'));
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async (friend: Friend) => {
    if (!user) return;

    // Sjekk om det allerede er et vennskap
    if (friend.status === 'accepted') {
      showAlert(t('common.success'), `${friend.username} ${t('screens.addFriend.alreadyFriends')}`);
      return;
    }

    if (friend.status === 'pending') {
      if (friend.is_requester) {
        showAlert(t('common.success'), t('screens.addFriend.requestSent'));
      } else {
        showAlert(t('common.success'), t('screens.friends.friendRequests'));
      }
      return;
    }

    setSendingRequest(friend.id);
    try {
      const { error } = await sendFriendRequest(user.id, friend.id);

      if (error) {
        showAlert(t('common.error'), error.message || t('common.error'));
      } else {
        showAlert(t('common.success'), `${t('screens.addFriend.requestSent')} ${friend.username}!`);
        // Oppdater status for denne brukeren i søkeresultatene
        setSearchResults(prev =>
          prev.map(f =>
            f.id === friend.id
              ? { ...f, status: 'pending', is_requester: true, friendship_id: 'pending' }
              : f
          )
        );
      }
    } catch (err) {
      showAlert(t('common.error'), t('common.error'));
    } finally {
      setSendingRequest(null);
    }
  };

  const getButtonText = (friend: Friend): string => {
    if (friend.status === 'accepted') return t('screens.addFriend.alreadyFriends');
    if (friend.status === 'pending') {
      return friend.is_requester ? t('screens.addFriend.requestSent') : t('screens.addFriend.waitingForResponse');
    }
    return t('screens.addFriend.sendRequest');
  };

  const getButtonStyle = (friend: Friend) => {
    if (friend.status === 'accepted' || friend.status === 'pending') {
      return styles.disabledButton;
    }
    return styles.addButton;
  };

  const getButtonTextStyle = (friend: Friend) => {
    if (friend.status === 'accepted' || friend.status === 'pending') {
      return styles.disabledButtonText;
    }
    return styles.addButtonText;
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
            {t('screens.addFriend.loginPrompt')}
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#1ED760" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('screens.addFriend.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('screens.addFriend.search')}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[styles.searchButton, searching && styles.searchButtonDisabled]}
          onPress={handleSearch}
          disabled={searching}
        >
          {searching ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.searchButtonText}>{t('screens.addFriend.searchButton')}</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {searchResults.length === 0 && searchQuery.trim().length >= 2 && !searching ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              {t('screens.addFriend.noResults')} "{searchQuery}"
            </Text>
          </View>
        ) : searchResults.length === 0 && !searching ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              {t('screens.addFriend.searchPrompt')}
            </Text>
          </View>
        ) : (
          searchResults.map(friend => (
            <View key={friend.id} style={styles.resultCard}>
              <View style={styles.resultInfo}>
                {friend.avatar_url ? (
                  <Image source={{ uri: friend.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarPlaceholderText}>
                      {(friend.username || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.resultTextContainer}>
                  <Text style={styles.resultUsername}>{friend.username}</Text>
                  {friend.full_name && (
                    <Text style={styles.resultFullName}>{friend.full_name}</Text>
                  )}
                </View>
              </View>
              <TouchableOpacity
                style={[
                  getButtonStyle(friend),
                  sendingRequest === friend.id && styles.addButtonDisabled,
                ]}
                onPress={() => handleSendRequest(friend)}
                disabled={
                  friend.status === 'accepted' ||
                  friend.status === 'pending' ||
                  sendingRequest === friend.id
                }
              >
                {sendingRequest === friend.id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={getButtonTextStyle(friend)}>
                    {getButtonText(friend)}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ))
        )}
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
  headerSpacer: {
    width: 70, // Samme bredde som tilbake-knappen for sentrering
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  searchButton: {
    backgroundColor: '#1ED760',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonDisabled: {
    backgroundColor: '#cccccc',
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  resultInfo: {
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
  resultTextContainer: {
    flex: 1,
  },
  resultUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  resultFullName: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  addButton: {
    backgroundColor: '#1ED760',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonDisabled: {
    backgroundColor: '#cccccc',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  disabledButtonText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
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

