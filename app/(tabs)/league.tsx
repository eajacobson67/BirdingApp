import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useFriends } from '../../lib/hooks/useFriends';
import {
  getUserLeagues, getFriendLeagues, getPublicLeagues,
  getLeagueLeaderboard, getMyLeagueMembership,
  getPendingInvites, respondToInvite,
  type League, type LeagueInvite, type LeagueMember,
} from '../../lib/firestore/leagues';
import { LeagueCompletionModal } from '../../components/league/LeagueCompletionModal';

type Tab = 'mine' | 'friends' | 'public';

interface LeagueWithMeta {
  league: League;
  sightingCount: number;
  rank?: number;
  total?: number;
}

interface CompletionInfo {
  league: League;
  rank: number;
  total: number;
  myMember: LeagueMember | null;
}

type ListItem =
  | { type: 'sectionHeader'; title: string; key: string }
  | { type: 'invite'; data: LeagueInvite; key: string }
  | { type: 'mine'; data: LeagueWithMeta; key: string }
  | { type: 'league'; data: League; key: string };

const SEEN_KEY = '@seen_completions';

function timeRemaining(end: Date): string {
  const ms = end.getTime() - Date.now();
  if (ms <= 0) return 'Ended';
  const days = Math.floor(ms / 86400000);
  if (days > 0) return `${days}d left`;
  const hours = Math.floor(ms / 3600000);
  return `${hours}h left`;
}

function timeUntilStart(start: Date): string {
  const ms = start.getTime() - Date.now();
  if (ms <= 0) return 'Starting soon';
  const days = Math.floor(ms / 86400000);
  if (days > 0) return `Starts in ${days}d`;
  const hours = Math.floor(ms / 3600000);
  if (hours > 0) return `Starts in ${hours}h`;
  return 'Starting soon';
}

export default function LeagueScreen() {
  const c = useColors();
  const { user } = useAuthStore();
  const { birdStyle } = useThemeStore();
  const { friendIds } = useFriends(user?.uid ?? null);

  const [activeTab, setActiveTab] = useState<Tab>('mine');
  const didMountRef = useRef(false);
  const [myLeagues, setMyLeagues] = useState<LeagueWithMeta[]>([]);
  const [friendLeagues, setFriendLeagues] = useState<League[]>([]);
  const [publicLeagues, setPublicLeagues] = useState<League[]>([]);
  const [invites, setInvites] = useState<LeagueInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [completion, setCompletion] = useState<CompletionInfo | null>(null);

  async function checkCompletions(leagues: League[], uid: string) {
    const completed = leagues.filter((l) => l.status === 'completed');
    if (!completed.length) return;
    const stored = await AsyncStorage.getItem(SEEN_KEY);
    const seen: string[] = stored ? JSON.parse(stored) : [];
    const unseen = completed.filter((l) => !seen.includes(l.id));
    if (!unseen.length) return;
    const league = unseen[0];
    const leaderboard = await getLeagueLeaderboard(league.id);
    const rankIdx = leaderboard.findIndex((m) => m.userId === uid);
    if (rankIdx < 0) return;
    setCompletion({ league, rank: rankIdx + 1, total: leaderboard.length, myMember: leaderboard[rankIdx] });
  }

  async function dismissCompletion() {
    if (!completion) return;
    const stored = await AsyncStorage.getItem(SEEN_KEY);
    const seen: string[] = stored ? JSON.parse(stored) : [];
    seen.push(completion.league.id);
    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    setCompletion(null);
  }

  const loadMine = useCallback(async () => {
    if (!user) return;
    const [leagues, inv] = await Promise.all([getUserLeagues(user.uid), getPendingInvites(user.uid)]);
    setInvites(inv);

    const memberships = await Promise.all(leagues.map((l) => getMyLeagueMembership(l.id, user.uid)));
    const completedLeagues = leagues.filter((l) => l.status === 'completed');
    const leaderboards = await Promise.all(completedLeagues.map((l) => getLeagueLeaderboard(l.id)));
    const lbMap = new Map(completedLeagues.map((l, i) => [l.id, leaderboards[i]]));

    setMyLeagues(
      leagues.map((league, i) => {
        const m = memberships[i];
        const lb = lbMap.get(league.id);
        const rankIdx = lb ? lb.findIndex((mb) => mb.userId === user.uid) : -1;
        return {
          league,
          sightingCount: m?.sightingCount ?? 0,
          rank: rankIdx >= 0 ? rankIdx + 1 : undefined,
          total: lb?.length,
        };
      }),
    );

    checkCompletions(leagues, user.uid);
  }, [user]);

  const loadFriends = useCallback(async () => {
    if (!user || friendIds.length === 0) { setFriendLeagues([]); return; }
    const leagues = await getFriendLeagues(friendIds);
    setFriendLeagues(leagues);
  }, [user, friendIds]);

  const loadPublic = useCallback(async () => {
    const leagues = await getPublicLeagues();
    setPublicLeagues(leagues);
  }, []);

  const load = useCallback(async () => {
    if (activeTab === 'mine') await loadMine();
    else if (activeTab === 'friends') await loadFriends();
    else await loadPublic();
  }, [activeTab, loadMine, loadFriends, loadPublic]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => { setLoading(false); setRefreshing(false); });
  }, [activeTab, user]);

  useEffect(() => {
    if (activeTab === 'friends' && friendIds.length > 0) loadFriends();
  }, [friendIds]);

  // Reload mine tab when screen regains focus (e.g. returning from league creation)
  useFocusEffect(
    useCallback(() => {
      if (!didMountRef.current) { didMountRef.current = true; return; }
      if (activeTab === 'mine') {
        setLoading(true);
        loadMine().finally(() => setLoading(false));
      }
    }, [activeTab, loadMine]),
  );

  async function handleInvite(inv: LeagueInvite, accept: boolean) {
    if (!user) return;
    await respondToInvite(inv.leagueId, user.uid, accept, user.displayName ?? 'Birder', birdStyle.id);
    setInvites((prev) => prev.filter((i) => i.leagueId !== inv.leagueId));
    if (accept) loadMine();
  }

  function leagueDisplayStatus(league: League): 'active' | 'upcoming' | 'ended' {
    const now = new Date();
    if (league.status === 'completed' || league.endDate <= now) return 'ended';
    if (league.status === 'lobby' || league.startDate > now) return 'upcoming';
    return 'active';
  }

  // Build flat list data for "mine" tab with section headers
  function buildMineData(): ListItem[] {
    const items: ListItem[] = [];
    if (invites.length) {
      items.push({ type: 'sectionHeader', title: 'INVITES', key: 'h-invites' });
      invites.forEach((inv) => items.push({ type: 'invite', data: inv, key: `inv-${inv.leagueId}` }));
    }
    const active = myLeagues.filter((m) => leagueDisplayStatus(m.league) === 'active');
    const upcoming = myLeagues.filter((m) => leagueDisplayStatus(m.league) === 'upcoming');
    const ended = myLeagues.filter((m) => leagueDisplayStatus(m.league) === 'ended');
    if (active.length) {
      items.push({ type: 'sectionHeader', title: 'ACTIVE', key: 'h-active' });
      active.forEach((m) => items.push({ type: 'mine', data: m, key: `mine-${m.league.id}` }));
    }
    if (upcoming.length) {
      items.push({ type: 'sectionHeader', title: 'UPCOMING', key: 'h-upcoming' });
      upcoming.forEach((m) => items.push({ type: 'mine', data: m, key: `mine-${m.league.id}` }));
    }
    if (ended.length) {
      items.push({ type: 'sectionHeader', title: 'ENDED', key: 'h-ended' });
      ended.forEach((m) => items.push({ type: 'mine', data: m, key: `mine-${m.league.id}` }));
    }
    return items;
  }

  function renderItem({ item }: { item: ListItem }) {
    if (item.type === 'sectionHeader') {
      return <Text style={[s.sectionLabel, { color: c.gray }]}>{item.title}</Text>;
    }

    if (item.type === 'invite') {
      const inv = item.data;
      return (
        <View style={[s.inviteCard, { backgroundColor: c.primary + '15', borderColor: c.primary }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.cardName, { color: c.textPrimary }]}>{inv.leagueName}</Text>
            <Text style={[s.cardMeta, { color: c.gray }]}>Invited by {inv.invitedByName}</Text>
          </View>
          <TouchableOpacity style={[s.inviteBtn, { backgroundColor: c.primary }]} onPress={() => handleInvite(inv, true)}>
            <Text style={s.inviteBtnText}>Join</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.inviteBtn, { backgroundColor: c.border }]} onPress={() => handleInvite(inv, false)}>
            <Text style={[s.inviteBtnText, { color: c.gray }]}>Decline</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (item.type === 'mine') {
      const { league, sightingCount, rank, total } = item.data;
      const displayStatus = leagueDisplayStatus(league);
      let meta = '';
      if (displayStatus === 'ended' && rank) meta = `#${rank} of ${total}`;
      else if (displayStatus === 'ended') meta = `${sightingCount} bird${sightingCount !== 1 ? 's' : ''} · Ended`;
      else if (displayStatus === 'active') meta = `${sightingCount} bird${sightingCount !== 1 ? 's' : ''} · ${timeRemaining(league.endDate)}`;
      else if (league.status === 'lobby') meta = `${league.memberCount} member${league.memberCount !== 1 ? 's' : ''} · Lobby`;
      else meta = `${league.memberCount} member${league.memberCount !== 1 ? 's' : ''} · ${timeUntilStart(league.startDate)}`;

      const dotColor = displayStatus === 'active' ? c.primary : displayStatus === 'upcoming' ? '#2E8B57' : c.gray;
      const metaColor = displayStatus === 'ended' && rank && rank <= 3 ? c.primary : c.gray;

      return (
        <TouchableOpacity
          style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}
          onPress={() => router.push(`/league/${league.id}`)}
          activeOpacity={0.75}
        >
          <View style={[s.statusDot, { backgroundColor: dotColor }]} />
          <View style={{ flex: 1 }}>
            <Text style={[s.cardName, { color: c.textPrimary }]}>{league.name}</Text>
            <Text style={[s.cardMeta, { color: metaColor }]}>{meta}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.gray} />
        </TouchableOpacity>
      );
    }

    if (item.type === 'league') {
      const league = item.data;
      return (
        <TouchableOpacity
          style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}
          onPress={() => router.push(`/league/${league.id}`)}
          activeOpacity={0.75}
        >
          <View style={[s.statusDot, { backgroundColor: league.status === 'active' ? c.primary : '#2E8B57' }]} />
          <View style={{ flex: 1 }}>
            <Text style={[s.cardName, { color: c.textPrimary }]}>{league.name}</Text>
            <Text style={[s.cardMeta, { color: c.gray }]}>
              {league.memberCount} member{league.memberCount !== 1 ? 's' : ''} · {timeRemaining(league.endDate)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.gray} />
        </TouchableOpacity>
      );
    }

    return null;
  }

  const mineData = buildMineData();
  const otherData: ListItem[] = (activeTab === 'friends' ? friendLeagues : publicLeagues).map((l) => ({
    type: 'league',
    data: l,
    key: `league-${l.id}`,
  }));
  const listData = activeTab === 'mine' ? mineData : otherData;
  const isEmpty = !loading && listData.length === 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <Text style={[s.title, { color: c.textPrimary }]}>Leagues</Text>

      <View style={[s.tabs, { backgroundColor: c.surface, borderColor: c.border }]}>
        {(['mine', 'friends', 'public'] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[s.tab, activeTab === tab && { backgroundColor: c.primary }]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[s.tabText, { color: activeTab === tab ? '#FFFFFF' : c.gray }]}>
              {tab === 'mine' ? 'My Leagues' : tab === 'friends' ? 'Friends' : 'Public'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={c.primary} size="large" style={{ marginTop: 60 }} />
      ) : isEmpty ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="trophy-outline" size={56} color={c.border} />
          <Text style={[s.empty, { color: c.gray }]}>
            {activeTab === 'mine' ? 'No leagues yet.' : activeTab === 'friends' ? 'No leagues from friends.' : 'No public leagues.'}
          </Text>
          {activeTab === 'mine' && (
            <Text style={[s.emptySub, { color: c.gray }]}>Tap + to create one.</Text>
          )}
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load().finally(() => setRefreshing(false)); }}
              tintColor={c.primary}
            />
          }
        />
      )}

      {activeTab === 'mine' && (
        <TouchableOpacity
          style={[s.fab, { backgroundColor: c.primary }]}
          onPress={() => router.push('/league/create')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {completion && (
        <LeagueCompletionModal
          visible
          rank={completion.rank}
          totalMembers={completion.total}
          leagueName={completion.league.name}
          myMember={completion.myMember}
          onClose={dismissCompletion}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 26, fontFamily: 'Nunito_800ExtraBold', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, borderRadius: 12, padding: 4, borderWidth: 1 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabText: { fontSize: 13, fontFamily: 'Nunito_600SemiBold' },
  sectionLabel: { fontSize: 11, fontFamily: 'Nunito_700Bold', letterSpacing: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 8, borderRadius: 14, borderWidth: 1, padding: 16 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  cardName: { fontSize: 16, fontFamily: 'Nunito_700Bold' },
  cardMeta: { fontSize: 13, marginTop: 2 },
  inviteCard: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 10, borderRadius: 14, borderWidth: 1.5, padding: 14 },
  inviteBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  inviteBtnText: { fontSize: 13, fontFamily: 'Nunito_700Bold', color: '#FFFFFF' },
  empty: { fontSize: 17, fontFamily: 'Nunito_700Bold', marginTop: 16 },
  emptySub: { fontSize: 14, marginTop: 6 },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
});
