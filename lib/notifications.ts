import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { Rarity } from './birdRarity';

const isExpoGo =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === 'storeClient';

if (!isExpoGo) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // native module unavailable — not a dev/production build
  }
}

export async function registerPushToken(uid: string): Promise<void> {
  if (isExpoGo) return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('league', {
      name: 'League Events',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  const token = await Notifications.getExpoPushTokenAsync();
  await setDoc(
    doc(db, 'users', uid, 'pushTokens', token.data.replace(/[^a-zA-Z0-9]/g, '')),
    { token: token.data, platform: Platform.OS, updatedAt: serverTimestamp() },
  );
}

export async function sendLeagueNotification(
  expoPushToken: string,
  title: string,
  body: string,
): Promise<void> {
  // In production this would go through a server/Cloud Function.
  // Client-side send works for development and small leagues.
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: expoPushToken, title, body, channelId: 'league' }),
  });
}

export function getRarityNotificationWorthy(rarity: Rarity): boolean {
  return rarity === 'rare' || rarity === 'legendary' || rarity === 'mythic';
}
