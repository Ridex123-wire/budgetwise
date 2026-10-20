import { router } from 'expo-router';
import { reload, updateProfile } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
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
import { auth } from './config/firebase';

export default function EditProfileScreen() {
  const [name, setName] = useState(
    auth.currentUser?.displayName || ''
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setName(auth.currentUser?.displayName || '');
  }, []);

  const showMessage = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    const currentUser = auth.currentUser;

    if (!trimmedName) {
      setError('Please enter your name.');
      return;
    }

    if (trimmedName.length > 60) {
      setError('Your name must be 60 characters or fewer.');
      return;
    }

    if (!currentUser) {
      setError('You are not signed in. Please log in again.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      await updateProfile(currentUser, {
        displayName: trimmedName,
      });

      await reload(currentUser);

      setName(auth.currentUser?.displayName || trimmedName);

      showMessage(
        'Profile Updated',
        'Your display name has been updated successfully.'
      );

      // Return to the Profile tab using its correct Expo Router route.
      router.replace('/(tabs)/profile');
    } catch (err) {
      console.error('Profile update error:', err);

      setError(
        'Could not update your profile. Check your connection and try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/profile');
    }
  };

  const avatarLetter = (
    name.trim().charAt(0) ||
    auth.currentUser?.email?.charAt(0) ||
    'U'
  ).toUpperCase();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity
        style={styles.backButton}
        onPress={handleBack}
        activeOpacity={0.7}
        disabled={saving}
      >
        <Text style={styles.backText}>‹  Back to Profile</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.title}>Edit Profile</Text>
        <Text style={styles.subtitle}>
          Keep your BudgetWise account information up to date.
        </Text>
      </View>

      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{avatarLetter}</Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.label}>Display Name</Text>

        <TextInput
          style={styles.input}
          value={name}
          onChangeText={(value) => {
            setName(value);
            setError('');
          }}
          placeholder="Enter your name"
          placeholderTextColor="#94A3B8"
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={60}
          editable={!saving}
          accessibilityLabel="Display name"
          returnKeyType="done"
        />

        <Text style={styles.helperText}>
          This name will appear on your BudgetWise profile.
        </Text>

        <Text style={[styles.label, styles.emailLabel]}>
          Email Address
        </Text>

        <View style={styles.emailBox}>
          <Text style={styles.emailText}>
            {auth.currentUser?.email || 'No email available'}
          </Text>
        </View>

        <Text style={styles.helperText}>
          Email editing is not available here.
        </Text>

        {error ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {error}
          </Text>
        ) : null}

        <TouchableOpacity
          style={[
            styles.saveButton,
            saving && styles.disabledButton,
          ]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>
              Save Changes
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleBack}
          disabled={saving}
          activeOpacity={0.8}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>
        Your money. Your goals. Your future.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 22,
    paddingTop: 28,
    paddingBottom: 40,
    maxWidth: 650,
    width: '100%',
    alignSelf: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingRight: 12,
    marginBottom: 20,
  },
  backText: {
    color: '#15803D',
    fontSize: 15,
    fontWeight: '700',
  },
  header: {
    marginBottom: 25,
  },
  title: {
    fontSize: 29,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 21,
    marginTop: 8,
  },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 26,
  },
  avatarText: {
    color: '#15803D',
    fontSize: 34,
    fontWeight: '800',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  label: {
    color: '#1E293B',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 9,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    color: '#0F172A',
    fontSize: 15,
    backgroundColor: '#FFFFFF',
  },
  helperText: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  emailLabel: {
    marginTop: 24,
  },
  emailBox: {
    minHeight: 52,
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
  },
  emailText: {
    color: '#64748B',
    fontSize: 14,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    marginTop: 16,
    lineHeight: 19,
  },
  saveButton: {
    minHeight: 52,
    borderRadius: 13,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 25,
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  cancelButton: {
    minHeight: 48,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  cancelButtonText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    color: '#94A3B8',
    textAlign: 'center',
    fontSize: 12,
    marginTop: 25,
  },
});