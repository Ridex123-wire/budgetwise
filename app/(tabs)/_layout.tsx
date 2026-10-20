
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#16A34A',
        tabBarInactiveTintColor: '#64748B',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home' }}
      />

      <Tabs.Screen
        name="dashboard"
        options={{ title: 'Dashboard' }}
      />

      <Tabs.Screen
        name="budgets"
        options={{ title: 'Budgets' }}
      />

      <Tabs.Screen
        name="savings"
        options={{ title: 'Savings' }}
      />

      <Tabs.Screen
        name="transactions"
        options={{ title: 'Transactions' }}
      />

      <Tabs.Screen
        name="explore"
        options={{ title: 'Explore' }}
      />

      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile' }}
      />
    </Tabs>
  );
}
