import { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { router } from 'expo-router';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../lib/firebase';
import { identifyFromAudio, BirdNetResult } from '../../lib/birdnet';
import { getCurrentLocation, reverseGeocode, LocationData } from '../../lib/location';
import { logSighting } from '../../lib/firestore/sightings';
import { updateUserStats } from '../../lib/firestore/users';
import { useAuthStore } from '../../store/authStore';
import { Colors } from '../../constants/colors';
import { geohashForLocation } from 'geofire-common';

type Phase = 'idle' | 'recording' | 'processing' | 'results';

export default function AudioScreen() {
  const { user } = useAuthStore();
  const [phase, setPhase] = useState<Phase>('idle');
  const [results, setResults] = useState<BirdNetResult[]>([]);
  const [selected, setSelected] = useState<BirdNetResult | null>(null);
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState<LocationData | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const recording = useRef<Audio.Recording | null>(null);

  async function startRecording() {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recording.current = rec;
      setPhase('recording');
    } catch (e: unknown) {
      Alert.alert('Error', 'Could not start recording: ' + (e as Error).message);
    }
  }

  async function stopAndIdentify() {
    if (!recording.current) return;
    setPhase('processing');
    try {
      await recording.current.stopAndUnloadAsync();
      const uri = recording.current.getURI();
      recording.current = null;
      if (!uri) throw new Error('No audio recorded');

      const loc = await getCurrentLocation();
      let locData: LocationData | null = null;
      if (loc) locData = await reverseGeocode(loc.lat, loc.lng);
      setLocation(locData);

      // Upload to Firebase Storage
      const blob = await (await fetch(uri)).blob();
      const storageRef = ref(storage, `audio/${user?.uid}/${Date.now()}.m4a`);
      await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(storageRef);
      setAudioUrl(downloadUrl);

      // Identify via BirdNET
      const date = new Date().toISOString().split('T')[0];
      const birdResults = await identifyFromAudio(
        downloadUrl,
        locData?.lat ?? 0,
        locData?.lng ?? 0,
        date,
      );
      setResults(birdResults);
      setPhase('results');
    } catch (e: unknown) {
      Alert.alert('Identification failed', (e as Error).message);
      setPhase('idle');
    }
  }

  function confirmSpecies(result: BirdNetResult) {
    setSelected(result);
    setNotes('');
    setConfirmVisible(true);
  }

  async function submitSighting() {
    if (!selected || !location || !user) return;
    setSubmitting(true);
    try {
      const year = new Date().getFullYear().toString();
      const geohash = geohashForLocation([location.lat, location.lng]);
      await logSighting({
        userId: user.uid,
        commonName: selected.commonName,
        scientificName: selected.scientificName,
        confidence: selected.confidence,
        lat: location.lat,
        lng: location.lng,
        locationName: location.locationName,
        state: location.state,
        country: location.country,
        photoURL: null,
        audioURL: audioUrl,
        notes,
      });
      await updateUserStats(user.uid, selected.commonName, year, location.state || null, location.lat, location.lng, geohash);
      setConfirmVisible(false);
      router.replace('/(tabs)');
      Alert.alert('Logged!', `${selected.commonName} added to your life list.`);
    } catch (e: unknown) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Sound Identification</Text>
        <Text style={styles.subtitle}>Record 5–15 seconds of bird audio</Text>

        <View style={styles.visualizer}>
          {phase === 'recording' && (
            <View style={styles.recordingIndicator}>
              <View style={styles.redDot} />
              <Text style={styles.recordingText}>Recording...</Text>
            </View>
          )}
          {phase === 'processing' && (
            <ActivityIndicator color={Colors.brown} size="large" />
          )}
          {phase === 'idle' && <Text style={styles.idleIcon}>🎙️</Text>}
          {phase === 'results' && <Text style={styles.idleIcon}>✅</Text>}
        </View>

        {phase === 'idle' && (
          <TouchableOpacity style={styles.recordBtn} onPress={startRecording}>
            <Text style={styles.recordBtnText}>Start Recording</Text>
          </TouchableOpacity>
        )}
        {phase === 'recording' && (
          <TouchableOpacity style={[styles.recordBtn, styles.stopBtn]} onPress={stopAndIdentify}>
            <Text style={styles.recordBtnText}>Stop & Identify</Text>
          </TouchableOpacity>
        )}

        {phase === 'results' && results.length > 0 && (
          <View style={styles.results}>
            <Text style={styles.resultsTitle}>Best Matches</Text>
            {results.map((r, i) => (
              <TouchableOpacity key={i} style={styles.resultRow} onPress={() => confirmSpecies(r)} activeOpacity={0.7}>
                <View style={styles.resultMeta}>
                  <Text style={styles.resultRank}>#{i + 1}</Text>
                  <View>
                    <Text style={styles.resultName}>{r.commonName}</Text>
                    <Text style={styles.resultSci}>{r.scientificName}</Text>
                  </View>
                </View>
                <View style={styles.confidencePill}>
                  <Text style={styles.confidenceText}>{Math.round(r.confidence * 100)}%</Text>
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setPhase('idle')} style={styles.retryBtn}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === 'results' && results.length === 0 && (
          <View style={styles.noResults}>
            <Text style={styles.noResultsText}>No birds identified. Try recording in a quieter spot.</Text>
            <TouchableOpacity onPress={() => setPhase('idle')} style={styles.retryBtn}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Modal visible={confirmVisible} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{selected?.commonName}</Text>
            <Text style={styles.sheetSci}>{selected?.scientificName}</Text>
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
  content: { padding: 24, alignItems: 'center', gap: 20 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: 14, color: Colors.gray, textAlign: 'center' },
  visualizer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  idleIcon: { fontSize: 64 },
  recordingIndicator: { alignItems: 'center', gap: 8 },
  redDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.red },
  recordingText: { color: Colors.red, fontWeight: '700', fontSize: 14 },
  recordBtn: {
    backgroundColor: Colors.yellow,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  stopBtn: { backgroundColor: Colors.red },
  recordBtnText: { fontSize: 16, fontWeight: '700', color: Colors.black },
  results: { width: '100%', gap: 10 },
  resultsTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  resultRow: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  resultMeta: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  resultRank: { fontSize: 18, fontWeight: '800', color: Colors.gray, width: 28 },
  resultName: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  resultSci: { fontSize: 12, color: Colors.gray, fontStyle: 'italic' },
  confidencePill: {
    backgroundColor: Colors.yellow,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  confidenceText: { fontSize: 13, fontWeight: '700', color: Colors.black },
  retryBtn: { alignItems: 'center', paddingVertical: 8 },
  retryText: { color: Colors.gray, fontSize: 15 },
  noResults: { alignItems: 'center', gap: 12 },
  noResultsText: { color: Colors.gray, textAlign: 'center', fontSize: 15 },
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
