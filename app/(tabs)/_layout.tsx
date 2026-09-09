import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { CustomTabBar } from '../../components/ui/CustomTabBar';
import { useAuthStore } from '../../store/authStore';
import { useNotificationsStore } from '../../store/notificationsStore';

export default function TabsLayout() {
  const user = useAuthStore((s) => s.user);
  const refresh = useNotificationsStore((s) => s.refresh);
  const clear = useNotificationsStore((s) => s.clear);

  // Loaded here rather than on a screen so the tab badge is correct before the
  // user navigates anywhere.
  useEffect(() => {
    if (user) refresh(user.uid);
    else clear();
  }, [user, refresh, clear]);

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
      initialRouteName="index"
      backBehavior="initialRoute"
    >
      <Tabs.Screen name="leaderboard" />
      <Tabs.Screen name="league" />
      <Tabs.Screen name="index" />
      <Tabs.Screen name="map" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
