import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Image, ScrollView, BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../lib/firebase';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../store/themeStore';
import { logSighting } from '../../lib/firestore/sightings';
import { updateUserStats } from '../../lib/firestore/users';
import { useAuthStore } from '../../store/authStore';
import { useBirdsStore } from '../../store/birdsStore';
import { geohashForLocation } from 'geofire-common';
import { getRarity, getRarityFromCount, RARITY_COLORS, RARITY_LABELS } from '../../lib/birdRarity';

export default function ConfirmSightingScreen() {
  const c = useColors();
  const { user } = useAuthStore();
  const { birds, location } = useBirdsStore();
  const { commonName, scientificName, photoUri } = useLocalSearchParams<{ commonName: string; scientificName: string; photoUri?: string }>();

  const [notes, setNotes] = useState('');
  const [photoURI, setPhotoURI] = useState<string | null>(null);
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { router.back(); return true; });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (photoUri) uploadPhoto(photoUri);
  }, []);

  const bird = birds.find(b => b.commonName === commonName);
  const maxVal = Math.max(...birds.map(b => b.abundance ?? b.observationCount ?? 0), 1);
  const val = bird?.abundance ?? bird?.observationCount;
  const rarity = val !== undefined
    ? getRarityFromCount(val, maxVal, commonName)
    : getRarity(commonName);
  const rarityColor = RARITY_COLORS[rarity];

  async function uploadPhoto(uri: string) {
    if (!user) return;
    setPhotoURI(uri);
    setUploadingPhoto(true);
    try {
      const blob = await (await fetch(uri)).blob();
      const storageRef = ref(storage, `photos/${user.uid}/${Date.now()}.jpg`);
      await uploadBytes(storageRef, blob);
      setPhotoURL(await getDownloadURL(storageRef));
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled) await uploadPhoto(result.assets[0].uri);
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission required', 'Camera access is needed.'); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled) await uploadPhoto(result.assets[0].uri);
  }

  async function submit() {
    if (!location || !user || !commonName) return;
    setSubmitting(true);
    try {
      const year = new Date().getFullYear().toString();
      const geohash = geohashForLocation([location.lat, location.lng]);
      await logSighting({
        userId: user.uid,
        commonName,
        scientificName: scientificName ?? '',
        confidence: 1.0,
        lat: location.lat,
        lng: location.lng,
        locationName: location.locationName,
        state: location.state,
        country: location.country,
        photoURL,
        audioURL: null,
        notes,
      });
      await updateUserStats(
        user.uid, commonName, year,
        location.state || null, location.lat, location.lng, geohash,
      );
      router.replace('/(tabs)');
      Alert.alert('Logged!', `${commonName} added to your life list.`);
    } catch (e: unknown) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
      <View style={[s.header, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="chevron-back" size={28} color={c.primary} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: c.textPrimary }]}>Log Sighting</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
        <View style={s.birdBlock}>
          <View style={s.nameRow}>
            <Text style={[s.birdName, { color: c.textPrimary }]}>{commonName}</Text>
            {rarity !== 'common' && (
              <View style={[s.rarityPill, { backgroundColor: rarityColor + '22', borderColor: rarityColor }]}>
                <Text style={[s.rarityText, { color: rarityColor }]}>{RARITY_LABELS[rarity]}</Text>
              </View>
            )}
          </View>
          <Text style={[s.sciName, { color: c.gray }]}>{scientificName}</Text>
          {location && (
            <Text style={[s.location, { color: c.gray }]}>📍 {location.locationName || 'Your location'}</Text>
          )}
        </View>

        <View style={[s.photoRow, { borderColor: c.border, backgroundColor: c.surface }]}>
          {photoURI ? (
            <>
              <Image source={{ uri: photoURI }} style={s.photoPreview} />
              {!uploadingPhoto && (
                <TouchableOpacity
                  onPress={() => { setPhotoURI(null); setPhotoURL(null); }}
                  style={s.removePhoto}
                >
                  <Ionicons name="close-circle" size={22} color={c.gray} />
                </TouchableOpacity>
              )}
            </>
          ) : (
            <View style={s.photoButtons}>
              <TouchableOpacity style={[s.photoBtn, { borderColor: c.border }]} onPress={takePhoto}>
                <Ionicons name="camera-outline" size={22} color={c.primary} />
                <Text style={[s.photoBtnText, { color: c.primary }]}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.photoBtn, { borderColor: c.border }]} onPress={pickPhoto}>
                <Ionicons name="image-outline" size={22} color={c.primary} />
                <Text style={[s.photoBtnText, { color: c.primary }]}>Library</Text>
              </TouchableOpacity>
            </View>
          )}
          {uploadingPhoto && <ActivityIndicator color={c.primary} style={{ marginLeft: 8 }} />}
        </View>

        <TextInput
          style={[s.notes, { backgroundColor: c.surface, color: c.textPrimary, borderColor: c.border }]}
          placeholder="Add notes (optional)..."
          placeholderTextColor={c.gray}
          multiline
          value={notes}
          onChangeText={setNotes}
        />

        <TouchableOpacity
          style={[s.submitBtn, { backgroundColor: c.accent, opacity: submitting || uploadingPhoto ? 0.7 : 1 }]}
          onPress={submit}
          disabled={submitting || uploadingPhoto}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color={c.black} />
          ) : (
            <Text style={[s.submitText, { color: c.black }]}>Log Sighting</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  form: { padding: 20, gap: 16 },
  birdBlock: { gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  birdName: { fontSize: 28, fontWeight: '800' },
  sciName: { fontSize: 14, fontStyle: 'italic' },
  location: { fontSize: 13, marginTop: 4 },
  rarityPill: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  rarityText: { fontSize: 11, fontWeight: '700' },
  photoRow: {
    borderRadius: 12, borderWidth: 1, padding: 12,
    flexDirection: 'row', alignItems: 'center', minHeight: 60,
  },
  photoButtons: { flex: 1, flexDirection: 'row', gap: 10 },
  photoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1,
  },
  photoBtnText: { fontSize: 14, fontWeight: '600' },
  photoPreview: { width: 80, height: 80, borderRadius: 10, flex: 1 },
  removePhoto: { padding: 4 },
  notes: {
    borderRadius: 12, borderWidth: 1, padding: 14,
    fontSize: 15, minHeight: 140, textAlignVertical: 'top',
  },
  submitBtn: { borderRadius: 14, paddingVertical: 18, alignItems: 'center' },
  submitText: { fontSize: 17, fontWeight: '700' },
});
