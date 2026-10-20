import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

export default function RootLayout() {
  return (
    <>
      <Stack>
        {/* Main app tabs */}
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false }}
        />

       {/* Authentication screens */}
<Stack.Screen
  name="auth/login"
  options={{ headerShown: false }}
/>
<Stack.Screen
  name="auth/signup"
  options={{ headerShown: false }}
/> 

        {/* Edit Profile screen */}
        <Stack.Screen
          name="edit-profile"
          options={{
            title: 'Edit Profile',
            headerShown: false,
          }}
        />

        {/* Modal screen */}
        <Stack.Screen
          name="modal"
          options={{
            presentation: 'modal',
            title: 'Modal',
          }}
        />
      </Stack>

      <StatusBar style="auto" />
    </>
  );
}