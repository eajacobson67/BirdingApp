import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../lib/firebase';
import { getCurrentLocation, reverseGeocode, LocationData } from '../../lib/location';
import { logSighting } from '../../lib/firestore/sightings';
import { updateUserStats } from '../../lib/firestore/users';
import { useAuthStore } from '../../store/authStore';
import { useColors } from '../../store/themeStore';
import { geohashForLocation } from 'geofire-common';
import type { CommonBird } from '../../lib/commonBirds';
import SelectBirdModal from '../../components/log/SelectBirdModal';

export default function CameraScreen() {
  const c = useColors();
  const { user } = useAuthStore();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedBird, setSelectedBird] = useState<CommonBird | null>(null);
  const [notes, setNotes] = useState('');
  const [speciesModalVisible, setSpeciesModalVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission required', 'Camera access is needed to take photos.'); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled) await handlePhotoSelected(result.assets[0].uri);
  }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled) await handlePhotoSelected(result.assets[0].uri);
  }

  async function handlePhotoSelected(uri: string) {
    setPhotoUri(uri);
    setUploading(true);
    try {
      const loc = await getCurrentLocation();
      if (loc) setLocation(await reverseGeocode(loc.lat, loc.lng));
      const blob = await (await fetch(uri)).blob();
      const storageRef = ref(storage, `photos/${user?.uid}/${Date.now()}.jpg`);
      await uploadBytes(storageRef, blob);
      setPhotoUrl(await getDownloadURL(storageRef));
    } catch (e: unknown) {
      Alert.alert('Upload failed', (e as Error).message);
    } finally {
      setUploading(false);
    }
    setSpeciesModalVisible(true);
  }

  function onBirdSelected(bird: CommonBird) {
    setSelectedBird(bird);
    setSpeciesModalVisible(false);
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
        photoURL: photoUrl,
        audioURL: null,
        notes,
      });
      await updateUserStats(user.uid, selectedBird.commonName, year, location.state || null, location.lat, location.lng, geohash);
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
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]} edges={['bottom']}>
      <View style={s.content}>
        <Text style={[s.title, { color: c.textPrimary }]}>Photo Log</Text>
        <Text style={[s.subtitle, { color: c.gray }]}>Take or upload a photo, then select the species.</Text>

        {photoUri ? (
          <Image source={{ uri: photoUri }} style={s.preview} />
        ) : (
          <View style={[s.placeholder, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={s.placeholderIcon}>📷</Text>
            <Text style={[s.placeholderText, { color: c.gray }]}>No photo selected</Text>
          </View>
        )}

        {uploading && <ActivityIndicator color={c.primary} />}

        <TouchableOpacity style={[s.btn, { backgroundColor: c.accent }]} onPress={takePhoto}>
          <Text style={[s.btnText, { color: c.black }]}>Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, s.btnSecondary, { backgroundColor: c.surface, borderColor: c.border }]} onPress={pickPhoto}>
          <Text style={[s.btnText, { color: c.textPrimary }]}>Choose from Library</Text>
        </TouchableOpacity>
      </View>

      <SelectBirdModal
        visible={speciesModalVisible}
        onSelect={onBirdSelected}
        onClose={() => setSpeciesModalVisible(false)}
      />

      <Modal visible={confirmVisible} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={[s.sheet, { backgroundColor: c.surface }]}>
            <Text style={[s.sheetTitle, { color: c.textPrimary }]}>{selectedBird?.commonName}</Text>
            <Text style={[s.sheetSci, { color: c.gray }]}>{selectedBird?.scientificName}</Text>
            {location && <Text style={{ fontSize: 14, color: c.gray }}>📍 {location.locationName}</Text>}
            <TextInput
              style={[s.notesInput, { backgroundColor: c.background, color: c.textPrimary, borderColor: c.border }]}
              placeholder="Notes (optional)..."
              placeholderTextColor={c.gray}
              multiline
              value={notes}
              onChangeText={setNotes}
            />
            <TouchableOpacity style={[s.submitBtn, { backgroundColor: c.accent }]} onPress={submitSighting} disabled={submitting}>
              {submitting ? <ActivityIndicator color={c.black} /> : <Text style={[s.submitBtnText, { color: c.black }]}>Log Sighting ✓</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setConfirmVisible(false)}>
              <Text style={[s.cancelText, { color: c.gray }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 24, gap: 16, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', alignSelf: 'flex-start' },
  subtitle: { fontSize: 14, alignSelf: 'flex-start' },
  preview: { width: '100%', height: 220, borderRadius: 16, resizeMode: 'cover' },
  placeholder: { width: '100%', height: 220, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  placeholderIcon: { fontSize: 48 },
  placeholderText: { fontSize: 14 },
  btn: { width: '100%', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  btnSecondary: { borderWidth: 1.5 },
  btnText: { fontSize: 16, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 12 },
  sheetTitle: { fontSize: 22, fontWeight: '800' },
  sheetSci: { fontSize: 14, fontStyle: 'italic' },
  notesInput: { borderRadius: 10, padding: 12, fontSize: 15, borderWidth: 1, minHeight: 80, textAlignVertical: 'top' },
  submitBtn: { borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  submitBtnText: { fontSize: 16, fontWeight: '700' },
  cancelText: { textAlign: 'center', paddingVertical: 8, fontSize: 15 },
});
