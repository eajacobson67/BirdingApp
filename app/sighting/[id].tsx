import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator, BackHandler, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useColors } from '../../store/themeStore';
import { getSighting, Sighting } from '../../lib/firestore/sightings';
import { getUserProfile, UserProfile } from '../../lib/firestore/users';

export default function SightingDetailScreen() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [sighting, setSighting] = useState<Sighting | null>(null);
  const [poster, setPoster] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoRatio, setPhotoRatio] = useState(4 / 3);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { router.back(); return true; });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!id) return;
    getSighting(id).then(async (s) => {
      setSighting(s);
      if (s) setPoster(await getUserProfile(s.userId));
      setLoading(false);
    });
  }, [id]);

  const navHeader = (
    <View style={[s.navHeader, { borderBottomColor: c.border }]}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
        <Ionicons name="chevron-back" size={28} color={c.primary} />
      </TouchableOpacity>
      <Text style={[s.navTitle, { color: c.textPrimary }]}>Sighting</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        {navHeader}
        <ActivityIndicator color={c.primary} size="large" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (!sighting) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        {navHeader}
        <Text style={{ textAlign: 'center', color: c.gray, marginTop: 80, fontSize: 16 }}>Sighting not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      {navHeader}
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {sighting.photoURL && (
          <Image
            source={{ uri: sighting.photoURL }}
            style={[s.photo, { aspectRatio: photoRatio }]}
            resizeMode="cover"
            onLoad={(e) => {
              const { width, height } = e.nativeEvent.source;
              if (width && height) setPhotoRatio(width / height);
            }}
          />
        )}
        <View style={s.content}>
          <Text style={[s.species, { color: c.textPrimary }]}>{sighting.commonName}</Text>
          <Text style={[s.sci, { color: c.gray }]}>{sighting.scientificName}</Text>

          {sighting.confidence < 1 && (
            <View style={[s.pill, { backgroundColor: c.accent }]}>
              <Text style={[s.pillText, { color: c.black }]}>{Math.round(sighting.confidence * 100)}% confidence</Text>
            </View>
          )}

          {[
            { label: 'Location', value: sighting.locationName || 'Unknown' },
            { label: 'Date', value: sighting.timestamp.toLocaleDateString(undefined, { dateStyle: 'full' }) },
          ].map((row) => (
            <View key={row.label} style={[s.metaRow, { borderBottomColor: c.border }]}>
              <Text style={[s.metaLabel, { color: c.gray }]}>{row.label}</Text>
              <Text style={[s.metaValue, { color: c.textPrimary }]}>{row.value}</Text>
            </View>
          ))}

          {poster && (
            <View style={[s.metaRow, { borderBottomColor: c.border }]}>
              <Text style={[s.metaLabel, { color: c.gray }]}>Spotted by</Text>
              <Text
                style={[s.metaValue, { color: c.primary, fontFamily: 'Nunito_600SemiBold' }]}
                onPress={() => router.push(`/user/${sighting.userId}`)}
              >
                {poster.displayName} (@{poster.username})
              </Text>
            </View>
          )}

          {sighting.notes ? (
            <View style={s.notes}>
              <Text style={[s.metaLabel, { color: c.gray }]}>Notes</Text>
              <Text style={[s.notesText, { color: c.textPrimary }]}>{sighting.notes}</Text>
            </View>
          ) : null}

          {sighting.audioURL && (
            <View style={s.audioRow}>
              <Ionicons name="mic-outline" size={18} color={c.gray} />
              <Text style={[s.audioLabel, { color: c.gray }]}>Audio recording attached</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  navHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  navTitle: { fontSize: 17, fontFamily: 'Nunito_700Bold' },
  backBtn: { width: 40, alignItems: 'flex-start' },
  photo: { width: '100%' },
  content: { padding: 24, gap: 12 },
  species: { fontSize: 26, fontFamily: 'Nunito_800ExtraBold' },
  sci: { fontSize: 15, fontStyle: 'italic' },
  pill: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 },
  pillText: { fontSize: 13, fontFamily: 'Nunito_700Bold' },
  metaRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1 },
  metaLabel: { fontSize: 13, width: 100 },
  metaValue: { fontSize: 14, flex: 1 },
  notes: { gap: 6, paddingVertical: 8 },
  notesText: { fontSize: 15, lineHeight: 22 },
  audioRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  audioLabel: { fontSize: 14 },
});
