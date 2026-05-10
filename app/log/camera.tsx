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
import { Colors } from '../../constants/colors';
import { geohashForLocation } from 'geofire-common';
import type { CommonBird } from '../../lib/commonBirds';
import SelectBirdModal from '../../components/log/SelectBirdModal';

export default function CameraScreen() {
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
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.content}>
        <Text style={styles.title}>Photo Log</Text>
        <Text style={styles.subtitle}>Take or upload a photo, then select the species.</Text>

        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.preview} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderIcon}>📷</Text>
            <Text style={styles.placeholderText}>No photo selected</Text>
          </View>
        )}

        {uploading && <ActivityIndicator color={Colors.brown} />}

        <TouchableOpacity style={styles.btn} onPress={takePhoto}>
          <Text style={styles.btnText}>Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={pickPhoto}>
          <Text style={[styles.btnText, styles.btnTextSecondary]}>Choose from Library</Text>
        </TouchableOpacity>
      </View>

      <SelectBirdModal
        visible={speciesModalVisible}
        onSelect={onBirdSelected}
        onClose={() => setSpeciesModalVisible(false)}
      />

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
              {submitting ? <ActivityIndicator color={Colors.black} /> : <Text style={styles.submitBtnText}>Log Sighting ✓</Text>}
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
  content: { flex: 1, padding: 24, gap: 16, alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, alignSelf: 'flex-start' },
  subtitle: { fontSize: 14, color: Colors.gray, alignSelf: 'flex-start' },
  preview: { width: '100%', height: 220, borderRadius: 16, resizeMode: 'cover' },
  placeholder: { width: '100%', height: 220, borderRadius: 16, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', gap: 8 },
  placeholderIcon: { fontSize: 48 },
  placeholderText: { color: Colors.gray, fontSize: 14 },
  btn: { width: '100%', backgroundColor: Colors.yellow, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  btnSecondary: { backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border },
  btnText: { fontSize: 16, fontWeight: '700', color: Colors.black },
  btnTextSecondary: { color: Colors.textPrimary },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 12 },
  sheetTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  sheetSci: { fontSize: 14, color: Colors.gray, fontStyle: 'italic' },
  sheetLoc: { fontSize: 14, color: Colors.gray },
  notesInput: { backgroundColor: Colors.background, borderRadius: 10, padding: 12, fontSize: 15, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border, minHeight: 80, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: Colors.yellow, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: Colors.black },
  cancelText: { textAlign: 'center', color: Colors.gray, paddingVertical: 8, fontSize: 15 },
});
