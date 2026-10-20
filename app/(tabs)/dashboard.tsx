
import { router, useFocusEffect } from 'expo-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
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

type Transaction = {
  id: string;
  title: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: string;
  createdAt?: number;
};

const incomeCategories = [
  'Salary',
  'Business',
  'Freelance',
  'Gift',
  'Other',
];

const expenseCategories = [
  'Food',
  'Transport',
  'Shopping',
  'Bills',
  'Entertainment',
  'Health',
  'Other',
];

// Convert Firestore timestamps and older timestamp formats to milliseconds.
const normalizeTimestamp = (value: unknown): number => {
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
    if (Number.isFinite(parsed)) return parsed;
  }

  return 0;
};

export default function Dashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionType, setTransactionType] =
    useState<'income' | 'expense'>('income');
  const [category, setCategory] = useState('Salary');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [editingTransactionId, setEditingTransactionId] =
    useState<string | null>(null);
  const [currency, setCurrency] = useState<CurrencyCode>('NGN');

  // Reload the saved currency whenever the Dashboard becomes active.
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadCurrency = async () => {
        try {
          const savedCurrency = await getPreferredCurrency();

          if (isActive) {
            setCurrency(savedCurrency);
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

  const categories =
    transactionType === 'income'
      ? incomeCategories
      : expenseCategories;

  const showMessage = (message: string) => {
    if (Platform.OS === 'web') {
      window.alert(message);
    } else {
      Alert.alert('BudgetWise', message);
    }
  };

  const resetForm = () => {
    setTitle('');
    setAmount('');
    setTransactionType('income');
    setCategory('Salary');
    setEditingTransactionId(null);
  };

  // LOG OUT
  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await signOut(auth);
      router.replace('/auth/login');
    } catch (error) {
      console.error('Error logging out:', error);
      showMessage('Could not log out. Please try again.');
      setLoggingOut(false);
    }
  };

  // AUTHENTICATION AND FIRESTORE LISTENER
  useEffect(() => {
    let unsubscribeTransactions: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeTransactions?.();
      unsubscribeTransactions = undefined;

      if (!user) {
        setTransactions([]);
        setAuthChecked(true);
        router.replace('/auth/login');
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
          const savedTransactions: Transaction[] = snapshot.docs.map(
            (document) => {
              const data = document.data();

              return {
                id: document.id,
                title: String(data.title ?? ''),
                amount: Number(data.amount ?? 0),
                type: data.type === 'expense' ? 'expense' : 'income',
                category: String(data.category ?? 'Other'),
                date: String(data.date ?? ''),
                createdAt: normalizeTimestamp(data.createdAt),
              };
            }
          );

          savedTransactions.sort(
            (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)
          );

          setTransactions(savedTransactions);
          setAuthChecked(true);
        },
        (error) => {
          console.error('Error loading transactions:', error);
          setAuthChecked(true);
          showMessage(
            `Could not load transactions.\n\nError: ${
              error.code ?? 'unknown'
            }\n${error.message ?? 'Check your connection and Firestore rules.'}`
          );
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeTransactions?.();
    };
  }, []);

  // ALL-TIME FINANCIAL TOTALS
  const income = transactions
    .filter((item) => item.type === 'income')
    .reduce((total, item) => total + item.amount, 0);

  const expenses = transactions
    .filter((item) => item.type === 'expense')
    .reduce((total, item) => total + item.amount, 0);

  const balance = income - expenses;

  // CURRENT MONTH DATE RANGE
  const now = new Date();

  const monthStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  ).getTime();

  const nextMonthStart = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1
  ).getTime();

  const monthLabel = now.toLocaleDateString('en-NG', {
    month: 'long',
    year: 'numeric',
  });

  // EXPENSES FOR THE CURRENT MONTH
  const monthlyExpenseTransactions = transactions.filter(
    (item) =>
      item.type === 'expense' &&
      typeof item.createdAt === 'number' &&
      item.createdAt >= monthStart &&
      item.createdAt < nextMonthStart
  );

  const monthlyExpenses = monthlyExpenseTransactions.reduce(
    (total, item) => total + item.amount,
    0
  );

  // MONTHLY SPENDING BY CATEGORY
  const monthlyCategoryTotals = expenseCategories
    .map((expenseCategory) => {
      const categoryTotal = monthlyExpenseTransactions
        .filter((item) => item.category === expenseCategory)
        .reduce((total, item) => total + item.amount, 0);

      return {
        category: expenseCategory,
        amount: categoryTotal,
      };
    })
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  // EDIT A TRANSACTION
  const startEditing = (item: Transaction) => {
    setEditingTransactionId(item.id);
    setTitle(item.title);
    setAmount(String(item.amount));
    setTransactionType(item.type);
    setCategory(item.category);

    if (Platform.OS === 'web') {
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }
  };

  // ADD OR UPDATE A TRANSACTION
  const saveTransaction = async () => {
    const cleanTitle = title.trim();
    const cleanAmount = Number(amount.replace(/,/g, '').trim());
    const user = auth.currentUser;

    if (!user) {
      showMessage('Please log in before saving a transaction.');
      router.replace('/auth/login');
      return;
    }

    if (!cleanTitle || !amount.trim()) {
      showMessage('Please enter a description and amount.');
      return;
    }

    if (cleanTitle.length > 80) {
      showMessage('The description must be 80 characters or fewer.');
      return;
    }

    if (!Number.isFinite(cleanAmount) || cleanAmount <= 0) {
      showMessage('Enter a valid amount greater than zero.');
      return;
    }

    if (!category || !categories.includes(category)) {
      showMessage('Please choose a valid category.');
      return;
    }

    if (saving) return;

    setSaving(true);

    try {
      if (editingTransactionId) {
        const existingTransaction = transactions.find(
          (item) => item.id === editingTransactionId
        );

        if (!existingTransaction) {
          showMessage(
            'This transaction could not be found. Please try again.'
          );
          return;
        }

        await updateDoc(
          doc(
            db,
            'users',
            user.uid,
            'transactions',
            editingTransactionId
          ),
          {
            title: cleanTitle,
            amount: cleanAmount,
            type: transactionType,
            category,
            date: existingTransaction.date,
            // Do not update createdAt.
            // Firestore keeps the original timestamp unchanged.
          }
        );

        resetForm();
        showMessage('Transaction updated successfully!');
      } else {
        await addDoc(
          collection(db, 'users', user.uid, 'transactions'),
          {
            title: cleanTitle,
            amount: cleanAmount,
            type: transactionType,
            category,
            date: new Date().toLocaleDateString('en-NG'),
            // IMPORTANT: Firestore rules require a timestamp, not Date.now().
            createdAt: serverTimestamp(),
          }
        );

        resetForm();

        showMessage(
          transactionType === 'income'
            ? 'Income saved successfully!'
            : 'Expense saved successfully!'
        );
      }
    } catch (error) {
      const firebaseError = error as {
        code?: string;
        message?: string;
      };

      console.error('Error saving transaction:', error);

      showMessage(
        `Could not save transaction.\n\nError: ${
          firebaseError.code ?? 'unknown'
        }\n${
          firebaseError.message ?? 'Please check your connection and Firestore rules.'
        }`
      );
    } finally {
      setSaving(false);
    }
  };

  // DELETE A TRANSACTION
  const deleteTransaction = (transactionId: string) => {
    const user = auth.currentUser;

    if (!user) {
      showMessage('Please log in before deleting a transaction.');
      router.replace('/auth/login');
      return;
    }

    const performDelete = async () => {
      try {
        await deleteDoc(
          doc(
            db,
            'users',
            user.uid,
            'transactions',
            transactionId
          )
        );

        if (editingTransactionId === transactionId) {
          resetForm();
        }

        showMessage('Transaction deleted successfully!');
      } catch (error) {
        const firebaseError = error as {
          code?: string;
          message?: string;
        };

        console.error('Error deleting transaction:', error);

        showMessage(
          `Could not delete transaction.\n\nError: ${
            firebaseError.code ?? 'unknown'
          }\n${
            firebaseError.message ?? 'Check your connection and Firestore rules.'
          }`
        );
      }
    };

    if (Platform.OS === 'web') {
      if (
        window.confirm(
          'Are you sure you want to delete this transaction?'
        )
      ) {
        void performDelete();
      }

      return;
    }

    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this transaction?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void performDelete();
          },
        },
      ]
    );
  };

  // CHANGE TRANSACTION TYPE
  const changeType = (type: 'income' | 'expense') => {
    setTransactionType(type);
    setCategory(type === 'income' ? 'Salary' : 'Food');
  };

  // LOADING SCREEN
  if (!authChecked) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>
          Checking your account...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.logo}>BudgetWise</Text>

        <TouchableOpacity
          style={[
            styles.logoutButton,
            loggingOut && styles.logoutButtonDisabled,
          ]}
          onPress={handleLogout}
          activeOpacity={0.8}
          disabled={loggingOut}
        >
          <Text style={styles.logoutButtonText}>
            {loggingOut ? 'Logging out...' : 'Log Out'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.greeting}>Welcome back! 👋</Text>

      <Text style={styles.subtitle}>
        Here's your financial overview.
      </Text>

      {/* TOTAL BALANCE */}
      <View style={styles.balanceCard}>
        <Text style={styles.cardLabel}>Total Balance</Text>

        <Text style={styles.balance}>
          {formatMoney(balance, currency)}
        </Text>

        <Text style={styles.balanceNote}>
          Your money, under control.
        </Text>
      </View>

      {/* ALL-TIME TOTALS */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Income</Text>
          <Text style={styles.income}>
            {formatMoney(income, currency)}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Expenses</Text>
          <Text style={styles.expenses}>
            {formatMoney(expenses, currency)}
          </Text>
        </View>
      </View>

      {/* MONTHLY SPENDING SUMMARY */}
      <Text style={styles.sectionTitle}>Monthly Spending</Text>

      <View style={styles.monthlySummaryCard}>
        <Text style={styles.monthlyMonthLabel}>
          {monthLabel}
        </Text>

        <Text style={styles.monthlyTotal}>
          {formatMoney(monthlyExpenses, currency)}
        </Text>

        <Text style={styles.monthlyDescription}>
          Total expenses this month
        </Text>

        <View style={styles.monthlyDivider} />

        <Text style={styles.monthlyCategoryHeading}>
          Spending by category
        </Text>

        {monthlyCategoryTotals.length === 0 ? (
          <Text style={styles.monthlyEmptyText}>
            No expenses recorded this month yet.
          </Text>
        ) : (
          monthlyCategoryTotals.map((item) => {
            const percentage =
              monthlyExpenses > 0
                ? (item.amount / monthlyExpenses) * 100
                : 0;

            return (
              <View
                key={item.category}
                style={styles.monthlyCategoryItem}
              >
                <View style={styles.monthlyCategoryRow}>
                  <Text style={styles.monthlyCategoryName}>
                    {item.category}
                  </Text>

                  <Text style={styles.monthlyCategoryAmount}>
                    {formatMoney(item.amount, currency)}
                  </Text>
                </View>

                <View style={styles.monthlyProgressTrack}>
                  <View
                    style={[
                      styles.monthlyProgressFill,
                      { width: `${percentage}%` },
                    ]}
                  />
                </View>

                <Text style={styles.monthlyPercentage}>
                  {percentage.toFixed(1)}% of monthly expenses
                </Text>
              </View>
            );
          })
        )}
      </View>

      {/* ADD OR EDIT TRANSACTION */}
      <Text style={styles.sectionTitle}>
        {editingTransactionId
          ? 'Edit Transaction'
          : 'Add Transaction'}
      </Text>

      <View style={styles.formCard}>
        <Text style={styles.inputLabel}>Transaction type</Text>

        <View style={styles.typeRow}>
          <TouchableOpacity
            style={[
              styles.typeButton,
              transactionType === 'income' && styles.incomeSelected,
            ]}
            onPress={() => changeType('income')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.typeText,
                transactionType === 'income' && styles.selectedText,
              ]}
            >
              + Income
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.typeButton,
              transactionType === 'expense' && styles.expenseSelected,
            ]}
            onPress={() => changeType('expense')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.typeText,
                transactionType === 'expense' && styles.selectedText,
              ]}
            >
              − Expense
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.inputLabel}>Category</Text>

        <View style={styles.categoryRow}>
          {categories.map((item) => (
            <TouchableOpacity
              key={item}
              style={[
                styles.categoryButton,
                category === item && styles.categorySelected,
              ]}
              onPress={() => setCategory(item)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.categoryText,
                  category === item && styles.categorySelectedText,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.inputLabel}>Description</Text>

        <TextInput
          style={styles.input}
          placeholder="e.g. Monthly salary or lunch"
          placeholderTextColor="#89958F"
          value={title}
          onChangeText={setTitle}
          maxLength={80}
        />

        <Text style={styles.inputLabel}>Amount ({currency})</Text>

        <TextInput
          style={styles.input}
          placeholder="e.g. 5000"
          placeholderTextColor="#89958F"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />

        <TouchableOpacity
          style={[
            styles.addButton,
            saving && styles.addButtonDisabled,
          ]}
          onPress={saveTransaction}
          activeOpacity={0.8}
          disabled={saving}
        >
          <Text style={styles.addButtonText}>
            {saving
              ? 'Saving...'
              : editingTransactionId
                ? 'Save Changes'
                : 'Add Transaction'}
          </Text>
        </TouchableOpacity>

        {editingTransactionId && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={resetForm}
            activeOpacity={0.8}
            disabled={saving}
          >
            <Text style={styles.cancelButtonText}>
              Cancel Editing
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* RECENT TRANSACTIONS */}
      <Text style={styles.sectionTitle}>Recent Transactions</Text>

      {transactions.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            No transactions yet
          </Text>

          <Text style={styles.emptyText}>
            Add your first income or expense to see your
            financial summary update.
          </Text>
        </View>
      ) : (
        transactions.map((item) => (
          <View style={styles.transaction} key={item.id}>
            <View style={styles.transactionDetails}>
              <Text style={styles.transactionName}>
                {item.title}
              </Text>

              <Text style={styles.transactionDate}>
                {item.category} · {item.date}
              </Text>

              <Text style={styles.transactionType}>
                {item.type === 'income' ? 'Income' : 'Expense'}
              </Text>
            </View>

            <View style={styles.transactionActions}>
              <Text
                style={
                  item.type === 'income'
                    ? styles.income
                    : styles.expenses
                }
              >
                {item.type === 'income' ? '+' : '−'}
                {formatMoney(item.amount, currency)}
              </Text>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => startEditing(item)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteTransaction(item.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.deleteButtonText}>
                    Delete
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))
      )}

      <Text style={styles.footer}>
        BudgetWise · Your money. Your goals. Your future.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5FFF8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FFF8',
  },
  loadingText: {
    fontSize: 16,
    color: '#176B4D',
    fontWeight: '600',
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 28,
    gap: 12,
  },
  logo: {
    fontSize: 24,
    fontWeight: '800',
    color: '#176B4D',
    flexShrink: 1,
  },
  logoutButton: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  logoutButtonDisabled: {
    opacity: 0.6,
  },
  logoutButtonText: {
    color: '#B91C1C',
    fontSize: 14,
    fontWeight: '700',
  },
  greeting: {
    fontSize: 26,
    fontWeight: '800',
    color: '#17221D',
  },
  subtitle: {
    fontSize: 15,
    color: '#66736D',
    marginTop: 8,
    marginBottom: 24,
  },
  balanceCard: {
    backgroundColor: '#176B4D',
    padding: 24,
    borderRadius: 20,
    marginBottom: 20,
  },
  cardLabel: {
    color: '#E4EEE9',
    fontSize: 15,
  },
  balance: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    marginVertical: 12,
  },
  balanceNote: {
    color: '#E4EEE9',
    fontSize: 13,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 30,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E4EEE9',
  },
  summaryLabel: {
    color: '#66736D',
    fontSize: 13,
    marginBottom: 12,
  },
  income: {
    color: '#15803D',
    fontWeight: '700',
    fontSize: 15,
    flexShrink: 1,
  },
  expenses: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 15,
    flexShrink: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#17221D',
    marginBottom: 16,
  },
  monthlySummaryCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E4EEE9',
    marginBottom: 30,
  },
  monthlyMonthLabel: {
    color: '#66736D',
    fontSize: 14,
    fontWeight: '600',
  },
  monthlyTotal: {
    color: '#176B4D',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 8,
  },
  monthlyDescription: {
    color: '#66736D',
    fontSize: 13,
    marginTop: 4,
  },
  monthlyDivider: {
    height: 1,
    backgroundColor: '#E4EEE9',
    marginVertical: 20,
  },
  monthlyCategoryHeading: {
    color: '#17221D',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 16,
  },
  monthlyEmptyText: {
    color: '#66736D',
    fontSize: 14,
    lineHeight: 21,
  },
  monthlyCategoryItem: {
    marginBottom: 18,
  },
  monthlyCategoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  monthlyCategoryName: {
    color: '#34443B',
    fontSize: 14,
    fontWeight: '600',
  },
  monthlyCategoryAmount: {
    color: '#17221D',
    fontSize: 14,
    fontWeight: '700',
  },
  monthlyProgressTrack: {
    height: 8,
    backgroundColor: '#E4EEE9',
    borderRadius: 8,
    overflow: 'hidden',
  },
  monthlyProgressFill: {
    height: 8,
    backgroundColor: '#176B4D',
    borderRadius: 8,
  },
  monthlyPercentage: {
    color: '#66736D',
    fontSize: 11,
    marginTop: 6,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E4EEE9',
    marginBottom: 30,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#34443B',
    marginBottom: 9,
    marginTop: 12,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE8E0',
    alignItems: 'center',
    backgroundColor: '#F8FBF9',
  },
  incomeSelected: {
    backgroundColor: '#15803D',
    borderColor: '#15803D',
  },
  expenseSelected: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  typeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#34443B',
  },
  selectedText: {
    color: '#FFFFFF',
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DCE8E0',
    backgroundColor: '#F8FBF9',
  },
  categorySelected: {
    backgroundColor: '#DDF5E6',
    borderColor: '#176B4D',
  },
  categoryText: {
    color: '#34443B',
    fontSize: 13,
    fontWeight: '600',
  },
  categorySelectedText: {
    color: '#176B4D',
    fontWeight: '800',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DCE8E0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#17221D',
    backgroundColor: '#FFFFFF',
  },
  addButton: {
    backgroundColor: '#176B4D',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 22,
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  cancelButtonText: {
    color: '#34443B',
    fontSize: 15,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 22,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E4EEE9',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#17221D',
    marginBottom: 8,
  },
  emptyText: {
    color: '#66736D',
    textAlign: 'center',
    lineHeight: 21,
  },
  transaction: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionActions: {
    alignItems: 'flex-end',
    gap: 10,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editButton: {
    backgroundColor: '#DDF5E6',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  editButtonText: {
    color: '#176B4D',
    fontSize: 12,
    fontWeight: '700',
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  deleteButtonText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '700',
  },
  transactionName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#17221D',
  },
  transactionDate: {
    color: '#66736D',
    fontSize: 12,
    marginTop: 5,
  },
  transactionType: {
    color: '#66736D',
    fontSize: 12,
    marginTop: 4,
  },
  footer: {
    color: '#66736D',
    textAlign: 'center',
    fontSize: 12,
    marginTop: 24,
  },
});
