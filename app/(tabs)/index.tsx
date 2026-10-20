import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
export default function Index() {
  return (
    <View style={styles.container}>

      <View style={styles.content}>
        <Text style={styles.logo}>BudgetWise</Text>

        <Text style={styles.title}>
          Manage your money.
          {'\n'}
          Build your future.
        </Text>

        <Text style={styles.subtitle}>
          Track your income, control your spending,
          and reach your financial goals.
        </Text>
      </View>

      <View style={styles.buttons}>

       <TouchableOpacity
  style={styles.primaryButton}
  onPress={() => router.push('/auth/signup')}
>
  <Text style={styles.primaryButtonText}>
    Get Started
  </Text>
</TouchableOpacity>
       <TouchableOpacity
  style={styles.secondaryButton}
  onPress={() => router.push('/auth/login')}
>
  <Text style={styles.secondaryButtonText}>
    Log In
  </Text>
</TouchableOpacity>

      </View>

      <Text style={styles.footer}>
        Your money. Your goals. Your future.
      </Text>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9F8',
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 30,
    justifyContent: 'space-between',
  },

  content: {
    alignItems: 'center',
    marginTop: 80,
  },

  logo: {
    fontSize: 34,
    fontWeight: '800',
    color: '#176B4D',
    marginBottom: 45,
  },

  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#17221D',
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 18,
  },

  subtitle: {
    fontSize: 16,
    color: '#66736D',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 340,
  },

  buttons: {
    width: '100%',
    gap: 14,
  },

  primaryButton: {
    height: 56,
    backgroundColor: '#176B4D',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  secondaryButton: {
    height: 56,
    backgroundColor: '#E4EEE9',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  secondaryButtonText: {
    color: '#176B4D',
    fontSize: 16,
    fontWeight: '700',
  },

  footer: {
    textAlign: 'center',
    fontSize: 13,
    color: '#8A9690',
  },
});