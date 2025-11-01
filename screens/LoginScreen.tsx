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
  Modal,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import AlertModal from '../components/AlertModal';

interface LoginScreenProps {
  navigation: any;
}

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const { signIn, loading: authLoading, session } = useAuth();

  useEffect(() => {
    // Keep loading overlay visible while logging in
    // Show it when we're loading OR when auth is updating after successful login
    if (loading || (authLoading && !session)) {
      setIsLoggingIn(true);
    } else if (!authLoading && session) {
      // Hide when we have a session (user is logged in)
      setIsLoggingIn(false);
    } else if (!authLoading && !loading) {
      // Hide if auth loading is done and we're not loading
      setIsLoggingIn(false);
    }
  }, [authLoading, loading, session]);

  const showAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert('Feil', 'Vennligst fyll inn både e-post/brukernavn og passord');
      return;
    }

    setLoading(true);
    setIsLoggingIn(false); // Reset logging in state
    try {
      const { error } = await signIn(email.trim(), password);
      
      if (error) {
        setLoading(false);
        setIsLoggingIn(false);
        console.error('Login error:', error);
        
        // Show user-friendly error message
        const errorMessage = error.message || 'Brukernavn/e-post eller passord er feil';
        showAlert('Innlogging feilet', errorMessage);
      } else {
        // Success - set loading to false but let isLoggingIn stay true
        // until session is set (handled by useEffect)
        setLoading(false);
        // isLoggingIn will be set to true by useEffect when authLoading becomes true
      }
    } catch (err: any) {
      setLoading(false);
      setIsLoggingIn(false);
      console.error('Login exception:', err);
      const errorMsg = err.message || 'Noe gikk galt under innlogging';
      showAlert('Feil', errorMsg);
    }
  };

  return (
    <>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Steppin</Text>
          <Text style={styles.subtitle}>Logg inn på din konto</Text>

          <TextInput
            style={styles.input}
            placeholder="E-post eller brukernavn"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading && !isLoggingIn}
          />

          <TextInput
            style={styles.input}
            placeholder="Passord"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading && !isLoggingIn}
          />

          <TouchableOpacity
            style={[styles.button, (loading || isLoggingIn) && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading || isLoggingIn}
          >
            {loading || isLoggingIn ? (
              <View style={styles.buttonLoading}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.buttonText}>Logger inn...</Text>
              </View>
            ) : (
              <Text style={styles.buttonText}>Logg inn</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('SignUp')}
            disabled={loading || isLoggingIn}
          >
            <Text style={styles.linkText}>
              Har du ikke konto? Registrer deg
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Loading overlay when logging in */}
      <Modal
        transparent
        visible={isLoggingIn}
        animationType="fade"
      >
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Logger inn...</Text>
          </View>
        </View>
      </Modal>

      {/* Alert Modal */}
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
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    color: '#666',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: '#cccccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkText: {
    color: '#4CAF50',
    fontSize: 14,
  },
  buttonLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 200,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
});

