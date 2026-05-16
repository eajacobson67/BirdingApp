import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Avatar } from '../../components/ui/Avatar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useColors } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { useFriends } from '../../lib/hooks/useFriends';
import { getGlobalLeaderboard, getUserProfile, UserProfile } from '../../lib/firestore/users';
import { getFriendsLeaderboard } from '../../lib/firestore/friends';
import { getCurrentLocation } from '../../lib/location';
import { geohashQueryBounds, distanceBetween } from 'geofire-common';
import { collection, query, orderBy, where, getDocs, startAt, endAt } from 'firebase/firestore';
import { db } from '../../lib/firebase';

type Tab = 'global' | 'nearby' | 'friends';

export default function LeaderboardScreen() {
  const c = useColors();
  const { user } = useAuthStore();
  const { friendIds } = useFriends(user?.uid ?? null);
  const [activeTab, setActiveTab] = useState<Tab>('global');
  const [entries, setEntries] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);

  const loadGlobal = useCallback(async () => {
    setLoading(true);
    const data = await getGlobalLeaderboard(50);
    setEntries(data);
    setLoading(false);
  }, []);

  const loadNearby = useCallback(async () => {
    setLoading(true);
    try {
      const loc = await getCurrentLocation();
      if (!loc) { setEntries([]); setLoading(false); return; }
      const radiusKm = 80;
      const center: [number, number] = [loc.lat, loc.lng];
      const bounds = geohashQueryBounds(center, radiusKm * 1000);
      const results: UserProfile[] = [];
      for (const b of bounds) {
        const q = query(collection(db, 'users'), orderBy('geohash'), startAt(b[0]), endAt(b[1]));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          const profile = d.data() as UserProfile;
          if (profile.location) {
            const dist = distanceBetween([profile.location.lat, profile.location.lng], center);
            if (dist <= radiusKm) results.push(profile);
          }
        }
      }
      setEntries(results.sort((a, b) => b.totalSpecies - a.totalSpecies));
    } catch { setEntries([]); }
    finally { setLoading(false); }
  }, []);

  const loadFriends = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const data = await getFriendsLeaderboard(user.uid);
    setEntries(data);
    setLoading(false);
  }, [user, friendIds]);

  useEffect(() => {
    if (activeTab === 'global') loadGlobal();
    else if (activeTab === 'nearby') loadNearby();
    else loadFriends();
  }, [activeTab]);

  const year = new Date().getFullYear().toString();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <Text style={[s.title, { color: c.textPrimary }]}>Leaderboard</Text>

      <View style={[s.tabs, { backgroundColor: c.surface, borderColor: c.border }]}>
        {(['global', 'nearby', 'friends'] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[s.tab, activeTab === tab && { backgroundColor: c.primary }]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[s.tabText, { color: activeTab === tab ? '#FFFFFF' : c.gray }]}>
              {tab === 'global' ? 'Global' : tab === 'nearby' ? 'Nearby' : 'Friends'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={c.primary} size="large" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item, i) => item.uid ?? i.toString()}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <Text style={[s.empty, { color: c.gray }]}>
              {activeTab === 'friends' ? 'Add friends to see their rankings.' : 'No users found.'}
            </Text>
          }
          renderItem={({ item, index }) => {
            const bigYearCount = item.yearSpecies?.[year]?.length ?? 0;
            const isMe = item.uid === user?.uid;
            return (
              <TouchableOpacity
                style={[s.row, { borderBottomColor: c.border, backgroundColor: isMe ? c.background : c.surface }]}
                onPress={() => router.push(isMe ? '/(tabs)/profile' : `/user/${item.uid}`)}
                activeOpacity={0.75}
              >
                <Text style={[s.rank, { color: c.primary }]}>{index + 1}</Text>
                <Avatar photoURL={item.photoURL} birdStyleId={item.birdStyleId} size={44} />
                <View style={s.meta}>
                  <Text style={[s.displayName, { color: c.textPrimary }]}>{item.displayName}{isMe ? ' (you)' : ''}</Text>
                  <Text style={[s.username, { color: c.gray }]}>@{item.username}</Text>
                </View>
                <View style={s.stats}>
                  <Text style={[s.statMain, { color: c.primary }]}>{item.totalSpecies}</Text>
                  <Text style={[s.statLabel, { color: c.gray }]}>species</Text>
                  <Text style={[s.bigYear, { color: c.accent }]}>{bigYearCount} this year</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, borderRadius: 12, padding: 4, borderWidth: 1 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabText: { fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 12 },
  rank: { width: 28, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  meta: { flex: 1 },
  displayName: { fontSize: 15, fontWeight: '700' },
  username: { fontSize: 13 },
  stats: { alignItems: 'flex-end' },
  statMain: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  bigYear: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 15, paddingHorizontal: 32 },
});
