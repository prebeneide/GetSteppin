import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
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
  avatar_url: string | null;
}

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [anonymousGoal, setAnonymousGoal] = useState<number | null>(null);
  const [anonymousAvatarUrl, setAnonymousAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

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
          .select('username, full_name, email, daily_step_goal, avatar_url')
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
          .select('daily_step_goal, avatar_url')
          .eq('device_id', deviceId)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading device settings:', error);
        } else if (data) {
          setAnonymousGoal(data.daily_step_goal);
          setAnonymousAvatarUrl(data.avatar_url || null);
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

  const pickImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Tillatelse nødvendig', 'Vi trenger tillatelse til å hente bilder fra galleriet.');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        await uploadImage(imageUri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Feil', 'Kunne ikke laste opp bilde. Prøv igjen.');
    }
  };

  const uploadImage = async (imageUri: string) => {
    setUploading(true);
    try {
      // Handle file extension - get from URI or default to jpg
      let fileExt = imageUri.split('.').pop()?.toLowerCase();
      if (!fileExt || !['jpg', 'jpeg', 'png', 'webp'].includes(fileExt)) {
        // Try to detect from URI or default to jpg
        if (imageUri.includes('jpeg') || imageUri.includes('jpg')) {
          fileExt = 'jpg';
        } else if (imageUri.includes('png')) {
          fileExt = 'png';
        } else if (imageUri.includes('webp')) {
          fileExt = 'webp';
        } else {
          fileExt = 'jpg'; // Default
        }
      }

      // Set correct content type
      const contentType = fileExt === 'jpg' || fileExt === 'jpeg' 
        ? 'image/jpeg' 
        : fileExt === 'png' 
        ? 'image/png' 
        : fileExt === 'webp'
        ? 'image/webp'
        : 'image/jpeg';

      // Helper function to load image as ArrayBuffer using XMLHttpRequest (React Native compatible)
      const loadImageAsArrayBuffer = (uri: string): Promise<Uint8Array> => {
        return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('GET', uri, true);
          xhr.responseType = 'arraybuffer';
          
          xhr.onload = () => {
            if (xhr.status === 200) {
              const arrayBuffer = xhr.response;
              const uint8Array = new Uint8Array(arrayBuffer);
              resolve(uint8Array);
            } else {
              reject(new Error(`Failed to load image: ${xhr.status}`));
            }
          };
          
          xhr.onerror = () => reject(new Error('Network error loading image'));
          xhr.send();
        });
      };

      // Load image as ArrayBuffer
      const imageData = await loadImageAsArrayBuffer(imageUri);

      if (user) {
        // For logged in users - bruk unikt filnavn med timestamp for å unngå konflikter
        const timestamp = Date.now();
        const fileName = `${user.id}_${timestamp}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        // Slette alle gamle bilder for denne brukeren først (valgfritt, men anbefalt for opprydding)
        try {
          const { data: oldFiles } = await supabase.storage
            .from('avatars')
            .list(`${user.id}`);

          if (oldFiles && oldFiles.length > 0) {
            // Slett alle gamle bilder (alle filer med user.id som prefix)
            const filesToRemove = oldFiles.map(file => `${user.id}/${file.name}`);
            if (filesToRemove.length > 0) {
              await supabase.storage
                .from('avatars')
                .remove(filesToRemove)
                .catch(err => console.warn('Could not remove old files:', err));
            }
          }
        } catch (error) {
          console.warn('Error cleaning up old files (continuing anyway):', error);
        }

        // Upload using Supabase Storage SDK med unikt filnavn
        const { data, error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, imageData, {
            contentType: contentType,
            upsert: true,
          });

        if (uploadError) {
          console.error('Error uploading image:', uploadError);
          const errorMessage = uploadError.message || 'Ukjent feil';
          Alert.alert(
            'Feil ved opplasting', 
            `Kunne ikke laste opp bilde: ${errorMessage}\n\nSjekk at "avatars" bucket eksisterer i Supabase Storage.`
          );
          return;
        }

        // Get public URL after successful upload
        // Legg til cache-busting parameter for å tvinge oppdatering av bildet
        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        // Legg til timestamp i URL for å tvinge browser/app til å hente nytt bilde (cache-busting)
        const avatarUrlWithCacheBust = `${urlData.publicUrl}?t=${timestamp}`;

        // Update profile with avatar URL (inkludert cache-busting)
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ avatar_url: avatarUrlWithCacheBust })
          .eq('id', user.id);

        if (updateError) {
          console.error('Error updating profile:', updateError);
          Alert.alert('Feil', 'Kunne ikke oppdatere profil.');
        } else {
          // Reload profile for å oppdatere UI med nytt bilde
          await loadProfile();
        }
      } else {
        // For anonymous users - bruk unikt filnavn med timestamp for å unngå konflikter
        const deviceId = await getDeviceId();
        const timestamp = Date.now();
        const fileName = `${deviceId}_${timestamp}.${fileExt}`;
        const filePath = `anonymous/${fileName}`;

        // Slette alle gamle bilder for denne device_id (valgfritt, men anbefalt for opprydding)
        try {
          const { data: oldFiles } = await supabase.storage
            .from('avatars')
            .list('anonymous');

          if (oldFiles && oldFiles.length > 0) {
            // Filtrer ut bare filer som tilhører denne device_id (starter med deviceId_)
            const deviceFiles = oldFiles.filter(file => file.name.startsWith(`${deviceId}_`));
            if (deviceFiles.length > 0) {
              const filesToRemove = deviceFiles.map(file => `anonymous/${file.name}`);
              await supabase.storage
                .from('avatars')
                .remove(filesToRemove)
                .catch(err => console.warn('Could not remove old anonymous files:', err));
            }
          }
        } catch (error) {
          console.warn('Error cleaning up old anonymous files (continuing anyway):', error);
        }

        // Upload using Supabase Storage SDK med unikt filnavn
        const { data, error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, imageData, {
            contentType: contentType,
            upsert: true,
          });

        if (uploadError) {
          console.error('Error uploading image:', uploadError);
          const errorMessage = uploadError.message || 'Ukjent feil';
          Alert.alert(
            'Feil ved opplasting', 
            `Kunne ikke laste opp bilde: ${errorMessage}\n\nSjekk at "avatars" bucket eksisterer i Supabase Storage.`
          );
          return;
        }

        // Get public URL after successful upload
        // Legg til cache-busting parameter for å tvinge oppdatering av bildet
        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        // Legg til timestamp i URL for å tvinge browser/app til å hente nytt bilde (cache-busting)
        const avatarUrlWithCacheBust = `${urlData.publicUrl}?t=${timestamp}`;

        // Update device settings with avatar URL (inkludert cache-busting)
        const { data: existing } = await supabase
          .from('device_settings')
          .select('id')
          .eq('device_id', deviceId)
          .single();

        if (existing) {
          const { error: updateError } = await supabase
            .from('device_settings')
            .update({ avatar_url: avatarUrlWithCacheBust })
            .eq('device_id', deviceId);

          if (updateError) {
            console.error('Error updating device settings:', updateError);
            Alert.alert('Feil', 'Kunne ikke oppdatere innstillinger.');
          } else {
            // Reload profile for å oppdatere UI med nytt bilde
            await loadProfile();
          }
        } else {
          const { error: insertError } = await supabase
            .from('device_settings')
            .insert({
              device_id: deviceId,
              avatar_url: avatarUrlWithCacheBust,
            });

          if (insertError) {
            console.error('Error inserting device settings:', insertError);
            Alert.alert('Feil', 'Kunne ikke lagre innstillinger.');
          } else {
            await loadProfile();
          }
        }
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Feil', 'Kunne ikke laste opp bilde. Prøv igjen.');
    } finally {
      setUploading(false);
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

        {/* Profile Picture Section */}
        <View style={styles.avatarSection}>
          <TouchableOpacity 
            style={styles.avatarContainer}
            onPress={pickImage}
            disabled={uploading}
          >
            {(user && profile?.avatar_url) || (!user && anonymousAvatarUrl) ? (
              <Image
                source={{ uri: user ? profile!.avatar_url! : anonymousAvatarUrl! }}
                style={styles.avatar}
                resizeMode="cover"
              />
            ) : user ? (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>
                  {profile?.username?.charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>📷</Text>
              </View>
            )}
            {uploading && (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.changePhotoButton}
            onPress={pickImage}
            disabled={uploading}
          >
            <Text style={styles.changePhotoButtonText}>
              {uploading ? 'Laster opp...' : (user && profile?.avatar_url) || anonymousAvatarUrl ? 'Endre bilde' : 'Last opp bilde'}
            </Text>
          </TouchableOpacity>
        </View>

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
            {anonymousAvatarUrl && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Profilbilde:</Text>
                <Text style={styles.infoValue}>Lastet opp</Text>
              </View>
            )}
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
  avatarSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 15,
    borderWidth: 3,
    borderColor: '#4CAF50',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 48,
    fontWeight: '600',
    color: '#fff',
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePhotoButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
  },
  changePhotoButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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

