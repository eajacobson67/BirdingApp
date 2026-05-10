import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { getCurrentLocation, reverseGeocode, LocationData } from '../../lib/location';
import { getNearbyCommonBirds, CommonBird } from '../../lib/commonBirds';
import { logSighting } from '../../lib/firestore/sightings';
import { updateUserStats } from '../../lib/firestore/users';
import { useAuthStore } from '../../store/authStore';
import { geohashForLocation } from 'geofire-common';

export default function SelectBirdScreen() {
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [birds, setBirds] = useState<CommonBird[]>([]);
  const [filtered, setFiltered] = useState<CommonBird[]>([]);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loadingBirds, setLoadingBirds] = useState(true);
  const [selectedBird, setSelectedBird] = useState<CommonBird | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  useEffect(() => {
    async function init() {
      const loc = await getCurrentLocation();
      if (loc) {
        const geo = await reverseGeocode(loc.lat, loc.lng);
        setLocation(geo);
        const nearby = await getNearbyCommonBirds(loc.lat, loc.lng);
        setBirds(nearby);
        setFiltered(nearby);
      }
      setLoadingBirds(false);
    }
    init();
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(birds);
    } else {
      const q = search.toLowerCase();
      setFiltered(birds.filter((b) => b.commonName.toLowerCase().includes(q) || b.scientificName.toLowerCase().includes(q)));
    }
  }, [search, birds]);

  function selectBird(bird: CommonBird) {
    setSelectedBird(bird);
    setNotes('');
    setConfirmVisible(true);
  }

  async function submitSighting() {
    if (!selectedBird || !location || !user) return;
    setSubmitting(true);
    try {
      const year = new Date().getFullYear().toString();
      const geohash = geohashForLocation([location.lat, location.lng]);
      await logSighting({
        userId: user.uid,
        commonName: selectedBird.commonName,
        scientificName: selectedBird.scientificName,
        confidence: 1.0,
        lat: location.lat,
        lng: location.lng,
        locationName: location.locationName,
        state: location.state,
        country: location.country,
        photoURL: null,
        audioURL: null,
        notes,
      });
      await updateUserStats(
        user.uid,
        selectedBird.commonName,
        year,
        location.state || null,
        location.lat,
        location.lng,
        geohash,
      );
      setConfirmVisible(false);
      router.replace('/(tabs)');
      Alert.alert('Logged!', `${selectedBird.commonName} added to your life list.`);
    } catch (e: unknown) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <TextInput
        style={styles.search}
        placeholder="Search species..."
        placeholderTextColor={Colors.gray}
        value={search}
        onChangeText={setSearch}
        autoCorrect={false}
      />

      {location && (
        <Text style={styles.locationLabel}>📍 {location.locationName || 'Your location'}</Text>
      )}

      {loadingBirds ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.brown} size="large" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.speciesCode}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.birdRow} onPress={() => selectBird(item)} activeOpacity={0.7}>
              <View>
                <Text style={styles.commonName}>{item.commonName}</Text>
                <Text style={styles.sciName}>{item.scientificName}</Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <Text style={styles.empty}>No birds found. Try a different search.</Text>
          }
        />
      )}

      <Modal visible={confirmVisible} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{selectedBird?.commonName}</Text>
            <Text style={styles.sheetSci}>{selectedBird?.scientificName}</Text>
            {location && <Text style={styles.sheetLoc}>📍 {location.locationName}</Text>}
            <TextInput
              style={styles.notesInput}
              placeholder="Notes (optional)..."
              placeholderTextColor={Colors.gray}
              multiline
              value={notes}
              onChangeText={setNotes}
            />
            <TouchableOpacity style={styles.submitBtn} onPress={submitSighting} disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color={Colors.black} />
              ) : (
                <Text style={styles.submitBtnText}>Log Sighting ✓</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setConfirmVisible(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  search: {
    margin: 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  locationLabel: { fontSize: 13, color: Colors.gray, marginLeft: 16, marginBottom: 8 },
  birdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  commonName: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  sciName: { fontSize: 13, color: Colors.gray, fontStyle: 'italic', marginTop: 2 },
  arrow: { fontSize: 20, color: Colors.gray },
  empty: { textAlign: 'center', color: Colors.gray, marginTop: 48, fontSize: 15 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 12,
  },
  sheetTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  sheetSci: { fontSize: 14, color: Colors.gray, fontStyle: 'italic' },
  sheetLoc: { fontSize: 14, color: Colors.gray },
  notesInput: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: Colors.yellow,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: Colors.black },
  cancelText: { textAlign: 'center', color: Colors.gray, paddingVertical: 8, fontSize: 15 },
});
