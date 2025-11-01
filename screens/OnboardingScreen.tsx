import React, { useState } from 'react';
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

interface OnboardingScreenProps {
  navigation: any;
  onComplete: (goal?: number) => void;
}

export default function OnboardingScreen({ navigation, onComplete }: OnboardingScreenProps) {
  const { user } = useAuth();
  const [goal, setGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

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

  const handleSetGoal = async () => {
    const goalNum = parseInt(goal, 10);
    const validationError = validateGoal(goal);

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
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
          setLoading(false);
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
            setLoading(false);
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
            setLoading(false);
            return;
          }
        }
      }

      // Success - call onComplete with the goal value to avoid reload delay
      onComplete(goalNum);
    } catch (err: any) {
      console.error('Error setting goal:', err);
      showAlert('Feil', 'Noe gikk galt. Prøv igjen senere.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={styles.welcomeContainer}>
              <Text style={styles.welcomeEmoji}>👋</Text>
              <Text style={styles.welcomeTitle}>Velkommen til Steppin!</Text>
              <Text style={styles.welcomeText}>
                Klar for å ta første skritt mot et sunnere liv? 🚶‍♂️
              </Text>
              <Text style={styles.motivationText}>
                Hver skritt teller. Hver dag er en ny mulighet til å bli bedre enn i går. 
                La oss sammen nå dine mål, en skritt om gangen! 💪
              </Text>
            </View>

          <View style={styles.goalContainer}>
            <Text style={styles.goalQuestion}>
              Hvor mange skritt ønsker du å ta hver dag?
            </Text>
            <Text style={styles.goalHint}>
              Anbefalt: 10,000 skritt (ca. 7-8 km)
            </Text>

            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, error && styles.inputError]}
                placeholder="Eks: 10000"
                value={goal}
                onChangeText={handleGoalChange}
                keyboardType="number-pad"
                maxLength={6}
                editable={!loading}
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
                    disabled={loading}
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
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSetGoal}
            disabled={loading}
          >
            {loading ? (
              <View style={styles.buttonLoading}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.buttonText}>Lagrer...</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>Start reisen! 🎯</Text>
            )}
          </TouchableOpacity>

          {!user && (
            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => {
                // Skip for non-logged in users
                onComplete();
              }}
              disabled={loading}
            >
              <Text style={styles.skipButtonText}>Hopp over for nå</Text>
            </TouchableOpacity>
          )}
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
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 20,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    minHeight: '100%',
  },
  welcomeContainer: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
  },
  welcomeEmoji: {
    fontSize: 50,
    marginBottom: 15,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 10,
  },
  welcomeText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 15,
    lineHeight: 24,
    paddingHorizontal: 10,
  },
  motivationText: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  goalContainer: {
    marginBottom: 25,
  },
  goalQuestion: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 10,
  },
  goalHint: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  input: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderRadius: 12,
    padding: 15,
    fontSize: 24,
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
  },
  suggestionsLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
  },
  suggestions: {
    flexDirection: 'row',
    justifyContent: 'center',
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
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
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
  button: {
    backgroundColor: '#4CAF50',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  buttonDisabled: {
    backgroundColor: '#cccccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  buttonLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  skipButton: {
    marginTop: 15,
    alignItems: 'center',
    paddingVertical: 10,
  },
  skipButtonText: {
    color: '#666',
    fontSize: 14,
  },
});

