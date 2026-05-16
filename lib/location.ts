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
    const pos = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
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
