
import AsyncStorage from '@react-native-async-storage/async-storage';

export type CurrencyCode = 'NGN' | 'USD' | 'GBP' | 'EUR';

export const CURRENCY_STORAGE_KEY = 'budgetwise_currency';

const CURRENCY_SETTINGS: Record<
  CurrencyCode,
  { locale: string; currency: CurrencyCode }
> = {
  NGN: { locale: 'en-NG', currency: 'NGN' },
  USD: { locale: 'en-US', currency: 'USD' },
  GBP: { locale: 'en-GB', currency: 'GBP' },
  EUR: { locale: 'de-DE', currency: 'EUR' },
};

export async function getPreferredCurrency(): Promise<CurrencyCode> {
  try {
    const saved = await AsyncStorage.getItem(CURRENCY_STORAGE_KEY);

    if (saved && saved in CURRENCY_SETTINGS) {
      return saved as CurrencyCode;
    }
  } catch (error) {
    console.error('Could not load preferred currency:', error);
  }

  return 'NGN';
}

export function formatMoney(
  amount: number,
  currency: CurrencyCode = 'NGN',
): string {
  const settings = CURRENCY_SETTINGS[currency] ?? CURRENCY_SETTINGS.NGN;

  return new Intl.NumberFormat(settings.locale, {
    style: 'currency',
    currency: settings.currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}
