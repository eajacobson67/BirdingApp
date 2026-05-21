import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Image, BackHandler, ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../store/themeStore';
import { CommonBird, getAllSpecies } from '../../lib/commonBirds';
import { fetchBirdThumbnails } from '../../lib/birdImages';
import { useBirdsStore } from '../../store/birdsStore';
import { getRarity, getRarityFromCount, RARITY_COLORS, RARITY_LABELS } from '../../lib/birdRarity';

export default function SelectBirdScreen() {
  const c = useColors();
  const { birds, location, loading: loadingBirds } = useBirdsStore();
  const { prefill } = useLocalSearchParams<{ prefill?: string }>();

  const [search, setSearch] = useState('');
  const [filtered, setFiltered] = useState<CommonBird[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [allSpecies, setAllSpecies] = useState<CommonBird[] | null>(null);
  const fetchingRef = useRef(new Set<string>());

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { router.back(); return true; });
    return () => sub.remove();
  }, []);

  const maxVal = Math.max(...birds.map(b => b.abundance ?? b.observationCount ?? 0), 1);

  useEffect(() => {
    getAllSpecies().then(setAllSpecies).catch(() => {});
  }, []);

  // Auto-navigate when arriving from the listen screen with a prefill
  useEffect(() => {
    if (!prefill) return;
    const source = allSpecies ?? birds;
    const match = source.find(b => b.commonName.toLowerCase() === prefill.toLowerCase());
    if (match) selectBird(match);
  }, [prefill, allSpecies, birds]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const initial: Record<string, string> = {};
    birds.forEach(b => { if (b.photoUrl) initial[b.commonName] = b.photoUrl; });
    setThumbnails(initial);
  }, [birds]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const toFetch = (viewableItems.map(v => v.item as CommonBird))
      .filter(b => !b.photoUrl && !fetchingRef.current.has(b.commonName));
    if (!toFetch.length) return;
    toFetch.forEach(b => fetchingRef.current.add(b.commonName));
    fetchBirdThumbnails(toFetch.map(b => b.commonName))
      .then(t => setThumbnails(prev => ({ ...prev, ...t })))
      .catch(() => {});
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 10 }).current;

  useEffect(() => {
    if (!search.trim()) { setFiltered(birds); return; }
    const q = search.toLowerCase();
    const source = allSpecies ?? birds;
    const matches = source.filter(
      b => b.commonName.toLowerCase().includes(q) || b.scientificName.toLowerCase().includes(q),
    );
    if (allSpecies) {
      const nearbyKeys = new Set(birds.map(b => b.commonName.toLowerCase()));
      setFiltered([
        ...matches.filter(b => nearbyKeys.has(b.commonName.toLowerCase())),
        ...matches.filter(b => !nearbyKeys.has(b.commonName.toLowerCase())),
      ]);
    } else {
      setFiltered(matches);
    }
  }, [search, birds, allSpecies]);

  function selectBird(bird: CommonBird) {
    router.push({
      pathname: '/log/confirm',
      params: { commonName: bird.commonName, scientificName: bird.scientificName },
    });
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
      <View style={[s.header, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="chevron-back" size={28} color={c.primary} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: c.textPrimary }]}>Log a Sighting</Text>
        <View style={{ width: 40 }} />
      </View>

      <TextInput
        style={[s.search, { backgroundColor: c.surface, color: c.textPrimary, borderColor: c.border }]}
        placeholder="Search species..."
        placeholderTextColor={c.gray}
        value={search}
        onChangeText={setSearch}
        autoCorrect={false}
      />

      {location && (
        <Text style={[s.locationLabel, { color: c.gray }]}>Near {location.locationName || 'your location'}</Text>
      )}

      {loadingBirds ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={c.primary} size="large" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.commonName}
          initialNumToRender={15}
          windowSize={5}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          renderItem={({ item }) => {
            const val = item.abundance ?? item.observationCount;
            const rarity = val !== undefined
              ? getRarityFromCount(val, maxVal, item.commonName)
              : getRarity(item.commonName);
            const rarityColor = RARITY_COLORS[rarity];
            return (
              <TouchableOpacity
                style={[s.birdRow, { borderBottomColor: c.border, backgroundColor: c.surface }]}
                onPress={() => selectBird(item)}
                activeOpacity={0.7}
              >
                {thumbnails[item.commonName] ? (
                  <Image source={{ uri: thumbnails[item.commonName] }} style={s.thumb} />
                ) : (
                  <View style={[s.thumbPlaceholder, { backgroundColor: c.border }]} />
                )}
                <View style={s.birdInfo}>
                  <Text style={[s.commonName, { color: c.textPrimary }]}>{item.commonName}</Text>
                  <Text style={[s.sciName, { color: c.gray }]}>{item.scientificName}</Text>
                </View>
                {rarity !== 'common' && (
                  <View style={[s.rarityPill, { backgroundColor: rarityColor + '22', borderColor: rarityColor }]}>
                    <Text style={[s.rarityText, { color: rarityColor }]}>{RARITY_LABELS[rarity]}</Text>
                  </View>
                )}
                <Text style={[s.arrow, { color: c.gray }]}>›</Text>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <Text style={[s.empty, { color: c.gray }]}>No birds found. Try a different search.</Text>
          }
        />
      )}
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
  headerTitle: { fontSize: 17, fontFamily: 'Nunito_700Bold' },
  search: {
    margin: 16, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 16, borderWidth: 1,
  },
  locationLabel: { fontSize: 13, marginLeft: 16, marginBottom: 8 },
  birdRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1,
  },
  thumb: { width: 44, height: 44, borderRadius: 8 },
  thumbPlaceholder: { width: 44, height: 44, borderRadius: 8 },
  birdInfo: { flex: 1 },
  commonName: { fontSize: 16, fontFamily: 'Nunito_600SemiBold' },
  sciName: { fontSize: 13, fontStyle: 'italic', marginTop: 2 },
  arrow: { fontSize: 20 },
  empty: { textAlign: 'center', marginTop: 48, fontSize: 15 },
  rarityPill: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  rarityText: { fontSize: 11, fontFamily: 'Nunito_700Bold' },
});
