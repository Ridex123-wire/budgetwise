
import { router } from 'expo-router';
import { useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/firebase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const showMessage = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleLogin = async () => {
    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      showMessage(
        'Missing Information',
        'Please enter your email and password.'
      );
      return;
    }

    if (loading) return;

    setLoading(true);

    try {
      // Authenticate the user with Firebase.
      await signInWithEmailAndPassword(
        auth,
        cleanEmail,
        password
      );

      // Open the dashboard only after successful login.
      router.replace('/(tabs)/dashboard');
    } catch (error: any) {
      console.error('Login error:', error?.code, error?.message);

      let message =
        'Something went wrong. Please try again.';

      switch (error?.code) {
        case 'auth/invalid-email':
          message = 'Please enter a valid email address.';
          break;

        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
          message =
            'The email or password is incorrect. Please check and try again.';
          break;

        case 'auth/too-many-requests':
          message =
            'Too many attempts. Please wait a while before trying again.';
          break;

        case 'auth/network-request-failed':
          message =
            'Unable to connect. Check your internet connection and try again.';
          break;

        case 'auth/operation-not-allowed':
          message =
            'Email and password sign-in is not enabled in Firebase Authentication.';
          break;

        case 'auth/user-disabled':
          message =
            'This account has been disabled. Please contact support.';
          break;
      }

      showMessage('Login Failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>BudgetWise</Text>

      <Text style={styles.title}>Welcome Back!</Text>

      <Text style={styles.subtitle}>
        Log in to manage your money.
      </Text>

      <View style={styles.form}>
        <Text style={styles.label}>Email Address</Text>

        <TextInput
          style={styles.input}
          placeholder="Enter your email"
          placeholderTextColor="#9CA3AF"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          editable={!loading}
        />

        <Text style={styles.label}>Password</Text>

        <TextInput
          style={styles.input}
          placeholder="Enter your password"
          placeholderTextColor="#9CA3AF"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          editable={!loading}
          onSubmitEditing={handleLogin}
          returnKeyType="go"
        />

        <TouchableOpacity
          style={[
            styles.loginButton,
            loading && styles.disabledButton,
          ]}
          onPress={handleLogin}
          activeOpacity={0.8}
          disabled={loading}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#FFFFFF" />
              <Text style={styles.loginButtonText}>
                Logging in...
              </Text>
            </View>
          ) : (
            <Text style={styles.loginButtonText}>
              Log In
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.signupContainer}>
          <Text style={styles.signupText}>
            Don't have an account?
          </Text>

          <TouchableOpacity
            onPress={() => router.push('/auth/signup')}
            disabled={loading}
          >
            <Text style={styles.signupLink}>
              {' '}Sign Up
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F5FFF8',
  },

  logo: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#15803D',
    marginBottom: 28,
  },

  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 10,
  },

  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 32,
    textAlign: 'center',
  },

  form: {
    width: '100%',
    maxWidth: 400,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },

  input: {
    width: '100%',
    height: 54,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111827',
    marginBottom: 20,
  },

  loginButton: {
    minHeight: 54,
    backgroundColor: '#15803D',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
  },

  disabledButton: {
    opacity: 0.7,
  },

  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: 'bold',
  },

  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },

  signupText: {
    fontSize: 14,
    color: '#6B7280',
  },

  signupLink: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#15803D',
  },
});
