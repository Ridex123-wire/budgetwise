
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { router } from 'expo-router';
import {
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { auth, db } from '../config/firebase';

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const showMessage = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleSignup = async () => {
    if (
      !name.trim() ||
      !email.trim() ||
      !password ||
      !confirmPassword
    ) {
      showMessage(
        'Missing Information',
        'Please fill in every field.'
      );
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(cleanEmail)) {
      showMessage(
        'Invalid Email',
        'Please enter a valid email address.'
      );
      return;
    }

    if (password.length < 8) {
      showMessage(
        'Weak Password',
        'Your password must contain at least 8 characters.'
      );
      return;
    }

    if (password !== confirmPassword) {
      showMessage(
        'Password Mismatch',
        'Your passwords do not match.'
      );
      return;
    }

    setLoading(true);

    try {
      // 1. Create the Firebase Authentication account.
      const credential = await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        password
      );

      const user = credential.user;

      // 2. Save the user's display name.
      await updateProfile(user, {
        displayName: cleanName,
      });

      // 3. Save the profile using the Firebase UID as document ID.
      await setDoc(
        doc(db, 'users', user.uid),
        {
          uid: user.uid,
          name: cleanName,
          email: user.email ?? cleanEmail,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 4. Open the dashboard after both operations succeed.
      if (Platform.OS === 'web') {
        window.alert(
          'Account Created!\n\nWelcome to BudgetWise. Your profile has been saved.'
        );
        router.replace('/(tabs)/dashboard');
      } else {
        Alert.alert(
          'Account Created!',
          'Welcome to BudgetWise. Your profile has been saved.',
          [
            {
              text: 'Continue',
              onPress: () =>
                router.replace('/(tabs)/dashboard'),
            },
          ]
        );
      }
    } catch (error: unknown) {
      const code =
        typeof error === 'object' &&
        error !== null &&
        'code' in error
          ? String(error.code)
          : '';

      console.error('BudgetWise signup error:', error);

      let message =
        'Something went wrong. Please try again.';

      if (code === 'auth/email-already-in-use') {
        message =
          'This email already has an account. Please log in.';
      } else if (code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.';
      } else if (
        code === 'auth/weak-password' ||
        code === 'auth/password-does-not-meet-requirements'
      ) {
        message = 'Please choose a stronger password.';
      } else if (code === 'auth/network-request-failed') {
        message =
          'Network error. Check your internet connection.';
      } else if (code === 'auth/operation-not-allowed') {
        message =
          'Enable Email/Password in Firebase Authentication.';
      } else if (code === 'auth/too-many-requests') {
        message =
          'Too many attempts. Please wait and try again.';
      } else if (
        code === 'permission-denied' ||
        code === 'firestore/permission-denied'
      ) {
        message =
          'Your account may have been created, but Firestore denied the profile save. Check your Firestore Rules. Try logging in with this account rather than signing up again.';
      }

      showMessage('Signup Failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.logo}>BudgetWise</Text>

        <Text style={styles.title}>
          Create your account
        </Text>

        <Text style={styles.subtitle}>
          Start managing your money and building your future.
        </Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Full name</Text>

        <TextInput
          style={styles.input}
          placeholder="Enter your full name"
          placeholderTextColor="#9CA3AF"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Email address</Text>

        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          placeholderTextColor="#9CA3AF"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Password</Text>

        <TextInput
          style={styles.input}
          placeholder="At least 8 characters"
          placeholderTextColor="#9CA3AF"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Confirm password</Text>

        <TextInput
          style={styles.input}
          placeholder="Enter your password again"
          placeholderTextColor="#9CA3AF"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TouchableOpacity
          style={[
            styles.button,
            loading && styles.buttonDisabled,
          ]}
          onPress={handleSignup}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>
              Create Account
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.loginRow}>
          <Text style={styles.loginText}>
            Already have an account?{' '}
          </Text>

          <TouchableOpacity
            onPress={() => router.push('/auth/login')}
            activeOpacity={0.7}
          >
            <Text style={styles.loginLink}>Log In</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.footer}>
        Your journey to smarter money management starts here.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5FFF8',
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    marginBottom: 32,
  },
  logo: {
    fontSize: 18,
    fontWeight: '800',
    color: '#15803D',
    marginBottom: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 23,
    color: '#6B7280',
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    width: '100%',
    height: 54,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    backgroundColor: '#FFFFFF',
    color: '#111827',
  },
  button: {
    height: 56,
    backgroundColor: '#15803D',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 24,
  },
  loginText: {
    color: '#6B7280',
    fontSize: 14,
  },
  loginLink: {
    color: '#15803D',
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 32,
  },
});
