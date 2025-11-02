import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import AlertModal from '../components/AlertModal';

interface SettingsScreenProps {
  navigation: any;
}

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const { user } = useAuth();
  const [enableWalkTracking, setEnableWalkTracking] = useState(true);
  const [autoShareWalks, setAutoShareWalks] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  // Load walk tracking settings
  useEffect(() => {
    if (user) {
      loadSettings();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('enable_walk_tracking, auto_share_walks')
        .eq('id', user!.id)
        .single();

      if (error) throw error;

      if (data) {
        setEnableWalkTracking(data.enable_walk_tracking !== false);
        setAutoShareWalks(data.auto_share_walks !== false);
      }
    } catch (err) {
      console.error('Error loading settings:', err);
      setAlertMessage('Kunne ikke laste innstillinger');
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const updateWalkTracking = async (value: boolean) => {
    if (!user) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ enable_walk_tracking: value })
        .eq('id', user.id);

      if (error) throw error;
      setEnableWalkTracking(value);
    } catch (err) {
      console.error('Error updating walk tracking:', err);
      setAlertMessage('Kunne ikke oppdatere innstilling');
      setAlertVisible(true);
      setEnableWalkTracking(!value); // Revert
    } finally {
      setSaving(false);
    }
  };

  const updateAutoShare = async (value: boolean) => {
    if (!user) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ auto_share_walks: value })
        .eq('id', user.id);

      if (error) throw error;
      setAutoShareWalks(value);
    } catch (err) {
      console.error('Error updating auto share:', err);
      setAlertMessage('Kunne ikke oppdatere innstilling');
      setAlertVisible(true);
      setAutoShareWalks(!value); // Revert
    } finally {
      setSaving(false);
    }
  };
  
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

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Innstillinger</Text>

          <View style={styles.section}>
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => navigation.navigate('GoalSettings')}
            >
              <Text style={styles.settingsButtonText}>🎯 Daglig mål</Text>
              <Text style={styles.settingsButtonArrow}>→</Text>
            </TouchableOpacity>
          </View>

          {/* Change Password Section - Only for logged in users */}
          {user && (
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.settingsButton}
                onPress={() => navigation.navigate('PasswordSettings')}
              >
                <Text style={styles.settingsButtonText}>🔒 Endre passord</Text>
                <Text style={styles.settingsButtonArrow}>→</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Walk Tracking Settings */}
          {user && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>GPS-tracking</Text>
              
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#1ED760" />
                </View>
              ) : (
                <>
                  <View style={styles.toggleRow}>
                    <View style={styles.toggleInfo}>
                      <Text style={styles.toggleLabel}>Aktiver turoppdeling</Text>
                      <Text style={styles.toggleDescription}>
                        Automatisk spore turer når du går/løper
                      </Text>
                    </View>
                    <Switch
                      value={enableWalkTracking}
                      onValueChange={updateWalkTracking}
                      disabled={saving}
                      trackColor={{ false: '#e0e0e0', true: '#1ED760' }}
                      thumbColor="#fff"
                    />
                  </View>

                  {enableWalkTracking && (
                    <View style={[styles.toggleRow, styles.toggleRowIndented]}>
                      <View style={styles.toggleInfo}>
                        <Text style={styles.toggleLabel}>Del automatisk</Text>
                        <Text style={styles.toggleDescription}>
                          Del turer {'>='} 1 km automatisk som innlegg
                        </Text>
                      </View>
                      <Switch
                        value={autoShareWalks}
                        onValueChange={updateAutoShare}
                        disabled={saving}
                        trackColor={{ false: '#e0e0e0', true: '#1ED760' }}
                        thumbColor="#fff"
                      />
                    </View>
                  )}
                </>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <AlertModal
        visible={alertVisible}
        title="Feil"
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
    color: '#1ED760',
    fontWeight: '600',
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 20,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 30,
  },
  section: {
    marginBottom: 20,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9f9f9',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  settingsButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  settingsButtonArrow: {
    fontSize: 18,
    color: '#666',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
    marginTop: 10,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 12,
  },
  toggleRowIndented: {
    marginLeft: 20,
    marginTop: 8,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  toggleDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
});

