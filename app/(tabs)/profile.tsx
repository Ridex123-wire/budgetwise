
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import {
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { auth } from '../config/firebase';

const CURRENCY_OPTIONS = [
  { code: 'NGN', label: 'Nigerian Naira (₦)' },
  { code: 'USD', label: 'US Dollar ($)' },
  { code: 'GBP', label: 'British Pound (£)' },
  { code: 'EUR', label: 'Euro (€)' },
];

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  // App preferences
  const [currency, setCurrency] = useState('NGN');
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [savingPreference, setSavingPreference] = useState(false);
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Load saved preferences from this device.
  useEffect(() => {
    let active = true;

    const loadPreferences = async () => {
      try {
        const [savedCurrency, savedReminders] = await Promise.all([
          AsyncStorage.getItem('budgetwise_currency'),
          AsyncStorage.getItem('budgetwise_reminders'),
        ]);

        if (!active) return;

        if (
          savedCurrency &&
          CURRENCY_OPTIONS.some((option) => option.code === savedCurrency)
        ) {
          setCurrency(savedCurrency);
        }

        if (savedReminders !== null) {
          setRemindersEnabled(savedReminders === 'true');
        }
      } catch (error) {
        console.error('Could not load preferences:', error);
      } finally {
        if (active) {
          setPreferencesLoaded(true);
        }
      }
    };

    void loadPreferences();

    return () => {
      active = false;
    };
  }, []);

  const showMessage = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleEditProfile = () => {
    router.push('/edit-profile' as any);
  };

  const handleChangePassword = () => {
    if (!auth.currentUser) {
      showMessage(
        'Sign in required',
        'Please sign in before changing your password.'
      );
      router.replace('/auth/login');
      return;
    }

    router.push('/change-password');
  };

  const chooseCurrency = async (nextCurrency: string) => {
    if (savingPreference || !preferencesLoaded) return;

    setSavingPreference(true);

    try {
      await AsyncStorage.setItem('budgetwise_currency', nextCurrency);
      setCurrency(nextCurrency);
      setCurrencyModalVisible(false);
    } catch (error) {
      console.error('Could not save currency:', error);
      showMessage(
        'Unable to save',
        'Your currency preference could not be saved. Please try again.'
      );
    } finally {
      setSavingPreference(false);
    }
  };

  const toggleReminders = async (enabled: boolean) => {
    if (savingPreference || !preferencesLoaded) return;

    setSavingPreference(true);

    try {
      await AsyncStorage.setItem(
        'budgetwise_reminders',
        String(enabled)
      );
      setRemindersEnabled(enabled);
    } catch (error) {
      console.error('Could not save reminder preference:', error);
      showMessage(
        'Unable to save',
        'Your reminder preference could not be saved. Please try again.'
      );
    } finally {
      setSavingPreference(false);
    }
  };

  const performSignOut = async () => {
    if (signingOut) return;

    try {
      setSigningOut(true);
      await signOut(auth);
      router.replace('/auth/login');
    } catch (error) {
      console.error('Sign-out error:', error);

      showMessage(
        'Sign-out failed',
        'We could not sign you out. Please try again.'
      );

      setSigningOut(false);
    }
  };

  const handleSignOut = () => {
    if (signingOut) return;

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        'Are you sure you want to sign out of BudgetWise?'
      );

      if (confirmed) {
        void performSignOut();
      }

      return;
    }

    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out of BudgetWise?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            void performSignOut();
          },
        },
      ]
    );
  };

  const displayName =
    user?.displayName ||
    user?.email?.split('@')[0] ||
    'BudgetWise User';

  const initial = displayName.charAt(0).toUpperCase();

  const selectedCurrency =
    CURRENCY_OPTIONS.find((option) => option.code === currency) ??
    CURRENCY_OPTIONS[0];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#16A34A" />
        <Text style={styles.loadingText}>
          Loading your profile...
        </Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile & Settings</Text>

          <Text style={styles.headerSubtitle}>
            Manage your account and preferences.
          </Text>
        </View>

        {/* Profile information */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.name}>{displayName}</Text>

            <Text style={styles.email}>
              {user?.email || 'No email available'}
            </Text>

            <View style={styles.accountBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.accountBadgeText}>
                Firebase account
              </Text>
            </View>
          </View>
        </View>

        {/* Account actions */}
        <TouchableOpacity
          style={styles.editProfileButton}
          onPress={handleEditProfile}
          activeOpacity={0.8}
          disabled={signingOut}
          accessibilityRole="button"
          accessibilityLabel="Edit Profile"
        >
          <Text style={styles.editProfileButtonText}>
            ✎  Edit Profile
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.changePasswordButton}
          onPress={handleChangePassword}
          activeOpacity={0.8}
          disabled={signingOut}
          accessibilityRole="button"
          accessibilityLabel="Change Password"
        >
          <Text style={styles.changePasswordButtonText}>
            🔒  Change Password
          </Text>
        </TouchableOpacity>

        {/* Account settings */}
        <Text style={styles.sectionTitle}>ACCOUNT</Text>

        <View style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={handleEditProfile}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Edit personal information"
          >
            <View style={styles.settingIcon}>
              <Text style={styles.iconText}>👤</Text>
            </View>

            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>
                Personal information
              </Text>

              <Text style={styles.settingDescription}>
                Your account name and email
              </Text>
            </View>

            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity
            style={styles.settingRow}
            onPress={handleChangePassword}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Manage account security"
          >
            <View style={styles.settingIcon}>
              <Text style={styles.iconText}>🔒</Text>
            </View>

            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>
                Account security
              </Text>

              <Text style={styles.settingDescription}>
                Change your password and protect your account
              </Text>
            </View>

            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* App preferences */}
        <Text style={styles.sectionTitle}>PREFERENCES</Text>

        <View style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => setCurrencyModalVisible(true)}
            disabled={!preferencesLoaded || savingPreference}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Choose currency"
          >
            <View style={styles.settingIcon}>
              <Text style={styles.iconText}>💵</Text>
            </View>

            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Currency</Text>

              <Text style={styles.settingDescription}>
                {preferencesLoaded
                  ? selectedCurrency.label
                  : 'Loading preference...'}
              </Text>
            </View>

            <Text style={styles.rowArrow}>›</Text>
          </TouchableOpacity>

          <View style={styles.separator} />

          <View style={styles.settingRow}>
            <View style={styles.settingIcon}>
              <Text style={styles.iconText}>🔔</Text>
            </View>

            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>
                Reminder preference
              </Text>

              <Text style={styles.settingDescription}>
                {preferencesLoaded
                  ? remindersEnabled
                    ? 'Preference enabled'
                    : 'Preference disabled'
                  : 'Loading preference...'}
              </Text>
            </View>

            {preferencesLoaded ? (
              <Switch
                value={remindersEnabled}
                onValueChange={(enabled) => {
                  void toggleReminders(enabled);
                }}
                disabled={savingPreference}
                trackColor={{
                  false: '#CBD5E1',
                  true: '#86EFAC',
                }}
                thumbColor={
                  remindersEnabled ? '#16A34A' : '#F8FAFC'
                }
                accessibilityLabel="Enable reminder preference"
              />
            ) : (
              <ActivityIndicator size="small" color="#16A34A" />
            )}
          </View>
        </View>

        {/* Security note */}
        <View style={styles.securityNote}>
          <Text style={styles.securityTitle}>
            🛡️ Your money, your control
          </Text>

          <Text style={styles.securityText}>
            Always sign out when using a shared device. Never share
            your password with anyone.
          </Text>
        </View>

        {/* Sign out */}
        <TouchableOpacity
          style={[
            styles.signOutButton,
            signingOut && styles.disabledButton,
          ]}
          onPress={handleSignOut}
          disabled={signingOut}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Sign Out"
        >
          {signingOut ? (
            <ActivityIndicator color="#DC2626" />
          ) : (
            <Text style={styles.signOutText}>
              ↪  Sign Out
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.footer}>
          BudgetWise · Your money, your future.
        </Text>
      </ScrollView>

      {/* Currency selection modal */}
      <Modal
        visible={currencyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!savingPreference) {
            setCurrencyModalVisible(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choose Currency</Text>

            <Text style={styles.modalSubtitle}>
              Select your preferred display currency.
            </Text>

            {CURRENCY_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.code}
                style={styles.currencyOption}
                onPress={() => {
                  void chooseCurrency(option.code);
                }}
                disabled={savingPreference}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={option.label}
              >
                <Text style={styles.currencyOptionText}>
                  {option.label}
                </Text>

                <Text style={styles.currencyCheck}>
                  {currency === option.code ? '✓' : ''}
                </Text>
              </TouchableOpacity>
            ))}

            {savingPreference && (
              <ActivityIndicator
                style={styles.modalLoader}
                color="#16A34A"
              />
            )}

            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setCurrencyModalVisible(false)}
              disabled={savingPreference}
              accessibilityRole="button"
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  content: {
    padding: 20,
    paddingTop: 28,
    paddingBottom: 36,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },

  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 14,
  },

  header: {
    marginBottom: 24,
  },

  headerTitle: {
    fontSize: 27,
    fontWeight: '800',
    color: '#0F172A',
  },

  headerSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 7,
  },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },

  avatarText: {
    fontSize: 27,
    fontWeight: '800',
    color: '#15803D',
  },

  profileInfo: {
    flex: 1,
  },

  name: {
    fontSize: 19,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 5,
  },

  email: {
    fontSize: 13,
    color: '#64748B',
  },

  accountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F0FDF4',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginTop: 10,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#16A34A',
    marginRight: 6,
  },

  accountBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#15803D',
  },

  editProfileButton: {
    backgroundColor: '#16A34A',
    borderRadius: 13,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  editProfileButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  changePasswordButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#16A34A',
    marginBottom: 26,
  },

  changePasswordButtonText: {
    color: '#15803D',
    fontSize: 14,
    fontWeight: '800',
  },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1.2,
    marginBottom: 12,
  },

  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    marginBottom: 26,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 17,
  },

  settingIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 13,
  },

  iconText: {
    fontSize: 19,
  },

  settingInfo: {
    flex: 1,
  },

  settingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },

  settingDescription: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 5,
    lineHeight: 17,
  },

  rowArrow: {
    fontSize: 25,
    color: '#94A3B8',
    marginLeft: 8,
  },

  separator: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },

  securityNote: {
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    padding: 17,
    marginBottom: 22,
  },

  securityTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 7,
  },

  securityText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#166534',
  },

  signOutButton: {
    minHeight: 52,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  disabledButton: {
    opacity: 0.6,
  },

  signOutText: {
    color: '#DC2626',
    fontSize: 15,
    fontWeight: '800',
  },

  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 24,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },

  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 6,
    marginBottom: 16,
  },

  currencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },

  currencyOptionText: {
    fontSize: 14,
    color: '#1E293B',
  },

  currencyCheck: {
    fontSize: 18,
    fontWeight: '800',
    color: '#16A34A',
  },

  modalLoader: {
    marginTop: 12,
  },

  modalCancel: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },

  modalCancelText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },
});
