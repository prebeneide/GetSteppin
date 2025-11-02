import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import StatisticsView from '../components/StatisticsView';
import AchievementsView from '../components/AchievementsView';

interface FriendProfileScreenProps {
  navigation: any;
  route?: {
    params?: {
      friendId: string;
      friendUsername?: string;
      friendAvatarUrl?: string | null;
    };
  };
}

interface FriendProfile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  daily_step_goal: number | null;
}

export default function FriendProfileScreen({
  navigation,
  route,
}: FriendProfileScreenProps) {
  const friendId = route?.params?.friendId || '';
  const initialUsername = route?.params?.friendUsername;
  const initialAvatarUrl = route?.params?.friendAvatarUrl;
  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (friendId) {
      loadFriendProfile();
    } else {
      setError('Ingen venn ID oppgitt');
      setLoading(false);
    }
  }, [friendId]);

  useFocusEffect(
    React.useCallback(() => {
      if (friendId) {
        loadFriendProfile();
      }
    }, [friendId])
  );

  const loadFriendProfile = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, username, full_name, avatar_url, daily_step_goal')
        .eq('id', friendId)
        .single();

      if (profileError) {
        console.error('Error loading friend profile:', profileError);
        setError('Kunne ikke laste vennens profil');
      } else if (data) {
        setProfile(data);
      }
    } catch (err) {
      console.error('Error in loadFriendProfile:', err);
      setError('Noe gikk galt');
    } finally {
      setLoading(false);
    }
  };

  // Use loaded profile or fallback to route params
  const displayUsername = profile?.username || initialUsername || 'Venn';
  const displayAvatarUrl = profile?.avatar_url || initialAvatarUrl;

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

  if (error || !profile) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>← Tilbake</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {error || 'Kunne ikke laste vennens profil'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Tilbake</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vennens profil</Text>
        <TouchableOpacity
          style={styles.chatButton}
          onPress={() =>
            navigation.navigate('Chat', {
              friendId: friendId,
              friendUsername: displayUsername,
              friendAvatarUrl: displayAvatarUrl,
            })
          }
        >
          <Text style={styles.chatButtonText}>💬</Text>
        </TouchableOpacity>
      </View>

      {/* Profile Info Section */}
      <View style={styles.profileSection}>
        <View style={styles.avatarContainer}>
          {displayAvatarUrl ? (
            <Image source={{ uri: displayAvatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarPlaceholderText}>
                {displayUsername.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.username}>{displayUsername}</Text>
        {profile.full_name && (
          <Text style={styles.fullName}>{profile.full_name}</Text>
        )}
        {profile.daily_step_goal && (
          <View style={styles.goalContainer}>
            <Text style={styles.goalLabel}>Daglig mål</Text>
            <Text style={styles.goalValue}>
              {profile.daily_step_goal.toLocaleString()} skritt
            </Text>
          </View>
        )}
      </View>

      {/* Statistics Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Statistikk</Text>
        <StatisticsView userId={friendId} isLoggedIn={true} />
      </View>

      {/* Achievements Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Prestasjoner</Text>
        <AchievementsView userId={friendId} isLoggedIn={true} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    paddingBottom: 40,
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
  chatButton: {
    padding: 4,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatButtonText: {
    fontSize: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
    marginTop: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
  },
  profileSection: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#f9f9f9',
    marginBottom: 20,
  },
  avatarContainer: {
    marginBottom: 15,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#1ED760',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1ED760',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#1ED760',
  },
  avatarPlaceholderText: {
    fontSize: 40,
    fontWeight: '600',
    color: '#fff',
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  fullName: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
  },
  goalContainer: {
    alignItems: 'center',
    marginTop: 10,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 300,
  },
  goalLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  goalValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1ED760',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
});

