import { router, useFocusEffect } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  updateDoc,
} from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { auth, db } from '../config/firebase';
import {
  formatMoney,
  getPreferredCurrency,
  type CurrencyCode,
} from '../utils/currency';

// Use browser alerts on Expo Web and native alerts on mobile.
const showSavingsAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.alert(`${title}\n\n${message}`);
    }
    return;
  }

  Alert.alert(title, message);
};

type SavingsGoal = {
  id: string;
  name: string;
  target: number;
  saved: number;
  createdAt: number;
};

export default function SavingsScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [contributions, setContributions] = useState<Record<string, string>>({});
  const [currency, setCurrency] = useState<CurrencyCode>('NGN');

  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [goalToDelete, setGoalToDelete] = useState<SavingsGoal | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Refresh the selected currency whenever this screen is focused.
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadCurrency = async () => {
        try {
          const preferredCurrency = await getPreferredCurrency();

          if (isActive) {
            setCurrency(preferredCurrency);
          }
        } catch (error) {
          console.error('Could not load preferred currency:', error);
        }
      };

      void loadCurrency();

      return () => {
        isActive = false;
      };
    }, [])
  );

  // Check whether a user is signed in.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUserId(null);
        setGoals([]);
        setLoading(false);
        router.replace('/auth/login');
        return;
      }

      setUserId(user.uid);
    });

    return unsubscribe;
  }, []);

  // Listen for this user's savings goals in Firestore.
  useEffect(() => {
    if (!userId) return;

    setLoading(true);

    const goalsRef = collection(db, 'users', userId, 'savingsGoals');

    const unsubscribe = onSnapshot(
      goalsRef,
      (snapshot) => {
        const items: SavingsGoal[] = snapshot.docs.map((item) => {
          const data = item.data();

          return {
            id: item.id,
            name: typeof data.name === 'string' ? data.name : 'Savings goal',
            target: Number(data.target) || 0,
            saved: Number(data.saved) || 0,
            createdAt: Number(data.createdAt) || 0,
          };
        });

        setGoals(items);
        setLoading(false);
      },
      (error) => {
        console.error('Savings goals error:', error);
        setLoading(false);

        showSavingsAlert(
          'Could not load goals',
          'Please check your internet connection and Firestore permissions.'
        );
      }
    );

    return unsubscribe;
  }, [userId]);

  // Create a new savings goal.
  const createGoal = async () => {
    if (saving) return;

    const cleanName = name.trim();
    const targetText = target.trim();
    const targetAmount = Number(targetText);

    if (!cleanName || !targetText) {
      showSavingsAlert(
        'Missing information',
        'Enter a goal name and target amount.'
      );
      return;
    }

    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      showSavingsAlert(
        'Invalid amount',
        'Enter a target amount greater than zero.'
      );
      return;
    }

    if (cleanName.length > 60) {
      showSavingsAlert(
        'Name too long',
        'Keep your goal name under 60 characters.'
      );
      return;
    }

    if (!userId) {
      showSavingsAlert('Not signed in', 'Please log in again.');
      return;
    }

    try {
      setSaving(true);

      await addDoc(collection(db, 'users', userId, 'savingsGoals'), {
        name: cleanName,
        target: targetAmount,
        saved: 0,
        createdAt: Date.now(),
      });

      setName('');
      setTarget('');

      showSavingsAlert(
        'Goal created! 🎯',
        'Your savings goal is ready. Let’s start saving!'
      );
    } catch (error) {
      console.error('Create goal error:', error);

      showSavingsAlert(
        'Could not create goal',
        'Please check your Firestore permissions and try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  // Start editing a goal.
  const startEditing = (goal: SavingsGoal) => {
    setEditingGoalId(goal.id);
    setEditName(goal.name);
    setEditTarget(String(goal.target));
  };

  // Cancel editing.
  const cancelEditing = () => {
    setEditingGoalId(null);
    setEditName('');
    setEditTarget('');
  };

  // Save goal changes.
  const saveGoalEdit = async (goal: SavingsGoal) => {
    if (saving) return;

    const cleanName = editName.trim();
    const targetText = editTarget.trim();
    const newTarget = Number(targetText);

    if (!cleanName || !targetText) {
      showSavingsAlert(
        'Missing information',
        'Enter a goal name and target amount.'
      );
      return;
    }

    if (cleanName.length > 60) {
      showSavingsAlert(
        'Name too long',
        'Keep your goal name under 60 characters.'
      );
      return;
    }

    if (!Number.isFinite(newTarget) || newTarget <= 0) {
      showSavingsAlert(
        'Invalid amount',
        'Enter a target amount greater than zero.'
      );
      return;
    }

    if (!userId) {
      showSavingsAlert('Not signed in', 'Please log in again.');
      return;
    }

    try {
      setSaving(true);

      await updateDoc(doc(db, 'users', userId, 'savingsGoals', goal.id), {
        name: cleanName,
        target: newTarget,
      });

      cancelEditing();

      if (goal.saved >= newTarget) {
        showSavingsAlert(
          'Goal reached! 🎉',
          `Your savings for ${cleanName} have reached the target.`
        );
      } else {
        showSavingsAlert('Goal updated', 'Your changes have been saved.');
      }
    } catch (error) {
      console.error('Edit goal error:', error);

      showSavingsAlert(
        'Could not update goal',
        'Please check your Firestore permissions and try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  // Add a contribution using the latest saved balance from Firestore.
  const addSavings = async (goal: SavingsGoal) => {
    if (saving) return;

    const amountText = contributions[goal.id] ?? '';
    const amount = Number(amountText.trim());

    // Reject blank, zero, negative, and non-finite amounts.
    if (
      !amountText.trim() ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      showSavingsAlert(
        'Invalid amount',
        'Enter an amount greater than zero.'
      );
      return;
    }

    if (!userId) {
      showSavingsAlert('Not signed in', 'Please log in again.');
      return;
    }

    const goalRef = doc(db, 'users', userId, 'savingsGoals', goal.id);

    try {
      setSaving(true);

      const result = await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(goalRef);

        if (!snapshot.exists()) {
          throw new Error(
            'This savings goal no longer exists. Refresh and try again.'
          );
        }

        const data = snapshot.data();
        const currentSaved = Number(data.saved ?? 0);
        const currentTarget = Number(data.target);

        if (
          !Number.isFinite(currentSaved) ||
          currentSaved < 0 ||
          !Number.isFinite(currentTarget) ||
          currentTarget <= 0
        ) {
          throw new Error(
            'This savings goal has invalid amounts. Edit the goal and try again.'
          );
        }

        const newSavedAmount = currentSaved + amount;

        transaction.update(goalRef, {
          saved: newSavedAmount,
        });

        return {
          previousSaved: currentSaved,
          newSavedAmount,
          currentTarget,
        };
      });

      setContributions((previous) => ({
        ...previous,
        [goal.id]: '',
      }));

      const reachedTarget =
        result.previousSaved < result.currentTarget &&
        result.newSavedAmount >= result.currentTarget;

      if (reachedTarget) {
        showSavingsAlert(
          '🎉 Goal reached!',
          `Amazing work! You reached your ${goal.name} target.`
        );
      } else {
        showSavingsAlert(
          'Great job! 💚',
          `${formatMoney(amount, currency)} added to ${goal.name}.`
        );
      }
    } catch (error) {
      console.error('Add savings error:', error);

      showSavingsAlert(
        'Could not update savings',
        error instanceof Error
          ? error.message
          : 'Please check your internet connection and Firestore permissions.'
      );
    } finally {
      setSaving(false);
    }
  };

  // Open the delete confirmation window.
  const confirmDeleteGoal = (goal: SavingsGoal) => {
    setGoalToDelete(goal);
  };

  // Delete the selected goal after confirmation.
  const removeGoal = async () => {
    if (!userId || !goalToDelete || saving) return;

    const goal = goalToDelete;

    try {
      setSaving(true);

      await deleteDoc(doc(db, 'users', userId, 'savingsGoals', goal.id));

      if (editingGoalId === goal.id) {
        cancelEditing();
      }

      setContributions((previous) => {
        const updated = { ...previous };
        delete updated[goal.id];
        return updated;
      });

      setGoalToDelete(null);

      showSavingsAlert('Goal deleted', 'Your savings goal has been deleted.');
    } catch (error) {
      console.error('Delete goal error:', error);

      showSavingsAlert(
        'Could not delete goal',
        'Please check your Firestore permissions and try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  // Summary calculations.
  const totalSaved = goals.reduce((sum, goal) => sum + goal.saved, 0);
  const totalTarget = goals.reduce((sum, goal) => sum + goal.target, 0);

  const completedGoals = goals.filter(
    (goal) => goal.target > 0 && goal.saved >= goal.target
  ).length;

  const overallProgress =
    totalTarget > 0
      ? Math.min((totalSaved / totalTarget) * 100, 100)
      : 0;

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>YOUR FINANCIAL FUTURE</Text>

        <Text style={styles.heading}>Savings Goals 💚</Text>

        <Text style={styles.subtitle}>
          Small steps today. Bigger dreams tomorrow.
        </Text>

        {/* Overall savings summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>TOTAL SAVED</Text>

          <Text style={styles.totalSaved}>
            {formatMoney(totalSaved, currency)}
          </Text>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <View style={styles.summaryColumn}>
              <Text style={styles.summarySmall}>Your goals</Text>
              <Text style={styles.summaryValue}>{goals.length}</Text>
            </View>

            <View style={styles.summaryColumn}>
              <Text style={styles.summarySmall}>Combined targets</Text>
              <Text style={styles.summaryValue}>
                {formatMoney(totalTarget, currency)}
              </Text>
            </View>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryProgressHeading}>
            <Text style={styles.summarySmall}>Overall progress</Text>
            <Text style={styles.summaryPercentage}>
              {Math.round(overallProgress)}%
            </Text>
          </View>

          <View style={styles.summaryProgressTrack}>
            <View
              style={[
                styles.summaryProgressFill,
                { width: `${overallProgress}%` },
              ]}
            />
          </View>

          <View style={styles.summaryFooter}>
            <Text style={styles.summarySmall}>Completed goals</Text>
            <Text style={styles.summaryValue}>
              {completedGoals} of {goals.length}
            </Text>
          </View>
        </View>

        {/* Create goal form */}
        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Create a savings goal</Text>

          <Text style={styles.label}>What are you saving for?</Text>

          <TextInput
            style={styles.input}
            placeholder="e.g. New laptop"
            placeholderTextColor="#94A3B8"
            value={name}
            onChangeText={setName}
            maxLength={60}
          />

          <Text style={styles.label}>Target amount ({currency})</Text>

          <TextInput
            style={styles.input}
            placeholder="e.g. 250000"
            placeholderTextColor="#94A3B8"
            value={target}
            onChangeText={setTarget}
            keyboardType="decimal-pad"
          />

          <TouchableOpacity
            style={[
              styles.primaryButton,
              saving && styles.disabledButton,
            ]}
            onPress={() => void createGoal()}
            disabled={saving}
          >
            <Text style={styles.primaryButtonText}>
              {saving ? 'Creating...' : 'Create Savings Goal'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Your goals</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#16A34A" />
        ) : goals.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🎯</Text>

            <Text style={styles.emptyTitle}>Your dreams start here</Text>

            <Text style={styles.emptyText}>
              Create your first savings goal above and start tracking your
              progress.
            </Text>
          </View>
        ) : (
          goals.map((goal) => {
            const progress =
              goal.target > 0
                ? Math.min((goal.saved / goal.target) * 100, 100)
                : 0;

            const remaining = Math.max(goal.target - goal.saved, 0);

            const completed =
              goal.target > 0 && goal.saved >= goal.target;

            const isEditing = editingGoalId === goal.id;

            return (
              <View key={goal.id} style={styles.goalCard}>
                <View style={styles.goalHeader}>
                  <View style={styles.goalIcon}>
                    <Text style={styles.goalEmoji}>
                      {completed ? '🏆' : '🎯'}
                    </Text>
                  </View>

                  <View style={styles.goalTitleWrap}>
                    <Text style={styles.goalName}>{goal.name}</Text>

                    <Text style={styles.goalTarget}>
                      Target: {formatMoney(goal.target, currency)}
                    </Text>
                  </View>

                  {completed && (
                    <Text style={styles.completed}>DONE ✓</Text>
                  )}
                </View>

                {completed && (
                  <View style={styles.celebrationCard}>
                    <Text style={styles.celebrationTitle}>
                      🎉 Congratulations!
                    </Text>

                    <Text style={styles.celebrationText}>
                      You reached your savings goal. Keep up the great work!
                    </Text>
                  </View>
                )}

                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${progress}%` },
                    ]}
                  />
                </View>

                <View style={styles.progressLabels}>
                  <Text style={styles.savedAmount}>
                    {formatMoney(goal.saved, currency)} saved
                  </Text>

                  <Text style={styles.percentage}>
                    {Math.round(progress)}%
                  </Text>
                </View>

                <Text style={styles.remaining}>
                  {completed
                    ? 'You have reached your target! 🎉'
                    : `${formatMoney(remaining, currency)} left to reach your goal`}
                </Text>

                {isEditing ? (
                  <View style={styles.editCard}>
                    <Text style={styles.label}>Goal name</Text>

                    <TextInput
                      style={styles.input}
                      value={editName}
                      onChangeText={setEditName}
                      placeholder="Goal name"
                      placeholderTextColor="#94A3B8"
                      maxLength={60}
                    />

                    <Text style={styles.label}>
                      New target amount ({currency})
                    </Text>

                    <TextInput
                      style={styles.input}
                      value={editTarget}
                      onChangeText={setEditTarget}
                      placeholder="Target amount"
                      placeholderTextColor="#94A3B8"
                      keyboardType="decimal-pad"
                    />

                    <TouchableOpacity
                      style={[
                        styles.primaryButton,
                        saving && styles.disabledButton,
                      ]}
                      onPress={() => void saveGoalEdit(goal)}
                      disabled={saving}
                    >
                      <Text style={styles.primaryButtonText}>
                        {saving ? 'Saving...' : 'Save Changes'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={cancelEditing}
                      disabled={saving}
                    >
                      <Text style={styles.cancelButtonText}>
                        Cancel Editing
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <TextInput
                      style={styles.input}
                      placeholder={`Amount to add (${currency})`}
                      placeholderTextColor="#94A3B8"
                      keyboardType="decimal-pad"
                      value={contributions[goal.id] ?? ''}
                      onChangeText={(value) =>
                        setContributions((previous) => ({
                          ...previous,
                          [goal.id]: value,
                        }))
                      }
                    />

                    <TouchableOpacity
                      style={[
                        styles.addButton,
                        saving && styles.disabledButton,
                      ]}
                      onPress={() => void addSavings(goal)}
                      disabled={saving}
                    >
                      <Text style={styles.addButtonText}>
                        {saving ? 'Adding...' : '+ Add Savings'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                <View style={styles.managementRow}>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => {
                      if (isEditing) {
                        cancelEditing();
                      } else {
                        startEditing(goal);
                      }
                    }}
                    disabled={saving}
                  >
                    <Text style={styles.editButtonText}>
                      {isEditing ? 'Cancel' : '✏️ Edit Goal'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => confirmDeleteGoal(goal)}
                    disabled={saving}
                  >
                    <Text style={styles.deleteButtonText}>
                      🗑 Delete Goal
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Delete confirmation dialog */}
      <Modal
        visible={goalToDelete !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!saving) setGoalToDelete(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}>
              <Text style={styles.confirmEmoji}>🗑️</Text>
            </View>

            <Text style={styles.confirmTitle}>Delete savings goal?</Text>

            <Text style={styles.confirmMessage}>
              Are you sure you want to delete{' '}
              <Text style={styles.confirmGoalName}>
                {goalToDelete?.name ?? 'this goal'}
              </Text>
              ? This action cannot be undone.
            </Text>

            <TouchableOpacity
              style={[
                styles.confirmDeleteButton,
                saving && styles.disabledButton,
              ]}
              onPress={() => void removeGoal()}
              disabled={saving}
            >
              <Text style={styles.confirmDeleteText}>
                {saving ? 'Deleting...' : 'Yes, delete goal'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.keepButton}
              onPress={() => setGoalToDelete(null)}
              disabled={saving}
            >
              <Text style={styles.keepButtonText}>
                Cancel — keep my goal
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F8F6',
  },
  container: {
    padding: 20,
    paddingTop: 28,
    paddingBottom: 45,
  },
  eyebrow: {
    color: '#16A34A',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  heading: {
    color: '#123026',
    fontSize: 29,
    fontWeight: '800',
    marginTop: 8,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 7,
    marginBottom: 22,
  },
  summaryCard: {
    backgroundColor: '#123C2B',
    padding: 22,
    borderRadius: 22,
    marginBottom: 24,
  },
  summaryLabel: {
    color: '#B8E8C9',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  totalSaved: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    marginTop: 8,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#426754',
    marginVertical: 18,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryColumn: {
    flex: 1,
  },
  summarySmall: {
    color: '#C5D8CC',
    fontSize: 12,
  },
  summaryValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 5,
  },
  summaryProgressHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 9,
  },
  summaryPercentage: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  summaryProgressTrack: {
    height: 9,
    borderRadius: 10,
    backgroundColor: '#426754',
    overflow: 'hidden',
  },
  summaryProgressFill: {
    height: '100%',
    borderRadius: 10,
    backgroundColor: '#4ADE80',
  },
  summaryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 18,
    marginBottom: 26,
    borderWidth: 1,
    borderColor: '#E5EDE7',
  },
  sectionTitle: {
    color: '#173D2D',
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 15,
  },
  label: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 7,
    marginTop: 9,
  },
  input: {
    backgroundColor: '#F8FAF9',
    borderWidth: 1,
    borderColor: '#DCE6DF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#172B21',
    marginBottom: 10,
  },
  primaryButton: {
    backgroundColor: '#16A34A',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 25,
    borderRadius: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5EDE7',
  },
  emptyEmoji: {
    fontSize: 36,
    marginBottom: 10,
  },
  emptyTitle: {
    color: '#173D2D',
    fontSize: 17,
    fontWeight: '800',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },
  goalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 17,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E5EDE7',
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 17,
  },
  goalIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: '#E8F7EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  goalEmoji: {
    fontSize: 22,
  },
  goalTitleWrap: {
    flex: 1,
  },
  goalName: {
    color: '#173D2D',
    fontSize: 16,
    fontWeight: '800',
  },
  goalTarget: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },
  completed: {
    color: '#15803D',
    fontSize: 10,
    fontWeight: '800',
  },
  celebrationCard: {
    backgroundColor: '#E8F7EC',
    borderWidth: 1,
    borderColor: '#BBE7C7',
    padding: 13,
    borderRadius: 12,
    marginBottom: 15,
  },
  celebrationTitle: {
    color: '#15803D',
    fontSize: 15,
    fontWeight: '800',
  },
  celebrationText: {
    color: '#276749',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  progressTrack: {
    height: 9,
    borderRadius: 10,
    backgroundColor: '#E5EDE7',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 10,
    backgroundColor: '#16A34A',
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  savedAmount: {
    color: '#173D2D',
    fontSize: 13,
    fontWeight: '700',
  },
  percentage: {
    color: '#16A34A',
    fontSize: 13,
    fontWeight: '800',
  },
  remaining: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  addButton: {
    backgroundColor: '#E8F7EC',
    padding: 13,
    borderRadius: 11,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#15803D',
    fontWeight: '800',
    fontSize: 14,
  },
  editCard: {
    backgroundColor: '#F8FAF9',
    borderRadius: 13,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#DCE6DF',
  },
  cancelButton: {
    alignItems: 'center',
    padding: 12,
    marginTop: 4,
  },
  cancelButtonText: {
    color: '#64748B',
    fontWeight: '700',
  },
  managementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5EDE7',
    paddingTop: 8,
  },
  editButton: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  editButtonText: {
    color: '#15803D',
    fontSize: 13,
    fontWeight: '700',
  },
  deleteButton: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  deleteButtonText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 25, 17, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5EDE7',
  },
  confirmIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  confirmEmoji: {
    fontSize: 28,
  },
  confirmTitle: {
    color: '#173D2D',
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
  },
  confirmMessage: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 22,
  },
  confirmGoalName: {
    color: '#173D2D',
    fontWeight: '800',
  },
  confirmDeleteButton: {
    width: '100%',
    backgroundColor: '#DC2626',
    paddingVertical: 15,
    borderRadius: 13,
    alignItems: 'center',
  },
  confirmDeleteText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  keepButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 13,
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#F1F5F2',
  },
  keepButtonText: {
    color: '#173D2D',
    fontSize: 14,
    fontWeight: '700',
  },
});
