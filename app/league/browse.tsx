import { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { getPublicLeagues, joinLeague, type League } from '../../lib/firestore/leagues';
import { getUserProfile } from '../../lib/firestore/users';

function timeRemaining(end: Date): string {
  const ms = end.getTime() - Date.now();
  if (ms <= 0) return 'Ended';
  const days = Math.floor(ms / 86400000);
  if (days > 0) return `${days}d left`;
  const hours = Math.floor(ms / 3600000);
  return `${hours}h left`;
}

type Filter = 'active' | 'lobby' | 'upcoming';

export default function BrowseLeaguesScreen() {
  const c = useColors();
  const { user } = useAuthStore();
  const { birdStyle } = useThemeStore();
  const [leagues, setLeagues] = useState<League[]>([]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { router.back(); return true; });
    return () => sub.remove();
  }, []);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('lobby');
  const [joining, setJoining] = useState<string | null>(null);

  useEffect(() => {
    getPublicLeagues(50).then((data) => {
      setLeagues(data);
      setLoading(false);
    });
  }, []);

  async function handleJoin(league: League) {
    if (!user) return;
    setJoining(league.id);
    try {
      const profile = await getUserProfile(user.uid);
      await joinLeague(
        league.id,
        user.uid,
        profile?.displayName ?? user.displayName ?? 'Birder',
        birdStyle.id,
      );
      router.push(`/league/${league.id}`);
    } catch {
      Alert.alert('Error', 'Could not join league. Try again.');
    } finally {
      setJoining(null);
    }
  }

  const filtered = leagues.filter((l) => l.status === filter);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color={c.primary} />
        </TouchableOpacity>
        <Text style={[s.title, { color: c.textPrimary }]}>Community Leagues</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={[s.tabs, { backgroundColor: c.surface, borderColor: c.border }]}>
        {(['lobby', 'active', 'upcoming'] as Filter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[s.tab, filter === f && { backgroundColor: c.primary }]}
            onPress={() => setFilter(f)}
          >
            <Text style={[s.tabText, { color: filter === f ? '#FFFFFF' : c.gray }]}>
              {f === 'lobby' ? 'Open' : f === 'active' ? 'Active' : 'Upcoming'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={c.primary} size="large" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <Text style={[s.empty, { color: c.gray }]}>No {filter} public leagues found.</Text>
          }
          renderItem={({ item }) => (
            <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[s.leagueName, { color: c.textPrimary }]}>{item.name}</Text>
                <View style={s.meta}>
                  <Ionicons name="people-outline" size={13} color={c.gray} />
                  <Text style={[s.metaText, { color: c.gray }]}>{item.memberCount}</Text>
                  <Ionicons name="time-outline" size={13} color={c.gray} style={{ marginLeft: 10 }} />
                  <Text style={[s.metaText, { color: c.gray }]}>
                    {item.status === 'lobby' ? 'Waiting to start' : timeRemaining(item.endDate)}
                  </Text>
                  {item.config.rarityScoring && (
                    <View style={[s.chip, { borderColor: c.primary }]}>
                      <Text style={[s.chipText, { color: c.primary }]}>Rarity</Text>
                    </View>
                  )}
                  {item.config.requirePhotos && (
                    <View style={[s.chip, { borderColor: c.gray }]}>
                      <Text style={[s.chipText, { color: c.gray }]}>Photos</Text>
                    </View>
                  )}
                </View>
              </View>
              <TouchableOpacity
                style={[s.joinBtn, { backgroundColor: joining === item.id ? c.border : c.primary }]}
                onPress={() => handleJoin(item)}
                disabled={joining === item.id}
              >
                <Text style={s.joinBtnText}>{joining === item.id ? '…' : 'Join'}</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 18, fontWeight: '800' },
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, borderRadius: 12, padding: 4, borderWidth: 1 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabText: { fontSize: 13, fontWeight: '600' },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  leagueName: { fontSize: 16, fontWeight: '700' },
  description: { fontSize: 13, marginTop: 3 },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 4, flexWrap: 'wrap' },
  metaText: { fontSize: 13 },
  chip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 6 },
  chipText: { fontSize: 11, fontWeight: '700' },
  joinBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  joinBtnText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 15 },
});
