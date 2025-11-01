import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getDeviceId } from '../lib/deviceId';

interface ProfileScreenProps {
  navigation: any;
}

interface UserProfile {
  username: string;
  full_name: string | null;
  email: string | null;
  daily_step_goal: number | null;
}

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [anonymousGoal, setAnonymousGoal] = useState<number | null>(null);

  useEffect(() => {
    loadProfile();
  }, [user]);

  // Reload profile when screen comes into focus (e.g., returning from Settings)
  useFocusEffect(
    React.useCallback(() => {
      loadProfile();
    }, [user])
  );

  const loadProfile = async () => {
    setLoading(true);
    try {
      if (user) {
        // For logged in users, load from user_profiles
        const { data, error } = await supabase
          .from('user_profiles')
          .select('username, full_name, email, daily_step_goal')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error loading profile:', error);
        } else if (data) {
          setProfile(data);
          setIsAnonymous(false);
        }
      } else {
        // For non-logged in users, load from device_settings
        const deviceId = await getDeviceId();
        
        const { data, error } = await supabase
          .from('device_settings')
          .select('daily_step_goal')
          .eq('device_id', deviceId)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading device settings:', error);
        } else if (data) {
          setAnonymousGoal(data.daily_step_goal);
          setIsAnonymous(true);
        } else {
          setIsAnonymous(true);
        }
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>← Tilbake</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Tilbake</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Min side</Text>

        {/* User Info Section */}
        {user && profile ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Brukerinformasjon</Text>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Brukernavn:</Text>
              <Text style={styles.infoValue}>{profile.username || 'Ikke satt'}</Text>
            </View>

            {profile.full_name && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Fullt navn:</Text>
                <Text style={styles.infoValue}>{profile.full_name}</Text>
              </View>
            )}

            {profile.email && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>E-post:</Text>
                <Text style={styles.infoValue}>{profile.email}</Text>
              </View>
            )}

            {profile.daily_step_goal && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Daglig mål:</Text>
                <Text style={styles.infoValue}>
                  {profile.daily_step_goal.toLocaleString()} skritt
                </Text>
              </View>
            )}
          </View>
        ) : isAnonymous ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Brukerinformasjon</Text>
            <Text style={styles.anonymousText}>
              Du er ikke logget inn
            </Text>
            {anonymousGoal && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Daglig mål:</Text>
                <Text style={styles.infoValue}>
                  {anonymousGoal.toLocaleString()} skritt
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.loginButtonText}>Logg inn</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Innstillinger</Text>
          
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.settingsButtonText}>⚙️ Daglig mål</Text>
            <Text style={styles.settingsButtonArrow}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Logout Section */}
        {user && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
              <Text style={styles.logoutButtonText}>Logg ut</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 30,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 16,
    color: '#666',
    flex: 1,
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  anonymousText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
  },
  loginButton: {
    backgroundColor: '#4CAF50',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  settingsButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  settingsButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  settingsButtonArrow: {
    fontSize: 18,
    color: '#666',
  },
  logoutButton: {
    backgroundColor: '#F44336',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

