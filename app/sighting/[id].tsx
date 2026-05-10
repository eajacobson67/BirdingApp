import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { getSighting, Sighting } from '../../lib/firestore/sightings';
import { getUserProfile, UserProfile } from '../../lib/firestore/users';

export default function SightingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [sighting, setSighting] = useState<Sighting | null>(null);
  const [poster, setPoster] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getSighting(id).then(async (s) => {
      setSighting(s);
      if (s) setPoster(await getUserProfile(s.userId));
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={Colors.brown} size="large" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (!sighting) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.empty}>Sighting not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {sighting.photoURL && (
          <Image source={{ uri: sighting.photoURL }} style={styles.photo} />
        )}
        <View style={styles.content}>
          <Text style={styles.species}>{sighting.commonName}</Text>
          <Text style={styles.sci}>{sighting.scientificName}</Text>

          {sighting.confidence < 1 && (
            <View style={styles.confidencePill}>
              <Text style={styles.confidenceText}>{Math.round(sighting.confidence * 100)}% confidence</Text>
            </View>
          )}

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>📍 Location</Text>
            <Text style={styles.metaValue}>{sighting.locationName || 'Unknown'}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>🕐 When</Text>
            <Text style={styles.metaValue}>{sighting.timestamp.toLocaleDateString(undefined, { dateStyle: 'full' })}</Text>
          </View>
          {poster && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>👤 Spotted by</Text>
              <Text style={[styles.metaValue, styles.link]} onPress={() => router.push(`/user/${sighting.userId}`)}>
                {poster.displayName} (@{poster.username})
              </Text>
            </View>
          )}
          {sighting.notes ? (
            <View style={styles.notes}>
              <Text style={styles.metaLabel}>Notes</Text>
              <Text style={styles.notesText}>{sighting.notes}</Text>
            </View>
          ) : null}
          {sighting.audioURL && (
            <View style={styles.audioRow}>
              <Text style={styles.audioIcon}>🎙️</Text>
              <Text style={styles.audioLabel}>Audio recording attached</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  photo: { width: '100%', height: 260, resizeMode: 'cover' },
  content: { padding: 24, gap: 12 },
  species: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary },
  sci: { fontSize: 15, color: Colors.gray, fontStyle: 'italic' },
  confidencePill: { alignSelf: 'flex-start', backgroundColor: Colors.yellow, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 },
  confidenceText: { fontSize: 13, fontWeight: '700', color: Colors.black },
  metaRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  metaLabel: { fontSize: 13, color: Colors.gray, width: 100 },
  metaValue: { fontSize: 14, color: Colors.textPrimary, flex: 1 },
  link: { color: Colors.brown, fontWeight: '600' },
  notes: { gap: 6, paddingVertical: 8 },
  notesText: { fontSize: 15, color: Colors.textPrimary, lineHeight: 22 },
  audioRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  audioIcon: { fontSize: 20 },
  audioLabel: { fontSize: 14, color: Colors.gray },
  empty: { textAlign: 'center', color: Colors.gray, marginTop: 80, fontSize: 16 },
});
