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
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import AlertModal from '../components/AlertModal';
import { useTranslation } from '../lib/i18n';

interface PasswordSettingsScreenProps {
  navigation: any;
}

export default function PasswordSettingsScreen({ navigation }: PasswordSettingsScreenProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState({
    current: '',
    new: '',
    confirm: '',
  });
  const [passwordTouched, setPasswordTouched] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  const showAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  // Password validation
  const validatePassword = (value: string): string => {
    if (!value) return t('screens.passwordSettings.passwordRequired');
    if (value.length < 6) return t('screens.passwordSettings.passwordMinLength');
    return '';
  };

  const validatePasswordMatch = (password: string, confirm: string): string => {
    if (!confirm) return t('screens.passwordSettings.confirmPasswordRequired');
    if (password !== confirm) return t('screens.passwordSettings.passwordsDoNotMatch');
    return '';
  };

  const handlePasswordFieldChange = (field: 'current' | 'new' | 'confirm', value: string) => {
    if (field === 'current') {
      setCurrentPassword(value);
      if (passwordTouched.current) {
        setPasswordErrors(prev => ({ ...prev, current: validatePassword(value) }));
      }
    } else if (field === 'new') {
      setNewPassword(value);
      if (passwordTouched.new) {
        setPasswordErrors(prev => ({ ...prev, new: validatePassword(value) }));
      }
      // Also validate confirm password if it's already been touched
      if (passwordTouched.confirm && confirmPassword) {
        setPasswordErrors(prev => ({
          ...prev,
          confirm: validatePasswordMatch(value, confirmPassword),
        }));
      }
    } else if (field === 'confirm') {
      setConfirmPassword(value);
      if (passwordTouched.confirm) {
        setPasswordErrors(prev => ({
          ...prev,
          confirm: validatePasswordMatch(newPassword, value),
        }));
      }
    }
  };

  const handlePasswordFieldBlur = (field: 'current' | 'new' | 'confirm') => {
    setPasswordTouched(prev => ({ ...prev, [field]: true }));
    
    if (field === 'current') {
      setPasswordErrors(prev => ({ ...prev, current: validatePassword(currentPassword) }));
    } else if (field === 'new') {
      setPasswordErrors(prev => ({ ...prev, new: validatePassword(newPassword) }));
      // Also validate confirm if it's been touched
      if (passwordTouched.confirm && confirmPassword) {
        setPasswordErrors(prev => ({
          ...prev,
          confirm: validatePasswordMatch(newPassword, confirmPassword),
        }));
      }
    } else if (field === 'confirm') {
      setPasswordErrors(prev => ({
        ...prev,
        confirm: validatePasswordMatch(newPassword, confirmPassword),
      }));
    }
  };

  const handleChangePassword = async () => {
    if (!user) {
      showAlert(t('common.error'), t('screens.passwordSettings.mustBeLoggedIn'));
      return;
    }

    // Mark all fields as touched
    setPasswordTouched({ current: true, new: true, confirm: true });

    // Validate all fields
    const currentError = validatePassword(currentPassword);
    const newError = validatePassword(newPassword);
    const confirmError = validatePasswordMatch(newPassword, confirmPassword);

    setPasswordErrors({
      current: currentError,
      new: newError,
      confirm: confirmError,
    });

    if (currentError || newError || confirmError) {
      return;
    }

    setChangingPassword(true);

    try {
      // First, verify current password by attempting to re-authenticate
      // Supabase requires re-authentication before password change
      // We'll use the user's email from auth
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser?.email) {
        showAlert(t('common.error'), t('screens.passwordSettings.couldNotGetUserInfo'));
        setChangingPassword(false);
        return;
      }

      // Verify current password by attempting sign in
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: authUser.email,
        password: currentPassword,
      });

      if (verifyError) {
        setPasswordErrors(prev => ({
          ...prev,
          current: t('screens.passwordSettings.currentPasswordWrong'),
        }));
        setChangingPassword(false);
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        console.error('Error updating password:', updateError);
        showAlert(t('common.error'), t('screens.passwordSettings.couldNotChangePassword'));
        setChangingPassword(false);
        return;
      }

      // Success - clear form and show success message
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordTouched({ current: false, new: false, confirm: false });
      setPasswordErrors({ current: '', new: '', confirm: '' });
      showAlert(t('common.success'), t('screens.passwordSettings.passwordUpdated'));

    } catch (err: any) {
      console.error('Error changing password:', err);
      showAlert(t('common.error'), t('common.error'));
    } finally {
      setChangingPassword(false);
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
            <Ionicons name="chevron-back" size={24} color="#1ED760" />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <Text style={styles.title}>{t('screens.passwordSettings.title')}</Text>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('screens.passwordSettings.setNewPassword')}</Text>
              <Text style={styles.sectionDescription}>
                {t('screens.passwordSettings.enterCurrentAndNew')}
              </Text>

              <View style={styles.passwordForm}>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={[
                      styles.passwordInput,
                      passwordTouched.current && passwordErrors.current && styles.passwordInputError,
                    ]}
                    placeholder={t('screens.passwordSettings.currentPassword')}
                    value={currentPassword}
                    onChangeText={(value) => handlePasswordFieldChange('current', value)}
                    onBlur={() => handlePasswordFieldBlur('current')}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!changingPassword}
                  />
                  {passwordTouched.current && passwordErrors.current ? (
                    <Text style={styles.passwordErrorText}>{passwordErrors.current}</Text>
                  ) : null}
                </View>

                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={[
                      styles.passwordInput,
                      passwordTouched.new && passwordErrors.new && styles.passwordInputError,
                    ]}
                    placeholder={t('screens.passwordSettings.newPassword')}
                    value={newPassword}
                    onChangeText={(value) => handlePasswordFieldChange('new', value)}
                    onBlur={() => handlePasswordFieldBlur('new')}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!changingPassword}
                  />
                  {passwordTouched.new && passwordErrors.new ? (
                    <Text style={styles.passwordErrorText}>{passwordErrors.new}</Text>
                  ) : null}
                </View>

                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={[
                      styles.passwordInput,
                      passwordTouched.confirm && passwordErrors.confirm && styles.passwordInputError,
                    ]}
                    placeholder={t('screens.passwordSettings.confirmPassword')}
                    value={confirmPassword}
                    onChangeText={(value) => handlePasswordFieldChange('confirm', value)}
                    onBlur={() => handlePasswordFieldBlur('confirm')}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!changingPassword}
                  />
                  {passwordTouched.confirm && passwordErrors.confirm ? (
                    <Text style={styles.passwordErrorText}>{passwordErrors.confirm}</Text>
                  ) : null}
                </View>

                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    (changingPassword || !currentPassword || !newPassword || !confirmPassword) &&
                      styles.saveButtonDisabled,
                  ]}
                  onPress={handleChangePassword}
                  disabled={changingPassword}
                >
                  {changingPassword ? (
                    <View style={styles.buttonLoading}>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.saveButtonText}>{t('screens.passwordSettings.changing')}</Text>
                    </View>
                  ) : (
                    <Text style={styles.saveButtonText}>{t('screens.passwordSettings.changePassword')}</Text>
                  )}
                </TouchableOpacity>
              </View>
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
  passwordForm: {
    marginTop: 10,
  },
  passwordInputContainer: {
    marginBottom: 15,
  },
  passwordInput: {
    borderWidth: 2,
    borderColor: '#1ED760',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    width: '100%',
  },
  passwordInputError: {
    borderColor: '#F44336',
  },
  passwordErrorText: {
    color: '#F44336',
    fontSize: 12,
    marginTop: 5,
    marginLeft: 5,
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

