import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
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

      const radiusKm = 80; // ~50 miles
      const center: [number, number] = [loc.lat, loc.lng];
      const bounds = geohashQueryBounds(center, radiusKm * 1000);

      const results: UserProfile[] = [];
      for (const b of bounds) {
        const q = query(
          collection(db, 'users'),
          orderBy('geohash'),
          startAt(b[0]),
          endAt(b[1]),
        );
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
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
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
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Leaderboard</Text>

      <View style={styles.tabs}>
        {(['global', 'nearby', 'friends'] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'global' ? 'Global' : tab === 'nearby' ? 'Nearby' : 'Friends'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.brown} size="large" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item, i) => item.uid ?? i.toString()}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {activeTab === 'friends' ? 'Add friends to see their rankings.' : 'No users found.'}
            </Text>
          }
          renderItem={({ item, index }) => {
            const bigYearCount = item.yearSpecies?.[year]?.length ?? 0;
            const isMe = item.uid === user?.uid;
            return (
              <TouchableOpacity
                style={[styles.row, isMe && styles.rowHighlight]}
                onPress={() => router.push(isMe ? '/(tabs)/profile' : `/user/${item.uid}`)}
                activeOpacity={0.75}
              >
                <Text style={styles.rank}>{index + 1}</Text>
                <View style={styles.avatar}>
                  <Text style={styles.avatarEmoji}>🐦</Text>
                </View>
                <View style={styles.meta}>
                  <Text style={styles.displayName}>{item.displayName}{isMe ? ' (you)' : ''}</Text>
                  <Text style={styles.username}>@{item.username}</Text>
                </View>
                <View style={styles.stats}>
                  <Text style={styles.statMain}>{item.totalSpecies}</Text>
                  <Text style={styles.statLabel}>species</Text>
                  <Text style={styles.bigYear}>{bigYearCount} this year</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  title: { fontSize: 26, fontWeight: '800', color: Colors.textPrimary, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: Colors.brown },
  tabText: { fontSize: 13, fontWeight: '600', color: Colors.gray },
  tabTextActive: { color: Colors.surface },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 12,
  },
  rowHighlight: { backgroundColor: '#FFF9EB' },
  rank: { width: 28, fontSize: 16, fontWeight: '800', color: Colors.brown, textAlign: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.cream, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  avatarEmoji: { fontSize: 22 },
  meta: { flex: 1 },
  displayName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  username: { fontSize: 13, color: Colors.gray },
  stats: { alignItems: 'flex-end' },
  statMain: { fontSize: 20, fontWeight: '800', color: Colors.brown },
  statLabel: { fontSize: 11, color: Colors.gray, textTransform: 'uppercase', letterSpacing: 0.5 },
  bigYear: { fontSize: 11, color: Colors.yellow, fontWeight: '700', marginTop: 2 },
  empty: { textAlign: 'center', color: Colors.gray, marginTop: 60, fontSize: 15, paddingHorizontal: 32 },
});
