import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getDeviceId } from '../lib/deviceId';
import AlertModal from '../components/AlertModal';

interface GoalSettingsScreenProps {
  navigation: any;
}

export default function GoalSettingsScreen({ navigation }: GoalSettingsScreenProps) {
  const { user } = useAuth();
  const [goal, setGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  // Load current goal when screen loads
  useEffect(() => {
    loadCurrentGoal();
  }, [user]);

  const loadCurrentGoal = async () => {
    setLoading(true);
    try {
      if (user) {
        // For logged in users, load from user_profiles
        const { data, error } = await supabase
          .from('user_profiles')
          .select('daily_step_goal')
          .eq('id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading goal:', error);
        } else if (data && data.daily_step_goal !== null && data.daily_step_goal !== undefined) {
          setGoal(data.daily_step_goal.toString());
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
          console.error('Error loading device goal:', error);
        } else if (data && data.daily_step_goal !== null && data.daily_step_goal !== undefined) {
          setGoal(data.daily_step_goal.toString());
        }
      }
    } catch (err) {
      console.error('Error loading goal:', err);
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  const validateGoal = (value: string): string => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return 'Vennligst skriv inn et tall';
    }
    if (num < 1000) {
      return 'Daglig mål må være minst 1000 skritt';
    }
    if (num > 100000) {
      return 'Daglig mål kan ikke være mer enn 100,000 skritt';
    }
    return '';
  };

  const handleGoalChange = (value: string) => {
    // Only allow digits
    const numericValue = value.replace(/[^0-9]/g, '');
    setGoal(numericValue);
    setError('');
  };

  const handleSaveGoal = async () => {
    const goalNum = parseInt(goal, 10);
    const validationError = validateGoal(goal);

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError('');

    try {
      // Always save to Supabase
      if (user) {
        // For logged in users, save to their profile
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ daily_step_goal: goalNum })
          .eq('id', user.id);

        if (updateError) {
          console.error('Error updating goal:', updateError);
          showAlert('Feil', 'Kunne ikke lagre mål. Prøv igjen senere.');
          setSaving(false);
          return;
        }
      } else {
        // For non-logged in users, save to device_settings
        const deviceId = await getDeviceId();
        
        // Check if device settings already exist
        const { data: existing } = await supabase
          .from('device_settings')
          .select('id')
          .eq('device_id', deviceId)
          .single();

        if (existing) {
          // Update existing
          const { error: updateError } = await supabase
            .from('device_settings')
            .update({ 
              daily_step_goal: goalNum,
              updated_at: new Date().toISOString()
            })
            .eq('device_id', deviceId);

          if (updateError) {
            console.error('Error updating device goal:', updateError);
            showAlert('Feil', 'Kunne ikke lagre mål. Prøv igjen senere.');
            setSaving(false);
            return;
          }
        } else {
          // Insert new
          const { error: insertError } = await supabase
            .from('device_settings')
            .insert({
              device_id: deviceId,
              daily_step_goal: goalNum,
            });

          if (insertError) {
            console.error('Error inserting device goal:', insertError);
            showAlert('Feil', 'Kunne ikke lagre mål. Prøv igjen senere.');
            setSaving(false);
            return;
          }
        }
      }

      // Success - show success message
      showAlert('Suksess', 'Daglig mål er oppdatert!');
    } catch (err: any) {
      console.error('Error saving goal:', err);
      showAlert('Feil', 'Noe gikk galt. Prøv igjen senere.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
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
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <Text style={styles.title}>Daglig mål</Text>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sett ditt daglige mål</Text>
              <Text style={styles.sectionDescription}>
                Hvor mange skritt ønsker du å ta hver dag?
              </Text>

              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#1ED760" />
                  <Text style={styles.loadingText}>Laster...</Text>
                </View>
              ) : (
                <>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={[styles.input, error && styles.inputError]}
                      placeholder="Eks: 10000"
                      value={goal}
                      onChangeText={handleGoalChange}
                      keyboardType="number-pad"
                      maxLength={6}
                      editable={!saving}
                    />
                    <Text style={styles.inputLabel}>skritt per dag</Text>
                  </View>

                  {error ? (
                    <Text style={styles.errorText}>{error}</Text>
                  ) : null}

                  <View style={styles.suggestionsContainer}>
                    <Text style={styles.suggestionsLabel}>Raskt valg:</Text>
                    <View style={styles.suggestions}>
                      {[5000, 10000, 15000, 20000].map((suggestion) => (
                        <TouchableOpacity
                          key={suggestion}
                          style={[
                            styles.suggestionButton,
                            goal === suggestion.toString() && styles.suggestionButtonActive,
                          ]}
                          onPress={() => {
                            setGoal(suggestion.toString());
                            setError('');
                          }}
                          disabled={saving || loading}
                        >
                          <Text
                            style={[
                              styles.suggestionButtonText,
                              goal === suggestion.toString() && styles.suggestionButtonTextActive,
                            ]}
                          >
                            {suggestion.toLocaleString()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                    onPress={handleSaveGoal}
                    disabled={saving || loading}
                  >
                    {saving ? (
                      <View style={styles.buttonLoading}>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={styles.saveButtonText}>Lagrer...</Text>
                      </View>
                    ) : (
                      <Text style={styles.saveButtonText}>Lagre mål</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <AlertModal
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
      />
    </>
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
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  input: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#1ED760',
    borderRadius: 12,
    padding: 15,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: '#f9f9f9',
    marginRight: 10,
  },
  inputError: {
    borderColor: '#F44336',
  },
  inputLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  errorText: {
    color: '#F44336',
    fontSize: 12,
    marginTop: 5,
    marginBottom: 10,
    textAlign: 'center',
  },
  suggestionsContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  suggestionsLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  suggestions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    gap: 10,
  },
  suggestionButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  suggestionButtonActive: {
    backgroundColor: '#1ED760',
    borderColor: '#1ED760',
  },
  suggestionButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  suggestionButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#1ED760',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonDisabled: {
    backgroundColor: '#cccccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});

