
import { router } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    serverTimestamp,
    updateDoc,
} from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
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

type TransactionType = 'income' | 'expense';

type Transaction = {
  id: string;
  title: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string;
  createdAt?: { toMillis?: () => number } | null;
};

const CATEGORIES = [
  'Salary',
  'Business',
  'Freelance',
  'Gift',
  'Food',
  'Transport',
  'Shopping',
  'Bills',
  'Entertainment',
  'Health',
  'Other',
];

const formatMoney = (amount: number) =>
  '₦' +
  amount.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function TransactionsScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [type, setType] = useState<TransactionType>('expense');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [filter, setFilter] = useState<'all' | TransactionType>('all');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<Transaction | null>(null);

  // Check the signed-in user.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid ?? null);
      setAuthReady(true);

      if (!user) {
        router.replace('/auth/login');
      }
    });

    return unsubscribe;
  }, []);

  // Listen for this user's transactions in Firestore.
  useEffect(() => {
    if (!authReady || !userId) {
      if (authReady && !userId) setLoading(false);
      return;
    }

    setLoading(true);

    const transactionsRef = collection(
      db,
      'users',
      userId,
      'transactions'
    );

    const unsubscribe = onSnapshot(
      transactionsRef,
      (snapshot) => {
        const records: Transaction[] = snapshot.docs.map((document) => {
          const data = document.data();

          return {
            id: document.id,
            title:
              typeof data.title === 'string'
                ? data.title
                : 'Transaction',
            amount:
              typeof data.amount === 'number' ? data.amount : 0,
            type: data.type === 'income' ? 'income' : 'expense',
            category:
              typeof data.category === 'string'
                ? data.category
                : 'Other',
            date: typeof data.date === 'string' ? data.date : '',
            createdAt: data.createdAt ?? null,
          };
        });

        records.sort((a, b) => {
          const timeA = a.createdAt?.toMillis?.() ?? 0;
          const timeB = b.createdAt?.toMillis?.() ?? 0;

          if (timeA !== timeB) return timeB - timeA;
          return b.date.localeCompare(a.date);
        });

        setTransactions(records);
        setLoading(false);
      },
      (error) => {
        console.error('Transactions loading error:', error);
        setLoading(false);
        Alert.alert(
          'Unable to load transactions',
          'Check your internet connection and Firestore permissions.'
        );
      }
    );

    return unsubscribe;
  }, [authReady, userId]);

  // Calculate totals from the live transaction list.
  const totals = useMemo(() => {
    return transactions.reduce(
      (result, transaction) => {
        if (transaction.type === 'income') {
          result.income += transaction.amount;
        } else {
          result.expenses += transaction.amount;
        }

        return result;
      },
      { income: 0, expenses: 0 }
    );
  }, [transactions]);

  const visibleTransactions = useMemo(() => {
    if (filter === 'all') return transactions;

    return transactions.filter((item) => item.type === filter);
  }, [transactions, filter]);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setAmount('');
    setType('expense');
    setCategory('Food');
  };

  // Put an existing transaction into the form for editing.
  const startEditing = (item: Transaction) => {
    setEditingId(item.id);
    setTitle(item.title);
    setAmount(String(item.amount));
    setType(item.type);
    setCategory(item.category);
  };

  // Save a new transaction or update an existing one.
  const handleSaveTransaction = async () => {
    const cleanTitle = title.trim();
    const cleanAmount = Number(amount.replace(/,/g, '').trim());

    if (!cleanTitle) {
      Alert.alert(
        'Missing description',
        'Please enter a transaction description.'
      );
      return;
    }

    if (cleanTitle.length > 80) {
      Alert.alert(
        'Description too long',
        'Keep the description to 80 characters or fewer.'
      );
      return;
    }

    if (
      !amount.trim() ||
      !Number.isFinite(cleanAmount) ||
      cleanAmount <= 0
    ) {
      Alert.alert(
        'Invalid amount',
        'Enter an amount greater than zero.'
      );
      return;
    }

    const currentUser = auth.currentUser;

    if (!currentUser || currentUser.uid !== userId) {
      Alert.alert(
        'Sign in required',
        'Please sign in again before saving.'
      );
      router.replace('/auth/login');
      return;
    }

    if (!CATEGORIES.includes(category)) {
      Alert.alert('Invalid category', 'Please choose a valid category.');
      return;
    }

    setSaving(true);

    try {
      const transactionData = {
        title: cleanTitle,
        amount: cleanAmount,
        type,
        category,
        date: new Date().toISOString(),
      };

      if (editingId) {
        // Update only this user's selected transaction.
        // Do not change its original createdAt timestamp.
        await updateDoc(
          doc(
            db,
            'users',
            currentUser.uid,
            'transactions',
            editingId
          ),
          transactionData
        );

        Alert.alert('Updated', 'Your transaction has been updated.');
      } else {
        await addDoc(
          collection(
            db,
            'users',
            currentUser.uid,
            'transactions'
          ),
          {
            ...transactionData,
            createdAt: serverTimestamp(),
          }
        );

        Alert.alert('Success', 'Your transaction has been saved.');
      }

      resetForm();
    } catch (error) {
      console.error('Saving transaction error:', error);

      Alert.alert(
        'Could not save',
        'The transaction was not saved. Check your internet connection and Firestore permissions.'
      );
    } finally {
      setSaving(false);
    }
  };

  // Delete only after the user confirms.
  const confirmDeleteTransaction = async () => {
    if (!deleteTarget || !userId) return;

    const currentUser = auth.currentUser;

    if (!currentUser || currentUser.uid !== userId) {
      setDeleteTarget(null);
      Alert.alert(
        'Sign in required',
        'Please sign in again before deleting.'
      );
      router.replace('/auth/login');
      return;
    }

    const itemToDelete = deleteTarget;

    setDeleting(true);

    try {
      await deleteDoc(
        doc(
          db,
          'users',
          currentUser.uid,
          'transactions',
          itemToDelete.id
        )
      );

      if (editingId === itemToDelete.id) {
        resetForm();
      }

      setDeleteTarget(null);
      Alert.alert('Deleted', 'The transaction has been deleted.');
    } catch (error) {
      console.error('Deleting transaction error:', error);

      Alert.alert(
        'Could not delete',
        'The transaction was not deleted. Check your internet connection and Firestore permissions.'
      );
    } finally {
      setDeleting(false);
    }
  };

  if (!authReady || !userId) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#16A34A" />
        <Text style={styles.loadingText}>
          Checking your account...
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>
              YOUR MONEY, YOUR CONTROL
            </Text>
            <Text style={styles.heading}>Transactions</Text>
            <Text style={styles.subtitle}>
              Track where your money comes from and goes.
            </Text>
          </View>

          <View style={styles.headerIcon}>
            <Text style={styles.headerEmoji}>💳</Text>
          </View>
        </View>

        {/* Financial summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>
            Income minus expenses
          </Text>

          <Text style={styles.balance}>
            {formatMoney(totals.income - totals.expenses)}
          </Text>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <View style={styles.summaryColumn}>
              <Text style={styles.smallLabel}>Total income</Text>
              <Text style={styles.incomeAmount}>
                {formatMoney(totals.income)}
              </Text>
            </View>

            <View style={styles.summaryColumn}>
              <Text style={styles.smallLabel}>Total expenses</Text>
              <Text style={styles.expenseAmount}>
                {formatMoney(totals.expenses)}
              </Text>
            </View>
          </View>
        </View>

        {/* Add or edit form */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {editingId ? 'Edit transaction' : 'Add transaction'}
          </Text>

          {editingId && (
            <View style={styles.editNotice}>
              <Text style={styles.editNoticeText}>
                You are editing an existing transaction.
              </Text>

              <TouchableOpacity onPress={resetForm}>
                <Text style={styles.cancelEditText}>Cancel edit</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.label}>Transaction type</Text>

          <View style={styles.typeRow}>
            <TouchableOpacity
              style={[
                styles.typeButton,
                type === 'income' && styles.incomeSelected,
              ]}
              onPress={() => {
                setType('income');
                if (!CATEGORIES.includes(category) ||
                    !['Salary', 'Business', 'Freelance', 'Gift'].includes(category)) {
                  setCategory('Salary');
                }
              }}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  type === 'income' && styles.selectedText,
                ]}
              >
                + Income
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeButton,
                type === 'expense' && styles.expenseSelected,
              ]}
              onPress={() => {
                setType('expense');
                if (['Salary', 'Business', 'Freelance', 'Gift'].includes(category)) {
                  setCategory('Food');
                }
              }}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  type === 'expense' && styles.selectedText,
                ]}
              >
                − Expense
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Description</Text>

          <TextInput
            style={styles.input}
            placeholder="e.g. Monthly salary or groceries"
            placeholderTextColor="#94A3B8"
            value={title}
            onChangeText={setTitle}
            maxLength={80}
            returnKeyType="next"
          />

          <Text style={styles.label}>Amount (₦)</Text>

          <TextInput
            style={styles.input}
            placeholder="Enter amount"
            placeholderTextColor="#94A3B8"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>Category</Text>

          <View style={styles.categoryWrap}>
            {CATEGORIES.map((item) => (
              <TouchableOpacity
                key={item}
                style={[
                  styles.categoryChip,
                  category === item && styles.categorySelected,
                ]}
                onPress={() => setCategory(item)}
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

          <TouchableOpacity
            style={[
              styles.saveButton,
              saving && styles.disabledButton,
            ]}
            onPress={handleSaveTransaction}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>
                {editingId ? 'Save changes' : 'Save transaction'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Transaction history */}
        <View style={styles.historyHeader}>
          <View>
            <Text style={styles.sectionTitle}>
              Transaction history
            </Text>
            <Text style={styles.historySubtitle}>
              {transactions.length}{' '}
              {transactions.length === 1 ? 'record' : 'records'}
            </Text>
          </View>
        </View>

        {/* Filters */}
        <View style={styles.filterRow}>
          {(['all', 'income', 'expense'] as const).map((item) => (
            <TouchableOpacity
              key={item}
              style={[
                styles.filterButton,
                filter === item && styles.filterSelected,
              ]}
              onPress={() => setFilter(item)}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === item && styles.filterSelectedText,
                ]}
              >
                {item === 'all'
                  ? 'All'
                  : item === 'income'
                    ? 'Income'
                    : 'Expenses'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.emptyBox}>
            <ActivityIndicator size="large" color="#16A34A" />
            <Text style={styles.emptyText}>
              Loading transactions...
            </Text>
          </View>
        ) : visibleTransactions.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>🧾</Text>
            <Text style={styles.emptyTitle}>
              No transactions yet
            </Text>
            <Text style={styles.emptyText}>
              Add your first{' '}
              {filter === 'all' ? 'income or expense' : filter}
              {' '}using the form above.
            </Text>
          </View>
        ) : (
          visibleTransactions.map((item) => (
            <View key={item.id} style={styles.transactionRow}>
              <View
                style={[
                  styles.transactionIcon,
                  item.type === 'income'
                    ? styles.incomeIcon
                    : styles.expenseIcon,
                ]}
              >
                <Text style={styles.transactionEmoji}>
                  {item.type === 'income' ? '↙' : '↗'}
                </Text>
              </View>

              <View style={styles.transactionDetails}>
                <Text
                  style={styles.transactionTitle}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>

                <Text style={styles.transactionMeta}>
                  {item.category} ·{' '}
                  {item.date
                    ? new Date(item.date).toLocaleDateString('en-NG', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'Date unavailable'}
                </Text>
              </View>

              <View style={styles.transactionRight}>
                <Text
                  style={[
                    styles.transactionAmount,
                    item.type === 'income'
                      ? styles.incomeAmount
                      : styles.expenseAmount,
                  ]}
                >
                  {item.type === 'income' ? '+' : '−'}
                  {formatMoney(item.amount)}
                </Text>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => startEditing(item)}
                    accessibilityLabel={`Edit ${item.title}`}
                  >
                    <Text style={styles.editButtonText}>Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => setDeleteTarget(item)}
                    accessibilityLabel={`Delete ${item.title}`}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}

        <Text style={styles.footer}>
          BudgetWise · Make every naira count.
        </Text>
      </ScrollView>

      {/* Custom confirmation dialog works on web and mobile. */}
      <Modal
        visible={deleteTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Delete transaction?
            </Text>

            <Text style={styles.modalMessage}>
              {deleteTarget
                ? `Are you sure you want to delete "${deleteTarget.title}" (${formatMoney(deleteTarget.amount)})? This cannot be undone.`
                : ''}
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                disabled={deleting}
                onPress={() => setDeleteTarget(null)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmDeleteButton,
                  deleting && styles.disabledButton,
                ]}
                disabled={deleting}
                onPress={confirmDeleteTransaction}
              >
                {deleting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmDeleteText}>
                    Delete
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F8F6',
  },
  content: {
    padding: 20,
    paddingTop: 28,
    paddingBottom: 48,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F8F6',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: '#16A34A',
    marginBottom: 7,
  },
  heading: {
    fontSize: 30,
    fontWeight: '800',
    color: '#123126',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: '#64748B',
    marginTop: 6,
    maxWidth: 300,
  },
  headerIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerEmoji: {
    fontSize: 27,
  },
  summaryCard: {
    backgroundColor: '#14532D',
    borderRadius: 22,
    padding: 22,
    marginBottom: 22,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#D1FAE5',
  },
  balance: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 8,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#36734D',
    marginVertical: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 18,
  },
  summaryColumn: {
    flex: 1,
  },
  smallLabel: {
    color: '#D1FAE5',
    fontSize: 12,
    marginBottom: 7,
  },
  incomeAmount: {
    color: '#16A34A',
    fontWeight: '800',
  },
  expenseAmount: {
    color: '#DC2626',
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 26,
    borderWidth: 1,
    borderColor: '#E5EDE7',
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#123126',
  },
  editNotice: {
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 12,
    marginTop: 14,
    gap: 8,
  },
  editNoticeText: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '600',
  },
  cancelEditText: {
    color: '#1D4ED8',
    fontWeight: '800',
    fontSize: 13,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginTop: 18,
    marginBottom: 9,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  incomeSelected: {
    backgroundColor: '#DCFCE7',
    borderColor: '#16A34A',
  },
  expenseSelected: {
    backgroundColor: '#FEE2E2',
    borderColor: '#DC2626',
  },
  typeButtonText: {
    color: '#475569',
    fontWeight: '700',
  },
  selectedText: {
    color: '#123126',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#0F172A',
  },
  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  categorySelected: {
    backgroundColor: '#DCFCE7',
    borderColor: '#16A34A',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  categorySelectedText: {
    color: '#166534',
  },
  saveButton: {
    backgroundColor: '#16A34A',
    borderRadius: 13,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  historySubtitle: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 5,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 9,
    marginBottom: 14,
  },
  filterButton: {
    paddingHorizontal: 17,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterSelected: {
    backgroundColor: '#14532D',
    borderColor: '#14532D',
  },
  filterText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  filterSelectedText: {
    color: '#FFFFFF',
  },
  emptyBox: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5EDE7',
    padding: 30,
  },
  emptyEmoji: {
    fontSize: 34,
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#123126',
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    marginBottom: 10,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5EDE7',
  },
  transactionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  incomeIcon: {
    backgroundColor: '#DCFCE7',
  },
  expenseIcon: {
    backgroundColor: '#FEE2E2',
  },
  transactionEmoji: {
    fontSize: 22,
    color: '#123126',
    fontWeight: '800',
  },
  transactionDetails: {
    flex: 1,
    minWidth: 0,
  },
  transactionTitle: {
    color: '#123126',
    fontWeight: '700',
    fontSize: 14,
  },
  transactionMeta: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 5,
  },
  transactionRight: {
    alignItems: 'flex-end',
    gap: 8,
    maxWidth: '48%',
  },
  transactionAmount: {
    fontSize: 12,
    fontWeight: '800',
    flexShrink: 0,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  editButton: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  editButtonText: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '800',
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  deleteButtonText: {
    color: '#B91C1C',
    fontSize: 11,
    fontWeight: '800',
  },
  footer: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 28,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 22,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
  },
  modalTitle: {
    color: '#123126',
    fontSize: 21,
    fontWeight: '800',
  },
  modalMessage: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 24,
  },
  cancelButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  cancelButtonText: {
    color: '#334155',
    fontWeight: '700',
  },
  confirmDeleteButton: {
    minWidth: 90,
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#DC2626',
  },
  confirmDeleteText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
