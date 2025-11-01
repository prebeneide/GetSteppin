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
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import AlertModal from '../components/AlertModal';

interface SignUpScreenProps {
  navigation: any;
}

export default function SignUpScreen({ navigation }: SignUpScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertButtons, setAlertButtons] = useState<Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>>([]);
  const [errors, setErrors] = useState({
    email: '',
    password: '',
    username: '',
  });
  const [touched, setTouched] = useState({
    email: false,
    password: false,
    username: false,
  });
  const { signUp } = useAuth();

  // Email validation
  const validateEmail = (value: string) => {
    if (!value) return 'E-post er påkrevd';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) return 'Ugyldig e-postformat';
    return '';
  };

  // Password validation
  const validatePassword = (value: string) => {
    if (!value) return 'Passord er påkrevd';
    if (value.length < 6) return 'Passord må være minst 6 tegn';
    return '';
  };

  // Username validation
  const validateUsername = (value: string) => {
    if (!value) return 'Brukernavn er påkrevd';
    if (value.length < 3) return 'Brukernavn må være minst 3 tegn';
    if (!/^[a-zA-Z0-9_]+$/.test(value)) return 'Brukernavn kan bare inneholde bokstaver, tall og underscore';
    return '';
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (touched.email) {
      setErrors(prev => ({ ...prev, email: validateEmail(value) }));
    }
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (touched.password) {
      setErrors(prev => ({ ...prev, password: validatePassword(value) }));
    }
  };

  const handleUsernameChange = (value: string) => {
    setUsername(value);
    if (touched.username) {
      setErrors(prev => ({ ...prev, username: validateUsername(value) }));
    }
  };

  const handleBlur = (field: 'email' | 'password' | 'username') => {
    setTouched(prev => ({ ...prev, [field]: true }));
    switch (field) {
      case 'email':
        setErrors(prev => ({ ...prev, email: validateEmail(email) }));
        break;
      case 'password':
        setErrors(prev => ({ ...prev, password: validatePassword(password) }));
        break;
      case 'username':
        setErrors(prev => ({ ...prev, username: validateUsername(username) }));
        break;
    }
  };

  const showAlert = (
    title: string,
    message: string,
    buttons?: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>
  ) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertButtons(buttons || [{ text: 'OK' }]);
    setAlertVisible(true);
  };

  const handleSignUp = async () => {
    // Mark all fields as touched to show all errors
    setTouched({ email: true, password: true, username: true });

    // Validate all fields
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    const usernameError = validateUsername(username);

    setErrors({
      email: emailError,
      password: passwordError,
      username: usernameError,
    });

    // If there are any errors, don't submit
    if (emailError || passwordError || usernameError) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await signUp(email, password, username);
      setLoading(false);

      if (error) {
        console.error('Sign up error:', error);
        const errorMsg = error.message || 'Noe gikk galt';
        showAlert('Registrering feilet', errorMsg);
      } else {
        // Show success message and navigate
        showAlert(
          '🎉 Suksess!',
          'Konto opprettet! Du kan nå logge inn.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Clear form
                setEmail('');
                setPassword('');
                setUsername('');
                navigation.navigate('Login');
              },
            },
          ]
        );
      }
    } catch (err: any) {
      setLoading(false);
      console.error('Sign up exception:', err);
      const errorMsg = err.message || 'Noe gikk galt under registrering';
      showAlert('Feil', errorMsg);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.backButtonText}>← Hjem</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.content}>
        <Text style={styles.title}>Opprett konto</Text>
        <Text style={styles.subtitle}>Registrer deg for å komme i gang</Text>

        <View>
          <TextInput
            style={[styles.input, touched.username && errors.username && styles.inputError]}
            placeholder="Brukernavn"
            value={username}
            onChangeText={handleUsernameChange}
            onBlur={() => handleBlur('username')}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {touched.username && errors.username ? (
            <Text style={styles.errorText}>{errors.username}</Text>
          ) : null}
        </View>

        <View>
          <TextInput
            style={[styles.input, touched.email && errors.email && styles.inputError]}
            placeholder="E-post"
            value={email}
            onChangeText={handleEmailChange}
            onBlur={() => handleBlur('email')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {touched.email && errors.email ? (
            <Text style={styles.errorText}>{errors.email}</Text>
          ) : null}
        </View>

        <View>
          <TextInput
            style={[styles.input, touched.password && errors.password && styles.inputError]}
            placeholder="Passord (minimum 6 tegn)"
            value={password}
            onChangeText={handlePasswordChange}
            onBlur={() => handleBlur('password')}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          {touched.password && errors.password ? (
            <Text style={styles.errorText}>{errors.password}</Text>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSignUp}
          disabled={loading}
        >
          {loading ? (
            <View style={styles.buttonLoading}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.buttonText}>Oppretter...</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>Opprett konto</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.linkText}>
            Har du allerede konto? Logg inn
          </Text>
        </TouchableOpacity>
      </View>

      {/* Alert Modal */}
      <AlertModal
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        buttons={alertButtons}
        onClose={() => setAlertVisible(false)}
      />
    </KeyboardAvoidingView>
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
    color: '#4CAF50',
    fontWeight: '600',
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
    marginBottom: 5,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  inputError: {
    borderColor: '#F44336',
    borderWidth: 2,
  },
  errorText: {
    color: '#F44336',
    fontSize: 12,
    marginBottom: 10,
    marginLeft: 5,
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
});

