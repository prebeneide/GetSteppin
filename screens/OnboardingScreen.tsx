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
  Image,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getDeviceId } from '../lib/deviceId';
import AlertModal from '../components/AlertModal';
import { useTranslation } from '../lib/i18n';
import { searchUsers, sendFriendRequest, type Friend } from '../services/friendService';
import { requestNotificationPermissions } from '../services/pushNotificationService';

interface OnboardingScreenProps {
  navigation: any;
  onComplete: (goal?: number) => void;
}

export default function OnboardingScreen({ navigation, onComplete }: OnboardingScreenProps) {
  const { user } = useAuth();
  const { t } = useTranslation();

  // Step 1 = goal, 2 = find friends (logged-in only), 3 = notifications
  const [step, setStep] = useState(1);
  const [savedGoal, setSavedGoal] = useState<number | undefined>();

  // Step 1 state
  const [goal, setGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 2 state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [searching, setSearching] = useState(false);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);

  // Step 3 state
  const [notifGranted, setNotifGranted] = useState(false);
  const [requestingNotifs, setRequestingNotifs] = useState(false);

  // Alert
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  const showAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  // Logged-in users go through 3 steps; anonymous users skip step 2 (friends)
  const totalSteps = user ? 3 : 2;
  // Map internal step to display step for anonymous (step 3 → display 2)
  const displayStep = !user && step === 3 ? 2 : step;

  // ── Step 1: Goal ───────────────────────────────────────

  const validateGoal = (value: string): string => {
    const num = parseInt(value, 10);
    if (isNaN(num)) return t('screens.onboarding.pleaseEnterNumber');
    if (num < 1000) return t('screens.onboarding.minimum1000');
    if (num > 100000) return t('screens.onboarding.maximum100000');
    return '';
  };

  const handleGoalChange = (value: string) => {
    setGoal(value.replace(/[^0-9]/g, ''));
    setError('');
  };

  const handleSetGoal = async () => {
    const goalNum = parseInt(goal, 10);
    const validationError = validateGoal(goal);
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    setError('');
    try {
      if (user) {
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ daily_step_goal: goalNum })
          .eq('id', user.id);
        if (updateError) {
          showAlert(t('common.error'), t('screens.onboarding.couldNotSave'));
          return;
        }
      } else {
        const deviceId = await getDeviceId();
        const { data: existing } = await supabase
          .from('device_settings')
          .select('id')
          .eq('device_id', deviceId)
          .single();
        if (existing) {
          const { error: updateError } = await supabase
            .from('device_settings')
            .update({ daily_step_goal: goalNum, updated_at: new Date().toISOString() })
            .eq('device_id', deviceId);
          if (updateError) {
            showAlert(t('common.error'), t('screens.onboarding.couldNotSave'));
            return;
          }
        } else {
          const { error: insertError } = await supabase
            .from('device_settings')
            .insert({ device_id: deviceId, daily_step_goal: goalNum });
          if (insertError) {
            showAlert(t('common.error'), t('screens.onboarding.couldNotSave'));
            return;
          }
        }
      }
      setSavedGoal(goalNum);
      setStep(user ? 2 : 3);
    } catch {
      showAlert(t('common.error'), t('screens.onboarding.somethingWentWrong'));
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Find Friends ───────────────────────────────

  const handleSearch = async () => {
    if (!user || !searchQuery.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const { data } = await searchUsers(searchQuery.trim(), user.id);
      setSearchResults(data || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async (friend: Friend) => {
    if (!user || friend.status === 'accepted' || friend.status === 'pending') return;
    setSendingRequest(friend.id);
    try {
      const { error } = await sendFriendRequest(user.id, friend.id);
      if (!error) {
        setSearchResults(prev =>
          prev.map(f =>
            f.id === friend.id
              ? { ...f, status: 'pending', is_requester: true, friendship_id: 'pending' }
              : f
          )
        );
      }
    } catch {} finally {
      setSendingRequest(null);
    }
  };

  // ── Step 3: Notifications ──────────────────────────────

  const handleEnableNotifications = async () => {
    setRequestingNotifs(true);
    try {
      const granted = await requestNotificationPermissions();
      setNotifGranted(granted);
      if (granted) {
        setTimeout(() => onComplete(savedGoal), 1200);
      }
    } catch {} finally {
      setRequestingNotifs(false);
    }
  };

  // ── Step indicators ────────────────────────────────────

  const renderDots = () => (
    <View style={styles.dotsRow}>
      {Array.from({ length: totalSteps }).map((_, i) => (
        <View key={i} style={[styles.dot, displayStep === i + 1 && styles.dotActive]} />
      ))}
    </View>
  );

  // ── Step 1 render ──────────────────────────────────────

  const renderStep1 = () => (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.content}>
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeEmoji}>👋</Text>
          <Text style={styles.welcomeTitle}>{t('screens.onboarding.welcomeTitle')}</Text>
          <Text style={styles.welcomeText}>{t('screens.onboarding.welcomeText')}</Text>
          <Text style={styles.motivationText}>{t('screens.onboarding.motivationText')}</Text>
        </View>

        <View style={styles.goalContainer}>
          <Text style={styles.goalQuestion}>{t('screens.onboarding.goalQuestion')}</Text>
          <Text style={styles.goalHint}>{t('screens.onboarding.goalHint')}</Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, error && styles.inputError]}
              placeholder={t('screens.onboarding.example')}
              value={goal}
              onChangeText={handleGoalChange}
              keyboardType="number-pad"
              maxLength={6}
              editable={!loading}
            />
            <Text style={styles.inputLabel}>{t('screens.onboarding.stepsPerDay')}</Text>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsLabel}>{t('screens.onboarding.quickSelection')}:</Text>
            <View style={styles.suggestions}>
              {[5000, 10000, 15000, 20000].map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.suggestionButton, goal === s.toString() && styles.suggestionButtonActive]}
                  onPress={() => { setGoal(s.toString()); setError(''); }}
                  disabled={loading}
                >
                  <Text style={[styles.suggestionButtonText, goal === s.toString() && styles.suggestionButtonTextActive]}>
                    {s.toLocaleString()}
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
              <Text style={styles.buttonText}>{t('screens.onboarding.saving')}</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>{t('screens.onboarding.next')} →</Text>
          )}
        </TouchableOpacity>

        {!user && (
          <TouchableOpacity style={styles.skipButton} onPress={() => onComplete()} disabled={loading}>
            <Text style={styles.skipButtonText}>{t('screens.onboarding.skipForNow')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );

  // ── Step 2 render ──────────────────────────────────────

  const renderStep2 = () => (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.content}>
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeEmoji}>👫</Text>
          <Text style={styles.welcomeTitle}>{t('screens.onboarding.findFriendsTitle')}</Text>
          <Text style={styles.welcomeText}>{t('screens.onboarding.findFriendsSubtitle')}</Text>
        </View>

        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder={t('screens.onboarding.searchFriendsPlaceholder')}
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
            {searching
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.searchButtonText}>🔍</Text>
            }
          </TouchableOpacity>
        </View>

        {searchResults.map(friend => (
          <View key={friend.id} style={styles.friendRow}>
            <View style={styles.friendInfo}>
              {friend.avatar_url ? (
                <Image source={{ uri: friend.avatar_url }} style={styles.friendAvatar} />
              ) : (
                <View style={styles.friendAvatarPlaceholder}>
                  <Text style={styles.friendAvatarText}>
                    {(friend.username || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View>
                <Text style={styles.friendUsername}>{friend.username}</Text>
                {friend.full_name ? <Text style={styles.friendFullName}>{friend.full_name}</Text> : null}
              </View>
            </View>
            <TouchableOpacity
              style={[
                styles.addButton,
                (friend.status === 'accepted' || friend.status === 'pending') && styles.addButtonSent,
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
                <Text style={styles.addButtonText}>
                  {friend.status === 'accepted' || friend.status === 'pending'
                    ? t('screens.onboarding.requestSent')
                    : t('screens.onboarding.add')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.button, { marginTop: 24 }]}
          onPress={() => setStep(3)}
        >
          <Text style={styles.buttonText}>{t('screens.onboarding.next')} →</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={() => setStep(3)}>
          <Text style={styles.skipButtonText}>{t('screens.onboarding.skipStep')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  // ── Step 3 render ──────────────────────────────────────

  const renderStep3 = () => (
    <View style={styles.centeredContent}>
      <View style={styles.welcomeContainer}>
        <Text style={styles.welcomeEmoji}>{notifGranted ? '🎉' : '🔔'}</Text>
        <Text style={styles.welcomeTitle}>{t('screens.onboarding.notificationsTitle')}</Text>
        <Text style={styles.welcomeText}>{t('screens.onboarding.notificationsSubtitle')}</Text>
      </View>

      {notifGranted ? (
        <View style={[styles.button, styles.buttonSuccess]}>
          <Text style={styles.buttonText}>{t('screens.onboarding.notificationsEnabled')}</Text>
        </View>
      ) : (
        <>
          <TouchableOpacity
            style={[styles.button, requestingNotifs && styles.buttonDisabled]}
            onPress={handleEnableNotifications}
            disabled={requestingNotifs}
          >
            {requestingNotifs ? (
              <View style={styles.buttonLoading}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.buttonText}>{t('common.loading')}</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>{t('screens.onboarding.enableNotifications')}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipButton} onPress={() => onComplete(savedGoal)}>
            <Text style={styles.skipButtonText}>{t('screens.onboarding.skipNotifications')}</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  return (
    <>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.topBar}>
          {renderDots()}
          <Text style={styles.stepLabel}>{displayStep} / {totalSteps}</Text>
        </View>

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
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
  topBar: {
    paddingTop: 55,
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e0e0e0',
  },
  dotActive: {
    backgroundColor: '#1ED760',
    width: 24,
  },
  stepLabel: {
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
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
  centeredContent: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  welcomeContainer: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 10,
  },
  welcomeEmoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 26,
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
    marginBottom: 10,
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
    borderColor: '#1ED760',
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
  button: {
    backgroundColor: '#1ED760',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  buttonDisabled: {
    backgroundColor: '#cccccc',
  },
  buttonSuccess: {
    backgroundColor: '#1ED760',
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
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 10,
  },
  skipButtonText: {
    color: '#666',
    fontSize: 14,
  },
  // Step 2 – friend search
  searchRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  searchButton: {
    backgroundColor: '#1ED760',
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonDisabled: {
    backgroundColor: '#ccc',
  },
  searchButtonText: {
    fontSize: 20,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  friendAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1ED760',
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  friendUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  friendFullName: {
    fontSize: 13,
    color: '#888',
  },
  addButton: {
    backgroundColor: '#1ED760',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 72,
    alignItems: 'center',
  },
  addButtonSent: {
    backgroundColor: '#e0e0e0',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
