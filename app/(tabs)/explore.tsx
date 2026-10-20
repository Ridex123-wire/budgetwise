
import { router, useFocusEffect } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
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
  title?: string;
  amount: number;
  type: 'income' | 'expense';
  category?: string;
  date?: unknown;
  createdAt?: unknown;
};

function getTransactionDate(transaction: Transaction): Date | null {
  const parseValue = (value: unknown): Date | null => {
    if (!value) return null;

    if (
      typeof value === 'object' &&
      value !== null &&
      'toDate' in value &&
      typeof value.toDate === 'function'
    ) {
      const result = value.toDate();
      return result instanceof Date && !Number.isNaN(result.getTime())
        ? result
        : null;
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === 'number') {
      const milliseconds = value < 100000000000 ? value * 1000 : value;
      const result = new Date(milliseconds);
      return Number.isNaN(result.getTime()) ? null : result;
    }

    if (typeof value === 'string') {
      const text = value.trim();

      // Supports dates such as 20/10/2026.
      const dayFirst = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (dayFirst) {
        const day = Number(dayFirst[1]);
        const month = Number(dayFirst[2]);
        const year = Number(dayFirst[3]);
        const result = new Date(year, month - 1, day);

        if (
          result.getFullYear() === year &&
          result.getMonth() === month - 1 &&
          result.getDate() === day
        ) {
          return result;
        }

        return null;
      }

      // Treat YYYY-MM-DD as a local calendar date.
      const yearFirst = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (yearFirst) {
        const year = Number(yearFirst[1]);
        const month = Number(yearFirst[2]);
        const day = Number(yearFirst[3]);
        const result = new Date(year, month - 1, day);

        if (
          result.getFullYear() === year &&
          result.getMonth() === month - 1 &&
          result.getDate() === day
        ) {
          return result;
        }

        return null;
      }

      const result = new Date(text);
      return Number.isNaN(result.getTime()) ? null : result;
    }

    return null;
  };

  return (
    parseValue(transaction.date) ??
    parseValue(transaction.createdAt)
  );
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function sameMonth(first: Date, second: Date): boolean {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth()
  );
}

export default function ExploreScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<Date>(
    () => getMonthStart(new Date()),
  );
  const [currency, setCurrency] = useState<CurrencyCode>('NGN');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  // Reload the user's preferred currency whenever this screen receives focus.
  useFocusEffect(
    useCallback(() => {
      let active = true;

      getPreferredCurrency()
        .then((preferredCurrency) => {
          if (active && preferredCurrency) {
            setCurrency(preferredCurrency as CurrencyCode);
          }
        })
        .catch((err) => {
          console.warn('Could not load preferred currency:', err);
        });

      return () => {
        active = false;
      };
    }, []),
  );

  // Subscribe to the signed-in user's transactions.
  // Changing retryKey creates a fresh subscription when the user retries.
  useEffect(() => {
    let unsubscribeTransactions: (() => void) | undefined;
    let active = true;

    setLoading(true);
    setError('');

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeTransactions?.();
      unsubscribeTransactions = undefined;

      if (!active) return;

      if (!user) {
        setTransactions([]);
        setLoading(false);
        router.replace('/auth/login');
        return;
      }

      setLoading(true);
      setError('');

      const transactionsRef = collection(
        db,
        'users',
        user.uid,
        'transactions',
      );

      unsubscribeTransactions = onSnapshot(
        transactionsRef,
        (snapshot) => {
          if (!active) return;

          const loadedTransactions: Transaction[] = snapshot.docs.map(
            (document) => {
              const data = document.data();

              return {
                id: document.id,
                title:
                  typeof data.title === 'string' ? data.title : 'Transaction',
                amount: Number(data.amount) || 0,
                type: data.type === 'income' ? 'income' : 'expense',
                category:
                  typeof data.category === 'string'
                    ? data.category
                    : 'Other',
                date: data.date,
                createdAt: data.createdAt,
              };
            },
          );

          setTransactions(loadedTransactions);
          setLoading(false);
          setError('');
        },
        (snapshotError) => {
          if (!active) return;

          console.error('Explore transaction listener failed:', snapshotError);
          setError(
            'We could not load your transactions. Check your internet connection and try again.',
          );
          setLoading(false);
        },
      );
    });

    return () => {
      active = false;
      unsubscribeAuth();
      unsubscribeTransactions?.();
    };
  }, [retryKey]);

  const currentMonth = useMemo(
    () => getMonthStart(new Date()),
    [],
  );

  const isCurrentMonth = sameMonth(selectedMonth, currentMonth);

  const canGoNext = selectedMonth < currentMonth;

  const monthLabel = selectedMonth.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });

  const monthTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const date = getTransactionDate(transaction);
      if (!date) return false;

      return (
        date.getFullYear() === selectedMonth.getFullYear() &&
        date.getMonth() === selectedMonth.getMonth()
      );
    });
  }, [transactions, selectedMonth]);

  const income = useMemo(
    () =>
      monthTransactions.reduce(
        (total, transaction) =>
          transaction.type === 'income'
            ? total + transaction.amount
            : total,
        0,
      ),
    [monthTransactions],
  );

  const expenses = useMemo(
    () =>
      monthTransactions.reduce(
        (total, transaction) =>
          transaction.type === 'expense'
            ? total + transaction.amount
            : total,
        0,
      ),
    [monthTransactions],
  );

  const netCashFlow = income - expenses;

  const savingsRate =
    income > 0 ? ((income - expenses) / income) * 100 : null;

  const expenseTransactions = useMemo(
    () =>
      monthTransactions.filter(
        (transaction) => transaction.type === 'expense',
      ),
    [monthTransactions],
  );

  const categoryBreakdown = useMemo(() => {
    const totals: Record<string, number> = {};

    expenseTransactions.forEach((transaction) => {
      const category = transaction.category || 'Other';
      totals[category] = (totals[category] || 0) + transaction.amount;
    });

    return Object.entries(totals)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenseTransactions]);

  const highestCategory = categoryBreakdown[0];

  const formatCurrency = useCallback(
    (amount: number) => formatMoney(amount, currency),
    [currency],
  );

  const changeMonth = (direction: -1 | 1) => {
    setSelectedMonth((previousMonth) => {
      const next = new Date(
        previousMonth.getFullYear(),
        previousMonth.getMonth() + direction,
        1,
      );

      // Do not allow the report to move into a future month.
      if (next > currentMonth) return previousMonth;

      return next;
    });
  };

  const retryLoading = () => {
    setError('');
    setLoading(true);
    setRetryKey((previous) => previous + 1);
  };

  const insight = useMemo(() => {
    if (monthTransactions.length === 0) {
      return {
        title: 'Your month starts here',
        message:
          'No transactions were found for this month. Add your income and expenses to see your financial insights.',
      };
    }

    if (income === 0 && expenses > 0) {
      return {
        title: 'Expenses recorded',
        message: `You recorded ${formatCurrency(expenses)} in expenses this month but no income. Add any missing income transactions for a more complete picture.`,
      };
    }

    if (income > 0 && expenses === 0) {
      return {
        title: 'Great start!',
        message: `You recorded ${formatCurrency(income)} in income and no expenses this month. Keep tracking your spending to maintain an accurate report.`,
      };
    }

    if (netCashFlow < 0) {
      return {
        title: 'Spending is above income',
        message: `Your expenses exceed your income by ${formatCurrency(
          Math.abs(netCashFlow),
        )}. Review your spending categories to find areas where you can cut back.`,
      };
    }

    if (netCashFlow === 0) {
      return {
        title: 'You broke even',
        message:
          'Your recorded income and expenses are equal this month. Consider setting aside some money for your savings goals.',
      };
    }

    if (highestCategory) {
      return {
        title: 'Your biggest spending category',
        message: `${highestCategory.category} is your highest expense category at ${formatCurrency(
          highestCategory.amount,
        )}. Reviewing this category may help you find opportunities to save.`,
      };
    }

    return {
      title: 'You are making progress',
      message:
        'Keep recording your transactions to get a clearer view of your money.',
    };
  }, [
    monthTransactions.length,
    income,
    expenses,
    netCashFlow,
    highestCategory,
    formatCurrency,
  ]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#16A34A" />
        <Text style={styles.loadingText}>Loading your financial insights...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorEmoji}>⚠️</Text>
        <Text style={styles.errorTitle}>Unable to load insights</Text>
        <Text style={styles.errorMessage}>{error}</Text>

        <TouchableOpacity
          style={styles.retryButton}
          onPress={retryLoading}
          activeOpacity={0.8}
        >
          <Text style={styles.retryButtonText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>BUDGETWISE</Text>
        <Text style={styles.title}>Financial Insights</Text>
        <Text style={styles.subtitle}>
          Understand your money. Make better decisions.
        </Text>
      </View>

      <View style={styles.monthSelector}>
        <TouchableOpacity
          style={styles.monthArrow}
          onPress={() => changeMonth(-1)}
          accessibilityLabel="Previous month"
          activeOpacity={0.7}
        >
          <Text style={styles.monthArrowText}>‹</Text>
        </TouchableOpacity>

        <View style={styles.monthCenter}>
          <Text style={styles.monthLabel}>{monthLabel}</Text>
          {!isCurrentMonth && (
            <TouchableOpacity
              onPress={() => setSelectedMonth(currentMonth)}
              activeOpacity={0.7}
            >
              <Text style={styles.currentMonthLink}>Back to this month</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.monthArrow,
            !canGoNext && styles.monthArrowDisabled,
          ]}
          onPress={() => changeMonth(1)}
          disabled={!canGoNext}
          accessibilityLabel="Next month"
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.monthArrowText,
              !canGoNext && styles.monthArrowTextDisabled,
            ]}
          >
            ›
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.netCard}>
        <Text style={styles.cardEyebrow}>NET CASH FLOW</Text>
        <Text
          style={[
            styles.netAmount,
            netCashFlow < 0 && styles.negativeAmount,
          ]}
        >
          {netCashFlow < 0 ? '−' : ''}
          {formatCurrency(Math.abs(netCashFlow))}
        </Text>
        <Text style={styles.netCaption}>
          {netCashFlow > 0
            ? 'You have more income than expenses'
            : netCashFlow < 0
              ? 'Your expenses are higher than your income'
              : 'Your income and expenses are balanced'}
        </Text>
      </View>

      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, styles.incomeCard]}>
          <View style={styles.summaryIconCircle}>
            <Text style={styles.incomeIcon}>↗</Text>
          </View>
          <Text style={styles.summaryLabel}>Income</Text>
          <Text style={styles.incomeAmount} numberOfLines={2}>
            {formatCurrency(income)}
          </Text>
        </View>

        <View style={[styles.summaryCard, styles.expenseCard]}>
          <View style={styles.summaryIconCircle}>
            <Text style={styles.expenseIcon}>↘</Text>
          </View>
          <Text style={styles.summaryLabel}>Expenses</Text>
          <Text style={styles.expenseAmount} numberOfLines={2}>
            {formatCurrency(expenses)}
          </Text>
        </View>
      </View>

      <View style={styles.savingsRateCard}>
        <View style={styles.savingsRateTop}>
          <View style={styles.savingsRateIcon}>
            <Text style={styles.savingsRateIconText}>%</Text>
          </View>
          <View style={styles.savingsRateTextContainer}>
            <Text style={styles.sectionTitle}>Savings rate</Text>
            <Text style={styles.savingsRateCaption}>
              Income remaining after expenses
            </Text>
          </View>
          <Text
            style={[
              styles.savingsRateValue,
              savingsRate !== null &&
                savingsRate < 0 &&
                styles.negativeRate,
            ]}
          >
            {savingsRate === null ? '—' : `${savingsRate.toFixed(1)}%`}
          </Text>
        </View>

        {savingsRate === null ? (
          <Text style={styles.savingsRateHint}>
            Record income to calculate your savings rate.
          </Text>
        ) : savingsRate < 0 ? (
          <Text style={styles.savingsRateHint}>
            You spent more than you earned this month.
          </Text>
        ) : (
          <View style={styles.rateTrack}>
            <View
              style={[
                styles.rateFill,
                { width: `${Math.min(savingsRate, 100)}%` },
              ]}
            />
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeadingRow}>
          <Text style={styles.sectionTitle}>Spending by category</Text>
          <Text style={styles.sectionCaption}>
            {expenseTransactions.length} expense
            {expenseTransactions.length === 1 ? '' : 's'}
          </Text>
        </View>

        {categoryBreakdown.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>📊</Text>
            <Text style={styles.emptyTitle}>No expenses yet</Text>
            <Text style={styles.emptyMessage}>
              Your spending breakdown will appear here when you record expenses
              for this month.
            </Text>
          </View>
        ) : (
          <View style={styles.categoryCard}>
            {categoryBreakdown.map((item, index) => {
              const percentage =
                expenses > 0 ? (item.amount / expenses) * 100 : 0;

              return (
                <View
                  key={item.category}
                  style={[
                    styles.categoryItem,
                    index === categoryBreakdown.length - 1 &&
                      styles.categoryItemLast,
                  ]}
                >
                  <View style={styles.categoryTopRow}>
                    <View style={styles.categoryNameContainer}>
                      <View style={styles.categoryDot} />
                      <Text style={styles.categoryName} numberOfLines={1}>
                        {item.category}
                      </Text>
                    </View>
                    <View style={styles.categoryAmountContainer}>
                      <Text style={styles.categoryAmount}>
                        {formatCurrency(item.amount)}
                      </Text>
                      <Text style={styles.categoryPercentage}>
                        {percentage.toFixed(1)}%
                      </Text>
                    </View>
                  </View>

                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${Math.min(percentage, 100)}%` },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Monthly insight</Text>
        <View style={styles.insightCard}>
          <View style={styles.insightIconCircle}>
            <Text style={styles.insightIcon}>✦</Text>
          </View>
          <View style={styles.insightContent}>
            <Text style={styles.insightTitle}>{insight.title}</Text>
            <Text style={styles.insightMessage}>{insight.message}</Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Reports use the dates saved with your transactions. Your selected
          currency changes how amounts are displayed; it does not convert
          transactions using exchange rates.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F8F7',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    minHeight: 350,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6F8F7',
    padding: 24,
  },
  loadingText: {
    marginTop: 14,
    color: '#64748B',
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    minHeight: 350,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6F8F7',
    padding: 24,
  },
  errorEmoji: {
    fontSize: 38,
    marginBottom: 12,
  },
  errorTitle: {
    color: '#172B23',
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
  },
  errorMessage: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 10,
    maxWidth: 360,
  },
  retryButton: {
    backgroundColor: '#15803D',
    paddingVertical: 13,
    paddingHorizontal: 30,
    borderRadius: 12,
    marginTop: 22,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  header: {
    marginBottom: 24,
  },
  eyebrow: {
    color: '#16A34A',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 8,
  },
  title: {
    color: '#14251D',
    fontSize: 29,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 7,
    lineHeight: 21,
  },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E8EEEA',
  },
  monthArrow: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F7F2',
  },
  monthArrowDisabled: {
    backgroundColor: '#F6F8F7',
  },
  monthArrowText: {
    color: '#166534',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '500',
  },
  monthArrowTextDisabled: {
    color: '#CBD5D0',
  },
  monthCenter: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 5,
  },
  monthLabel: {
    color: '#172B23',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  currentMonthLink: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 5,
  },
  netCard: {
    backgroundColor: '#176B4D',
    borderRadius: 22,
    padding: 23,
    marginBottom: 16,
  },
  cardEyebrow: {
    color: '#D1FAE5',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  netAmount: {
    color: '#FFFFFF',
    fontSize: 31,
    fontWeight: '900',
    marginTop: 13,
    letterSpacing: -0.6,
  },
  negativeAmount: {
    color: '#FECACA',
  },
  netCaption: {
    color: '#D1FAE5',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  summaryCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8EEEA',
  },
  incomeCard: {
    borderBottomWidth: 3,
    borderBottomColor: '#16A34A',
  },
  expenseCard: {
    borderBottomWidth: 3,
    borderBottomColor: '#F87171',
  },
  summaryIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#F0F7F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 13,
  },
  incomeIcon: {
    color: '#15803D',
    fontSize: 21,
    fontWeight: '900',
  },
  expenseIcon: {
    color: '#DC2626',
    fontSize: 21,
    fontWeight: '900',
  },
  summaryLabel: {
    color: '#64748B',
    fontSize: 13,
    marginBottom: 7,
  },
  incomeAmount: {
    color: '#15803D',
    fontSize: 19,
    fontWeight: '900',
  },
  expenseAmount: {
    color: '#DC2626',
    fontSize: 19,
    fontWeight: '900',
  },
  savingsRateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#E8EEEA',
  },
  savingsRateTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  savingsRateIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  savingsRateIconText: {
    color: '#15803D',
    fontSize: 20,
    fontWeight: '900',
  },
  savingsRateTextContainer: {
    flex: 1,
  },
  sectionTitle: {
    color: '#172B23',
    fontSize: 17,
    fontWeight: '900',
  },
  savingsRateCaption: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },
  savingsRateValue: {
    color: '#15803D',
    fontSize: 21,
    fontWeight: '900',
    marginLeft: 8,
  },
  negativeRate: {
    color: '#DC2626',
  },
  savingsRateHint: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 13,
  },
  rateTrack: {
    height: 8,
    backgroundColor: '#E8F2EB',
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 16,
  },
  rateFill: {
    height: '100%',
    backgroundColor: '#16A34A',
    borderRadius: 20,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  sectionCaption: {
    color: '#64748B',
    fontSize: 12,
  },
  categoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 17,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E8EEEA',
  },
  categoryItem: {
    paddingVertical: 17,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2EF',
  },
  categoryItemLast: {
    borderBottomWidth: 0,
  },
  categoryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 11,
  },
  categoryNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  categoryDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#16A34A',
    marginRight: 9,
  },
  categoryName: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  categoryAmountContainer: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  categoryAmount: {
    color: '#172B23',
    fontSize: 13,
    fontWeight: '800',
  },
  categoryPercentage: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 3,
  },
  progressTrack: {
    height: 7,
    backgroundColor: '#EAF0EC',
    borderRadius: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#16A34A',
    borderRadius: 10,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 22,
    paddingVertical: 28,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E8EEEA',
  },
  emptyEmoji: {
    fontSize: 32,
    marginBottom: 10,
  },
  emptyTitle: {
    color: '#172B23',
    fontSize: 16,
    fontWeight: '800',
  },
  emptyMessage: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 7,
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ECFDF5',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    padding: 18,
  },
  insightIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  insightIcon: {
    color: '#15803D',
    fontSize: 22,
    fontWeight: '900',
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    color: '#14532D',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 7,
  },
  insightMessage: {
    color: '#365B46',
    fontSize: 13,
    lineHeight: 21,
  },
  footer: {
    paddingTop: 4,
    paddingBottom: 10,
  },
  footerText: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center',
  },
});
