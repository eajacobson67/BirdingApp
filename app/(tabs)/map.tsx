import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { getCurrentLocation } from '../../lib/location';
import { getRecentPublicSightings, Sighting } from '../../lib/firestore/sightings';

export default function MapScreen() {
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [friendsOnly, setFriendsOnly] = useState(false);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    async function load() {
      const [loc, data] = await Promise.all([
        getCurrentLocation(),
        getRecentPublicSightings(200),
      ]);
      if (loc) setUserLocation({ latitude: loc.lat, longitude: loc.lng });
      setSightings(data);
      setLoading(false);
    }
    load();
  }, []);

  const displayed = friendsOnly
    ? sightings // TODO: filter by friend IDs when friends hook is wired
    : sightings;

  function centerOnUser() {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      });
    }
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={
          userLocation
            ? { ...userLocation, latitudeDelta: 0.5, longitudeDelta: 0.5 }
            : { latitude: 39.5, longitude: -98.35, latitudeDelta: 40, longitudeDelta: 40 }
        }
        showsUserLocation
      >
        {displayed.map((s) => (
          <Marker
            key={s.id}
            coordinate={{ latitude: s.location.lat, longitude: s.location.lng }}
            pinColor={Colors.brown}
          >
            <Callout onPress={() => router.push(`/sighting/${s.id}`)}>
              <View style={styles.callout}>
                <Text style={styles.calloutSpecies}>{s.commonName}</Text>
                <Text style={styles.calloutMeta}>{s.locationName}</Text>
                <Text style={styles.calloutTime}>{formatAgo(s.timestamp)}</Text>
                <Text style={styles.calloutAction}>Tap to view →</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={Colors.brown} size="large" />
        </View>
      )}

      <SafeAreaView style={styles.controls} edges={['top']}>
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, !friendsOnly && styles.filterChipActive]}
            onPress={() => setFriendsOnly(false)}
          >
            <Text style={[styles.filterChipText, !friendsOnly && styles.filterChipTextActive]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, friendsOnly && styles.filterChipActive]}
            onPress={() => setFriendsOnly(true)}
          >
            <Text style={[styles.filterChipText, friendsOnly && styles.filterChipTextActive]}>Friends</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <TouchableOpacity style={styles.locationBtn} onPress={centerOnUser}>
        <Text style={styles.locationBtnText}>📍</Text>
      </TouchableOpacity>
    </View>
  );
}

function formatAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(245,239,224,0.7)', alignItems: 'center', justifyContent: 'center' },
  controls: { position: 'absolute', top: 0, left: 0, right: 0 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.brown, borderColor: Colors.brown },
  filterChipText: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  filterChipTextActive: { color: Colors.surface },
  locationBtn: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  locationBtnText: { fontSize: 22 },
  callout: { minWidth: 160, maxWidth: 220, padding: 4 },
  calloutSpecies: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  calloutMeta: { fontSize: 12, color: Colors.gray, marginTop: 2 },
  calloutTime: { fontSize: 12, color: Colors.gray },
  calloutAction: { fontSize: 12, color: Colors.brown, fontWeight: '600', marginTop: 4 },
});
