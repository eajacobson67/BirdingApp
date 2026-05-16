import { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, TextInput, ScrollView } from 'react-native';
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
import { useColors } from '../../store/themeStore';
import { geohashForLocation } from 'geofire-common';

type Phase = 'idle' | 'recording' | 'processing' | 'results' | 'api_error';

export default function AudioScreen() {
  const c = useColors();
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
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
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
      const blob = await (await fetch(uri)).blob();
      const storageRef = ref(storage, `audio/${user?.uid}/${Date.now()}.m4a`);
      await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(storageRef);
      setAudioUrl(downloadUrl);
      const date = new Date().toISOString().split('T')[0];
      try {
        const birdResults = await identifyFromAudio(downloadUrl, locData?.lat ?? 0, locData?.lng ?? 0, date);
        setResults(birdResults);
        setPhase('results');
      } catch { setPhase('api_error'); }
    } catch (e: unknown) {
      Alert.alert('Recording failed', (e as Error).message);
      setPhase('idle');
    }
  }

  async function submitSighting() {
    if (!selected || !location || !user) return;
    setSubmitting(true);
    try {
      const year = new Date().getFullYear().toString();
      const geohash = geohashForLocation([location.lat, location.lng]);
      await logSighting({ userId: user.uid, commonName: selected.commonName, scientificName: selected.scientificName, confidence: selected.confidence, lat: location.lat, lng: location.lng, locationName: location.locationName, state: location.state, country: location.country, photoURL: null, audioURL: audioUrl, notes });
      await updateUserStats(user.uid, selected.commonName, year, location.state || null, location.lat, location.lng, geohash);
      setConfirmVisible(false);
      router.replace('/(tabs)');
      Alert.alert('Logged!', `${selected.commonName} added to your life list.`);
    } catch (e: unknown) {
      Alert.alert('Error', (e as Error).message);
    } finally { setSubmitting(false); }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['bottom']}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={[s.title, { color: c.textPrimary }]}>Sound Identification</Text>
        <Text style={[s.subtitle, { color: c.gray }]}>Record 5–15 seconds of bird audio</Text>

        <View style={[s.visualizer, { backgroundColor: c.surface, borderColor: c.border }]}>
          {phase === 'recording' && (
            <View style={s.recordingIndicator}>
              <View style={[s.redDot, { backgroundColor: c.danger }]} />
              <Text style={[s.recordingText, { color: c.danger }]}>Recording...</Text>
            </View>
          )}
          {phase === 'processing' && <ActivityIndicator color={c.primary} size="large" />}
          {(phase === 'idle' || phase === 'api_error') && <Text style={s.idleIcon}>🎙️</Text>}
          {phase === 'results' && <Text style={s.idleIcon}>✅</Text>}
        </View>

        {(phase === 'idle' || phase === 'api_error') && (
          <TouchableOpacity style={[s.recordBtn, { backgroundColor: c.accent }]} onPress={startRecording}>
            <Text style={[s.recordBtnText, { color: c.black }]}>Start Recording</Text>
          </TouchableOpacity>
        )}
        {phase === 'recording' && (
          <TouchableOpacity style={[s.recordBtn, { backgroundColor: c.danger }]} onPress={stopAndIdentify}>
            <Text style={[s.recordBtnText, { color: '#FFFFFF' }]}>Stop & Identify</Text>
          </TouchableOpacity>
        )}
        {phase === 'api_error' && (
          <View style={s.apiErrorBox}>
            <Text style={[s.apiErrorText, { color: c.gray }]}>Sound ID is unavailable right now. You can select the species manually instead.</Text>
            <TouchableOpacity style={[s.manualBtn, { backgroundColor: c.surface, borderColor: c.primary }]} onPress={() => router.replace('/log/select')}>
              <Text style={[s.manualBtnText, { color: c.primary }]}>Select Species Manually</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === 'results' && results.length > 0 && (
          <View style={s.results}>
            <Text style={[s.resultsTitle, { color: c.textPrimary }]}>Best Matches</Text>
            {results.map((r, i) => (
              <TouchableOpacity key={i} style={[s.resultRow, { backgroundColor: c.surface, borderColor: c.border }]} onPress={() => { setSelected(r); setNotes(''); setConfirmVisible(true); }} activeOpacity={0.7}>
                <View style={s.resultMeta}>
                  <Text style={[s.resultRank, { color: c.gray }]}>#{i + 1}</Text>
                  <View>
                    <Text style={[s.resultName, { color: c.textPrimary }]}>{r.commonName}</Text>
                    <Text style={[s.resultSci, { color: c.gray }]}>{r.scientificName}</Text>
                  </View>
                </View>
                <View style={[s.pill, { backgroundColor: c.accent }]}>
                  <Text style={[s.pillText, { color: c.black }]}>{Math.round(r.confidence * 100)}%</Text>
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setPhase('idle')} style={s.retryBtn}>
              <Text style={{ color: c.gray, fontSize: 15 }}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}

        {phase === 'results' && results.length === 0 && (
          <View style={s.noResults}>
            <Text style={{ color: c.gray, textAlign: 'center', fontSize: 15 }}>No birds identified. Try recording in a quieter spot.</Text>
            <TouchableOpacity onPress={() => setPhase('idle')} style={s.retryBtn}>
              <Text style={{ color: c.gray, fontSize: 15 }}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Modal visible={confirmVisible} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={[s.sheet, { backgroundColor: c.surface }]}>
            <Text style={[s.sheetTitle, { color: c.textPrimary }]}>{selected?.commonName}</Text>
            <Text style={[s.sheetSci, { color: c.gray }]}>{selected?.scientificName}</Text>
            {location && <Text style={{ fontSize: 14, color: c.gray }}>📍 {location.locationName}</Text>}
            <TextInput style={[s.notesInput, { backgroundColor: c.background, color: c.textPrimary, borderColor: c.border }]} placeholder="Notes (optional)..." placeholderTextColor={c.gray} multiline value={notes} onChangeText={setNotes} />
            <TouchableOpacity style={[s.submitBtn, { backgroundColor: c.accent }]} onPress={submitSighting} disabled={submitting}>
              {submitting ? <ActivityIndicator color={c.black} /> : <Text style={[s.submitBtnText, { color: c.black }]}>Log Sighting ✓</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setConfirmVisible(false)}>
              <Text style={{ textAlign: 'center', color: c.gray, paddingVertical: 8, fontSize: 15 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  content: { padding: 24, alignItems: 'center', gap: 20 },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 14, textAlign: 'center' },
  visualizer: { width: 160, height: 160, borderRadius: 80, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginVertical: 16 },
  idleIcon: { fontSize: 64 },
  recordingIndicator: { alignItems: 'center', gap: 8 },
  redDot: { width: 16, height: 16, borderRadius: 8 },
  recordingText: { fontWeight: '700', fontSize: 14 },
  recordBtn: { borderRadius: 14, paddingVertical: 16, paddingHorizontal: 40, alignItems: 'center' },
  recordBtnText: { fontSize: 16, fontWeight: '700' },
  results: { width: '100%', gap: 10 },
  resultsTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  resultRow: { borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1 },
  resultMeta: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  resultRank: { fontSize: 18, fontWeight: '800', width: 28 },
  resultName: { fontSize: 16, fontWeight: '600' },
  resultSci: { fontSize: 12, fontStyle: 'italic' },
  pill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 13, fontWeight: '700' },
  retryBtn: { alignItems: 'center', paddingVertical: 8 },
  noResults: { alignItems: 'center', gap: 12 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 12 },
  sheetTitle: { fontSize: 22, fontWeight: '800' },
  sheetSci: { fontSize: 14, fontStyle: 'italic' },
  notesInput: { borderRadius: 10, padding: 12, fontSize: 15, borderWidth: 1, minHeight: 80, textAlignVertical: 'top' },
  submitBtn: { borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  submitBtnText: { fontSize: 16, fontWeight: '700' },
  apiErrorBox: { alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  apiErrorText: { textAlign: 'center', fontSize: 14, lineHeight: 20 },
  manualBtn: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28, borderWidth: 1.5 },
  manualBtnText: { fontSize: 15, fontWeight: '700' },
});
