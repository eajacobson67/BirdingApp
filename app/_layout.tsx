import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthListener } from '../lib/hooks/useAuth';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../constants/colors';

export default function RootLayout() {
  useAuthListener();
  const { user, loading } = useAuthStore();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/(auth)/login');
    } else {
      router.replace('/(tabs)');
    }
  }, [user, loading]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="log/select"
          options={{ presentation: 'modal', headerShown: true, title: 'Log a Bird' }}
        />
        <Stack.Screen
          name="log/audio"
          options={{ presentation: 'modal', headerShown: true, title: 'Identify by Sound' }}
        />
        <Stack.Screen
          name="log/camera"
          options={{ presentation: 'modal', headerShown: true, title: 'Identify by Photo' }}
        />
        <Stack.Screen
          name="sighting/[id]"
          options={{ headerShown: true, title: 'Sighting' }}
        />
        <Stack.Screen
          name="user/[id]"
          options={{ headerShown: true, title: 'Profile' }}
        />
      </Stack>
    </>
  );
}
