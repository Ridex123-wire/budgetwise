
import { router, useFocusEffect } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

const categories = [
  'Food',
  'Transport',
  'Shopping',
  'Bills',
  'Entertainment',
  'Health',
  'Other',
];

type Budget = {
  id: string;
  category: string;
  limit: number;
  month: string;
  createdAt: number;
};

type Transaction = {
  id: string;
  title: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: string;
  createdAt?: number;
};

function getCurrentMonth() {
  const date = new Date();

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, '0')}`;
}

function normalizeTimestamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (
    value &&
    typeof value === 'object' &&
    'toMillis' in value &&
    typeof value.toMillis === 'function'
  ) {
    return value.toMillis();
  }

  if (
    value &&
    typeof value === 'object' &&
    'seconds' in value &&
    typeof value.seconds === 'number'
  ) {
    return value.seconds * 1000;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export default function BudgetsScreen() {
  const [selectedCategory, setSelectedCategory] = useState('Food');
  const [limitAmount, setLimitAmount] = useState('');
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currency, setCurrency] = useState<CurrencyCode>('NGN');

  const [month] = useState(getCurrentMonth());

  // Reload the saved currency whenever the Budgets tab becomes active.
  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadCurrency = async () => {
        try {
          const savedCurrency = await getPreferredCurrency();

          if (active) {
            setCurrency(savedCurrency);
          }
        } catch (error) {
          console.error('Could not load preferred currency:', error);
        }
      };

      void loadCurrency();

      return () => {
        active = false;
      };
    }, [])
  );

  // Load this user's budgets from Firebase.
  useEffect(() => {
    let unsubscribeBudgets: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeBudgets) {
        unsubscribeBudgets();
        unsubscribeBudgets = undefined;
      }

      if (!user) {
        setBudgets([]);
        setLoading(false);
        router.replace('/auth/login');
        return;
      }

      setLoading(true);

      const budgetsRef = collection(
        db,
        'users',
        user.uid,
        'budgets'
      );

      unsubscribeBudgets = onSnapshot(
        budgetsRef,
        (snapshot) => {
          const savedBudgets: Budget[] = snapshot.docs
            .map((item) => {
              const data = item.data();

              return {
                id: item.id,
                category: String(data.category ?? 'Other'),
                limit: Number(data.limit ?? 0),
                month: String(data.month ?? ''),
                createdAt: normalizeTimestamp(data.createdAt),
              };
            })
            .filter((budget) => budget.month === month)
            .sort((a, b) =>
              a.category.localeCompare(b.category)
            );

          setBudgets(savedBudgets);
          setLoading(false);
        },
        (error) => {
          console.error('Budget loading error:', error);
          setLoading(false);

          Alert.alert(
            'Could not load budgets',
            'Check your Firestore rules and internet connection.'
          );
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeBudgets?.();
    };
  }, [month]);

  // Load this user's transactions from Firebase.
  useEffect(() => {
    let unsubscribeTransactions: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeTransactions?.();
      unsubscribeTransactions = undefined;

      if (!user) {
        setTransactions([]);
        return;
      }

      const transactionsRef = collection(
        db,
        'users',
        user.uid,
        'transactions'
      );

      unsubscribeTransactions = onSnapshot(
        transactionsRef,
        (snapshot) => {
          const savedTransactions: Transaction[] =
            snapshot.docs.map((item) => {
              const data = item.data();

              return {
                id: item.id,
                title: String(data.title ?? ''),
                amount: Number(data.amount ?? 0),
                type: data.type === 'expense' ? 'expense' : 'income',
                category: String(data.category ?? 'Other'),
                date: String(data.date ?? ''),
                createdAt: normalizeTimestamp(data.createdAt),
              };
            });

          setTransactions(savedTransactions);
        },
        (error) => {
          console.error('Transaction loading error:', error);

          Alert.alert(
            'Could not load expenses',
            'Check your Firestore rules and internet connection.'
          );
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeTransactions?.();
    };
  }, []);

  // Save or update a monthly budget.
  const saveBudget = async () => {
    const amount = Number(limitAmount.replace(/,/g, '').trim());

    if (
      !limitAmount.trim() ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      Alert.alert(
        'Invalid amount',
        'Please enter a budget amount greater than zero.'
      );
      return;
    }

    const user = auth.currentUser;

    if (!user) {
      router.replace('/auth/login');
      return;
    }

    if (saving) return;

    try {
      setSaving(true);

      const budgetId = `${month}_${selectedCategory
        .toLowerCase()
        .replace(/\s+/g, '-')}`;

      const budgetRef = doc(
        db,
        'users',
        user.uid,
        'budgets',
        budgetId
      );

      await setDoc(budgetRef, {
        category: selectedCategory,
        limit: amount,
        month,
        createdAt: Date.now(),
      });

      setLimitAmount('');

      Alert.alert(
        'Success',
        `${selectedCategory} budget saved successfully!`
      );
    } catch (error) {
      console.error('Budget saving error:', error);

      Alert.alert(
        'Could not save budget',
        'Check your Firestore rules and try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  // Delete a budget.
  const removeBudget = async (budget: Budget) => {
    const user = auth.currentUser;

    if (!user) {
      router.replace('/auth/login');
      return;
    }

    try {
      await deleteDoc(
        doc(db, 'users', user.uid, 'budgets', budget.id)
      );
    } catch (error) {
      console.error('Budget deletion error:', error);

      Alert.alert(
        'Delete failed',
        'Could not delete this budget. Please try again.'
      );
    }
  };

  // Find the beginning and end of the selected month.
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));

  const monthStart = new Date(
    year,
    monthNumber - 1,
    1
  ).getTime();

  const nextMonthStart = new Date(
    year,
    monthNumber,
    1
  ).getTime();

  // Calculate expenses for a category in the current month.
  const getSpent = (category: string) => {
    return transactions
      .filter(
        (transaction) =>
          transaction.type === 'expense' &&
          transaction.category === category &&
          typeof transaction.createdAt === 'number' &&
          transaction.createdAt >= monthStart &&
          transaction.createdAt < nextMonthStart
      )
      .reduce(
        (total, transaction) => total + transaction.amount,
        0
      );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.heading}>Monthly Budgets</Text>

      <Text style={styles.subtitle}>
        Set spending limits, track your expenses, and build
        better money habits.
      </Text>

      <View style={styles.form}>
        <Text style={styles.label}>Choose a category</Text>

        <View style={styles.categories}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryButton,
                selectedCategory === category &&
                  styles.selectedCategory,
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === category &&
                    styles.selectedCategoryText,
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>
          Monthly limit ({currency})
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Enter budget amount"
          placeholderTextColor="#8A9A90"
          keyboardType="decimal-pad"
          value={limitAmount}
          onChangeText={setLimitAmount}
        />

        <TouchableOpacity
          style={[
            styles.saveButton,
            saving && styles.disabledButton,
          ]}
          onPress={saveBudget}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Budget'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Your Budgets</Text>

      <Text style={styles.monthText}>Month: {month}</Text>

      {loading ? (
        <ActivityIndicator
          size="large"
          color="#176B4D"
          style={styles.loader}
        />
      ) : budgets.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No budgets yet</Text>

          <Text style={styles.emptyText}>
            Choose a category and save your first monthly budget.
          </Text>
        </View>
      ) : (
        budgets.map((budget) => {
          const spent = getSpent(budget.category);
          const remaining = budget.limit - spent;

          const progress =
            budget.limit > 0
              ? Math.min((spent / budget.limit) * 100, 100)
              : 0;

          const overBudget = remaining < 0;

          return (
            <View key={budget.id} style={styles.budgetCard}>
              <View style={styles.budgetHeader}>
                <Text style={styles.budgetCategory}>
                  {budget.category}
                </Text>

                <TouchableOpacity
                  onPress={() => removeBudget(budget)}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${budget.category} budget`}
                >
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.budgetAmount}>
                {formatMoney(spent, currency)} spent
              </Text>

              <Text style={styles.helperText}>
                of {formatMoney(budget.limit, currency)} monthly limit
              </Text>

              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${progress}%`,
                      backgroundColor: overBudget
                        ? '#D64545'
                        : '#176B4D',
                    },
                  ]}
                />
              </View>

              <Text style={styles.progressLabel}>
                {progress.toFixed(1)}% used
              </Text>

              <Text
                style={[
                  styles.remainingText,
                  overBudget && styles.overBudgetText,
                ]}
              >
                {overBudget
                  ? `Over budget by ${formatMoney(
                      Math.abs(remaining),
                      currency
                    )}`
                  : `${formatMoney(
                      remaining,
                      currency
                    )} remaining`}
              </Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5FFF8',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#176B4D',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#64756B',
    marginTop: 8,
    marginBottom: 22,
    lineHeight: 21,
  },
  form: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 16,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#E0EEE5',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#24372C',
    marginBottom: 10,
    marginTop: 8,
  },
  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  categoryButton: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#EEF5F0',
  },
  selectedCategory: {
    backgroundColor: '#176B4D',
  },
  categoryText: {
    color: '#385044',
    fontSize: 13,
  },
  selectedCategoryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D6E5DB',
    borderRadius: 10,
    padding: 14,
    color: '#24372C',
    fontSize: 16,
    marginBottom: 16,
  },
  saveButton: {
    backgroundColor: '#176B4D',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: 'bold',
    color: '#24372C',
  },
  monthText: {
    color: '#64756B',
    marginTop: 5,
    marginBottom: 12,
  },
  loader: {
    marginTop: 24,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 22,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0EEE5',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#24372C',
  },
  emptyText: {
    textAlign: 'center',
    color: '#64756B',
    marginTop: 8,
    lineHeight: 20,
  },
  budgetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E0EEE5',
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetCategory: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#24372C',
  },
  deleteText: {
    color: '#C0392B',
    fontWeight: '600',
  },
  budgetAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#176B4D',
    marginTop: 12,
  },
  helperText: {
    fontSize: 13,
    color: '#64756B',
    marginTop: 4,
  },
  progressTrack: {
    height: 10,
    backgroundColor: '#E0EEE5',
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 14,
  },
  progressFill: {
    height: '100%',
    borderRadius: 10,
  },
  progressLabel: {
    fontSize: 13,
    color: '#64756B',
    marginTop: 7,
  },
  remainingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#176B4D',
    marginTop: 8,
  },
  overBudgetText: {
    color: '#D64545',
  },
});
