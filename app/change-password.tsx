
import { router } from 'expo-router';
import {
    EmailAuthProvider,
    reauthenticateWithCredential,
    updatePassword,
} from 'firebase/auth';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { auth } from './config/firebase';

export default function ChangePasswordScreen() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChangePassword = async () => {
    const user = auth.currentUser;

    if (!user) {
      Alert.alert(
        'Sign in required',
        'Please sign in again before changing your password.',
        [
          {
            text: 'Go to Login',
            onPress: () => router.replace('/auth/login'),
          },
        ]
      );
      return;
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Missing information', 'Please fill in all fields.');
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert(
        'Password too short',
        'Your new password must contain at least 8 characters.'
      );
      return;
    }

    if (currentPassword === newPassword) {
      Alert.alert(
        'Choose a new password',
        'Your new password must be different from your current password.'
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(
        'Passwords do not match',
        'Please make sure both new password fields match.'
      );
      return;
    }

    if (!user.email) {
      Alert.alert(
        'Account error',
        'We could not find an email for this account.'
      );
      return;
    }

    setLoading(true);

    try {
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      );

      // Verify the current password before changing it.
      await reauthenticateWithCredential(user, credential);

      // Update the password in Firebase Authentication.
      await updatePassword(user, newPassword);

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      Alert.alert(
        'Password changed',
        'Your password has been updated successfully.',
        [
          {
            text: 'Back to Profile',
            onPress: () => router.replace('/(tabs)/profile'),
          },
        ]
      );
    } catch (error: any) {
      let message =
        'We could not change your password. Please try again.';

      if (
        error?.code === 'auth/wrong-password' ||
        error?.code === 'auth/invalid-credential' ||
        error?.code === 'auth/invalid-login-credentials'
      ) {
        message = 'Your current password is incorrect.';
      } else if (error?.code === 'auth/weak-password') {
        message =
          'Please choose a stronger password with at least 8 characters.';
      } else if (error?.code === 'auth/too-many-requests') {
        message =
          'Too many attempts. Please wait a while and try again.';
      } else if (
        error?.code === 'auth/network-request-failed'
      ) {
        message =
          'Network error. Check your internet connection and try again.';
      } else if (
        error?.code === 'auth/requires-recent-login'
      ) {
        message =
          'Please sign out, sign in again, and retry the password change.';
      }

      Alert.alert('Unable to change password', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          disabled={loading}
        >
          <Text style={styles.backText}>‹  Back</Text>
        </TouchableOpacity>

        <View style={styles.iconCircle}>
          <Text style={styles.lockIcon}>🔐</Text>
        </View>

        <Text style={styles.title}>Change Password</Text>

        <Text style={styles.subtitle}>
          Keep your BudgetWise account secure by using a strong,
          private password.
        </Text>

        <View style={styles.form}>
          <Text style={styles.label}>Current Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.input}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Enter current password"
              placeholderTextColor="#94A3B8"
              secureTextEntry={!showCurrent}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              textContentType="password"
            />
            <TouchableOpacity
              onPress={() => setShowCurrent(!showCurrent)}
              disabled={loading}
            >
              <Text style={styles.showText}>
                {showCurrent ? 'Hide' : 'Show'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>New Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Enter new password"
              placeholderTextColor="#94A3B8"
              secureTextEntry={!showNew}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              textContentType="newPassword"
            />
            <TouchableOpacity
              onPress={() => setShowNew(!showNew)}
              disabled={loading}
            >
              <Text style={styles.showText}>
                {showNew ? 'Hide' : 'Show'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.helper}>
            Use at least 8 characters.
          </Text>

          <Text style={styles.label}>Confirm New Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Enter new password again"
              placeholderTextColor="#94A3B8"
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              textContentType="newPassword"
            />
            <TouchableOpacity
              onPress={() => setShowConfirm(!showConfirm)}
              disabled={loading}
            >
              <Text style={styles.showText}>
                {showConfirm ? 'Hide' : 'Show'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.saveButton,
              loading && styles.disabledButton,
            ]}
            onPress={handleChangePassword}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>
                Update Password
              </Text>
            )}
          </TouchableOpacity>

          <Text style={styles.securityNote}>
            Your password is updated through Firebase Authentication.
            BudgetWise does not store your password in Firestore.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 20,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    marginBottom: 20,
  },
  backText: {
    fontSize: 16,
    color: '#176B4D',
    fontWeight: '600',
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  lockIcon: {
    fontSize: 34,
  },
  title: {
    fontSize: 27,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 23,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  form: {
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
    marginTop: 16,
  },
  passwordContainer: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 14,
    fontSize: 15,
    color: '#0F172A',
  },
  showText: {
    color: '#176B4D',
    fontSize: 13,
    fontWeight: '700',
    paddingLeft: 8,
    paddingVertical: 8,
  },
  helper: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 7,
  },
  saveButton: {
    minHeight: 54,
    backgroundColor: '#176B4D',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    paddingHorizontal: 16,
  },
  disabledButton: {
    opacity: 0.65,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  securityNote: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 18,
  },
});
