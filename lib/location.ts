import * as ExpoLocation from 'expo-location';

export interface LocationData {
  lat: number;
  lng: number;
  locationName: string;
  state: string;
  country: string;
}

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function getCurrentLocation(): Promise<{ lat: number; lng: number } | null> {
  const granted = await requestLocationPermission();
  if (!granted) return null;
  try {
    const pos = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Low });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

// Returns the last cached GPS fix instantly, or falls back to network-only.
// Good enough for leaderboard proximity — don't need a fresh GPS lock.
export async function getFastLocation(): Promise<{ lat: number; lng: number } | null> {
  const granted = await requestLocationPermission();
  if (!granted) return null;
  try {
    const last = await ExpoLocation.getLastKnownPositionAsync();
    if (last) return { lat: last.coords.latitude, lng: last.coords.longitude };
    const pos = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Low });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<LocationData> {
  const [result] = await ExpoLocation.reverseGeocodeAsync({ latitude: lat, longitude: lng });
  const city = result?.city ?? result?.district ?? '';
  const state = result?.region ?? '';
  const country = result?.country ?? '';
  const locationName = [city, state].filter(Boolean).join(', ');
  return { lat, lng, locationName, state, country };
}
