import { useEffect } from 'react';
import { Text, TextInput } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import { useAuthListener } from '../lib/hooks/useAuth';
import { useAuthStore } from '../store/authStore';
import { useBirdsStore } from '../store/birdsStore';
import { useThemeStore } from '../store/themeStore';
import { DEFAULT_BIRD_ID } from '../lib/birdStyles';
import { getUserProfile } from '../lib/firestore/users';
import { registerPushToken } from '../lib/notifications';

// Apply Nunito as the default font for every Text and TextInput in the app.
(Text as any).defaultProps = { ...((Text as any).defaultProps ?? {}), style: { fontFamily: 'Nunito_400Regular' } };
(TextInput as any).defaultProps = { ...((TextInput as any).defaultProps ?? {}), style: { fontFamily: 'Nunito_400Regular' } };

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold });

  useAuthListener();
  const { user, loading, setIsAdmin } = useAuthStore();
  const fetchBirds = useBirdsStore((s) => s.fetchBirds);
  const setBirdStyle = useThemeStore((s) => s.setBirdStyle);
  const themeHydrated = useThemeStore((s) => s._hasHydrated);

  useEffect(() => {
    if (!fontsLoaded || loading || !themeHydrated) return;
    const t = setTimeout(() => {
      if (!user) {
        router.replace('/(auth)/login');
      } else {
        router.replace('/(tabs)');
        fetchBirds();
        getUserProfile(user.uid).then((profile) => {
          const id = (profile as unknown as Record<string, string>)?.birdStyleId;
          setBirdStyle(id ?? DEFAULT_BIRD_ID);
          setIsAdmin(profile?.isAdmin ?? false);
        });
        registerPushToken(user.uid).catch(() => {});
      }
    }, 0);
    return () => clearTimeout(t);
  }, [user, loading, fontsLoaded]);

  if (!fontsLoaded || !themeHydrated) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="log/select"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="log/confirm"
          options={{ headerShown: false }}
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
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="user/[id]"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="league/create"
          options={{ presentation: 'modal', headerShown: false }}
        />
        <Stack.Screen
          name="league/browse"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="league/[id]"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="league/[id]/invite"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="admin"
          options={{ headerShown: false }}
        />
      </Stack>
    </>
  );
}
