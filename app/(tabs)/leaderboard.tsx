import { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, ViewToken, Animated } from 'react-native';
import { Avatar } from '../../components/ui/Avatar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useColors } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { useFriends } from '../../lib/hooks/useFriends';
import { getGlobalLeaderboard, getMyGlobalRank, getUserProfile, UserProfile } from '../../lib/firestore/users';
import { getFriendsLeaderboard } from '../../lib/firestore/friends';
import { getFastLocation } from '../../lib/location';
import { geohashQueryBounds, distanceBetween } from 'geofire-common';
import { collection, query, orderBy, getDocs, startAt, endAt } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { QueryDocumentSnapshot } from 'firebase/firestore';

type Tab = 'global' | 'nearby' | 'friends';
const PAGE_SIZE = 20;
// Approximate height of one row (paddingVertical:14×2 + avatar:44 + border:1)
const STICKY_H = 73;

export default function LeaderboardScreen() {
  const c = useColors();
  const { user } = useAuthStore();
  const { friendIds } = useFriends(user?.uid ?? null);
  const [activeTab, setActiveTab] = useState<Tab>('global');
  const [entries, setEntries] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [stickyPos, setStickyPos] = useState<'top' | 'bottom' | null>(null);
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  const [myGlobalRank, setMyGlobalRank] = useState<number | null>(null);

  const lastDocRef = useRef<QueryDocumentSnapshot | null>(null);
  const loadingMoreRef = useRef(false);
  const entriesRef = useRef<UserProfile[]>([]);
  const userUidRef = useRef<string | undefined>(user?.uid);

  // One animated value per edge; spring to 1 when that edge is active, 0 otherwise
  const topAnim = useRef(new Animated.Value(0)).current;
  const bottomAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(topAnim, {
        toValue: stickyPos === 'top' ? 1 : 0,
        useNativeDriver: true,
        tension: 180,
        friction: 22,
      }),
      Animated.spring(bottomAnim, {
        toValue: stickyPos === 'bottom' ? 1 : 0,
        useNativeDriver: true,
        tension: 180,
        friction: 22,
      }),
    ]).start();
  }, [stickyPos]);

  function updateEntries(next: UserProfile[]) {
    entriesRef.current = next;
    setEntries(next);
  }

  useEffect(() => {
    if (!user?.uid) return;
    userUidRef.current = user.uid;
    getUserProfile(user.uid).then(p => {
      if (!p) return;
      setMyProfile(p);
      getMyGlobalRank(p.totalSpecies).then(setMyGlobalRank).catch(() => {});
    }).catch(() => {});
  }, [user?.uid]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const uid = userUidRef.current;
    if (!uid) return;
    const curEntries = entriesRef.current;
    const userIndex = curEntries.findIndex(e => e.uid === uid);
    const indices = viewableItems.map(v => v.index ?? -1).filter(i => i >= 0);
    if (indices.length === 0) return;
    const firstVisible = Math.min(...indices);
    const lastVisible = Math.max(...indices);

    if (userIndex >= firstVisible && userIndex <= lastVisible) {
      setStickyPos(null);
    } else if (userIndex < 0 || userIndex > lastVisible) {
      setStickyPos('bottom');
    } else {
      setStickyPos('top');
    }
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const loadGlobal = useCallback(async (append = false) => {
    if (append) {
      if (!lastDocRef.current || loadingMoreRef.current) return;
      loadingMoreRef.current = true;
      setLoadingMore(true);
    } else {
      setLoading(true);
      lastDocRef.current = null;
    }
    try {
      const { users, lastDoc } = await getGlobalLeaderboard(PAGE_SIZE, append ? lastDocRef.current ?? undefined : undefined);
      lastDocRef.current = lastDoc;
      setHasMore(users.length === PAGE_SIZE);
      updateEntries(append ? [...entriesRef.current, ...users] : users);
    } finally {
      setLoading(false);
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, []);

  const loadNearby = useCallback(async () => {
    setLoading(true);
    try {
      const loc = await getFastLocation();
      if (!loc) { updateEntries([]); return; }
      const radiusKm = 80;
      const center: [number, number] = [loc.lat, loc.lng];
      const bounds = geohashQueryBounds(center, radiusKm * 1000);
      const snaps = await Promise.all(
        bounds.map(b => getDocs(query(collection(db, 'users'), orderBy('geohash'), startAt(b[0]), endAt(b[1])))),
      );
      const results: UserProfile[] = [];
      for (const snap of snaps) {
        for (const d of snap.docs) {
          const profile = d.data() as UserProfile;
          const rawLoc = profile.location as unknown as Record<string, number> | null;
          if (rawLoc) {
            const lat = rawLoc.lat ?? rawLoc.latitude;
            const lng = rawLoc.lng ?? rawLoc.longitude;
            if (lat != null && lng != null && distanceBetween([lat, lng], center) <= radiusKm) {
              results.push(profile);
            }
          }
        }
      }
      updateEntries(results.sort((a, b) => b.totalSpecies - a.totalSpecies));
      setHasMore(false);
    } catch (e) {
      console.warn('Nearby leaderboard error:', e);
      updateEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFriends = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [friends, self] = await Promise.all([
        getFriendsLeaderboard(user.uid),
        getUserProfile(user.uid),
      ]);
      const withSelf = self
        ? [...friends, self].sort((a, b) => b.totalSpecies - a.totalSpecies)
        : friends;
      updateEntries(withSelf);
      setHasMore(false);
    } catch (e) {
      console.warn('Friends leaderboard error:', e);
      updateEntries([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => {
    updateEntries([]);
    lastDocRef.current = null;
    setHasMore(false);
    setStickyPos(null);
    if (activeTab === 'global') loadGlobal(false);
    else if (activeTab === 'nearby') loadNearby();
    else loadFriends();
  }, [activeTab]));

  const year = new Date().getFullYear().toString();
  const userIndex = entries.findIndex(e => e.uid === user?.uid);
  const stickyEntry = userIndex >= 0 ? entries[userIndex] : myProfile;
  const stickyRank = userIndex >= 0
    ? userIndex + 1
    : activeTab === 'global' ? myGlobalRank : null;

  function renderRowContent(item: UserProfile, rank: number, isMe: boolean, rankLoading = false) {
    const bigYearCount = item.yearSpecies?.[year]?.length ?? 0;
    return (
      <>
        <Text style={[s.rank, { color: c.primary }]}>{rankLoading ? '—' : rank}</Text>
        <Avatar photoURL={item.photoURL} birdStyleId={item.birdStyleId} size={44} />
        <View style={s.meta}>
          <Text style={[s.displayName, { color: c.textPrimary }]}>{item.displayName}{isMe ? ' (you)' : ''}</Text>
          <Text style={[s.username, { color: c.gray }]} numberOfLines={1}>@{item.username}</Text>
        </View>
        <View style={s.stats}>
          <Text style={[s.statMain, { color: c.primary }]}>{item.totalSpecies}</Text>
          <Text style={[s.statLabel, { color: c.gray }]}>species</Text>
          <Text style={[s.bigYear, { color: c.accent }]}>{bigYearCount} this year</Text>
        </View>
      </>
    );
  }

  function StickyRowView({ anim, edge }: { anim: Animated.Value; edge: 'top' | 'bottom' }) {
    if (!stickyEntry) return null;
    const translateY = anim.interpolate({
      inputRange: [0, 1],
      outputRange: [edge === 'bottom' ? STICKY_H : -STICKY_H, 0],
    });
    return (
      <Animated.View
        pointerEvents={stickyPos === edge ? 'auto' : 'none'}
        style={[
          s.stickyContainer,
          edge === 'top' ? { top: 0 } : { bottom: 0 },
          { opacity: anim, transform: [{ translateY }], backgroundColor: c.surface },
        ]}
      >
        <TouchableOpacity
          style={[s.row, { borderBottomColor: c.border, backgroundColor: c.primary + '15' }]}
          onPress={() => router.push('/(tabs)/profile')}
          activeOpacity={0.85}
        >
          {renderRowContent(stickyEntry, stickyRank ?? 0, true, stickyRank === null)}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.background }}>
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
        <View style={{ flex: 1 }}>
          <FlatList
            data={entries}
            keyExtractor={(item, i) => item.uid ?? i.toString()}
            contentContainerStyle={{ paddingBottom: STICKY_H }}
            initialNumToRender={20}
            windowSize={5}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            onEndReached={() => { if (activeTab === 'global' && hasMore) loadGlobal(true); }}
            onEndReachedThreshold={0.4}
            ListFooterComponent={loadingMore ? <ActivityIndicator color={c.primary} style={{ marginVertical: 16 }} /> : null}
            ListEmptyComponent={
              <Text style={[s.empty, { color: c.gray }]}>
                {activeTab === 'friends' ? 'Add friends to see their rankings.' : 'No users found.'}
              </Text>
            }
            renderItem={({ item, index }) => {
              const isMe = item.uid === user?.uid;
              return (
                <TouchableOpacity
                  style={[s.row, { borderBottomColor: c.border, backgroundColor: isMe ? c.primary + '15' : c.surface }]}
                  onPress={() => router.push(isMe ? '/(tabs)/profile' : `/user/${item.uid}`)}
                  activeOpacity={0.75}
                >
                  {renderRowContent(item, index + 1, isMe)}
                </TouchableOpacity>
              );
            }}
          />

          {/* Sticky rows — absolutely positioned, spring in/out from their edge */}
          <StickyRowView anim={topAnim} edge="top" />
          <StickyRowView anim={bottomAnim} edge="bottom" />
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 26, fontFamily: 'Nunito_800ExtraBold', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, borderRadius: 12, padding: 4, borderWidth: 1 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabText: { fontSize: 13, fontFamily: 'Nunito_600SemiBold' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 12 },
  stickyContainer: { position: 'absolute', left: 0, right: 0 },
  rank: { width: 40, fontSize: 16, fontFamily: 'Nunito_800ExtraBold', textAlign: 'center' },
  meta: { flex: 1 },
  displayName: { fontSize: 15, fontFamily: 'Nunito_700Bold' },
  username: { fontSize: 13 },
  stats: { alignItems: 'flex-end' },
  statMain: { fontSize: 20, fontFamily: 'Nunito_800ExtraBold' },
  statLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  bigYear: { fontSize: 11, fontFamily: 'Nunito_700Bold', marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 15, paddingHorizontal: 32 },
});
