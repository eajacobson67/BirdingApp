import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import {
  getUserLeagues, getPendingInvites, respondToInvite,
  type League, type LeagueInvite,
} from '../../lib/firestore/leagues';
import { useThemeStore } from '../../store/themeStore';

function timeRemaining(end: Date): string {
  const ms = end.getTime() - Date.now();
  if (ms <= 0) return 'Ended';
  const days = Math.floor(ms / 86400000);
  if (days > 0) return `${days}d left`;
  const hours = Math.floor(ms / 3600000);
  return `${hours}h left`;
}

function statusColor(status: League['status'], primary: string): string {
  if (status === 'active') return primary;
  if (status === 'upcoming') return '#2E8B57';
  return '#8BA3B0';
}

export default function LeagueScreen() {
  const c = useColors();
  const { user } = useAuthStore();
  const { birdStyle } = useThemeStore();

  const [leagues, setLeagues] = useState<League[]>([]);
  const [invites, setInvites] = useState<LeagueInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [l, inv] = await Promise.all([
      getUserLeagues(user.uid),
      getPendingInvites(user.uid),
    ]);
    setLeagues(l.sort((a, b) => {
      const order = { lobby: 0, active: 1, upcoming: 2, completed: 3 };
      return (order[a.status] ?? 99) - (order[b.status] ?? 99);
    }));
    setInvites(inv);
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function handleInvite(inv: LeagueInvite, accept: boolean) {
    if (!user) return;
    await respondToInvite(
      inv.leagueId,
      user.uid,
      accept,
      user.displayName ?? 'Birder',
      birdStyle.id,
    );
    setInvites((prev) => prev.filter((i) => i.leagueId !== inv.leagueId));
    if (accept) load();
  }

  const lobby = leagues.filter((l) => l.status === 'lobby');
  const active = leagues.filter((l) => l.status === 'active');
  const upcoming = leagues.filter((l) => l.status === 'upcoming');
  const past = leagues.filter((l) => l.status === 'completed');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <View style={s.header}>
        <Text style={[s.title, { color: c.textPrimary }]}>Leagues</Text>
        <TouchableOpacity
          style={[s.browseBtn, { borderColor: c.border }]}
          onPress={() => router.push('/league/browse')}
        >
          <Ionicons name="search" size={16} color={c.primary} />
          <Text style={[s.browseBtnText, { color: c.primary }]}>Browse</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={c.primary} size="large" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={[...invites.map((i) => ({ type: 'invite' as const, data: i })),
                 ...lobby.map((l) => ({ type: 'league' as const, data: l })),
                 ...active.map((l) => ({ type: 'league' as const, data: l })),
                 ...upcoming.map((l) => ({ type: 'league' as const, data: l })),
                 ...past.map((l) => ({ type: 'league' as const, data: l }))]}
          keyExtractor={(item, i) =>
            item.type === 'invite' ? `inv-${item.data.leagueId}` : `league-${(item.data as League).id}-${i}`
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={c.primary} />}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 80 }}>
              <Ionicons name="trophy-outline" size={56} color={c.border} />
              <Text style={[s.empty, { color: c.gray }]}>No leagues yet.</Text>
              <Text style={[s.emptySub, { color: c.gray }]}>Create one or browse public leagues.</Text>
            </View>
          }
          ListHeaderComponent={
            <Text style={[s.sectionLabel, { color: c.gray }]}>
              {invites.length > 0 ? 'INVITES' : active.length > 0 ? 'ACTIVE' : ''}
            </Text>
          }
          renderItem={({ item }) => {
            if (item.type === 'invite') {
              const inv = item.data as LeagueInvite;
              return (
                <View style={[s.inviteCard, { backgroundColor: c.primary + '15', borderColor: c.primary }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.inviteName, { color: c.textPrimary }]}>{inv.leagueName}</Text>
                    <Text style={[s.inviteFrom, { color: c.gray }]}>Invited by {inv.invitedByName}</Text>
                  </View>
                  <TouchableOpacity
                    style={[s.inviteBtn, { backgroundColor: c.primary }]}
                    onPress={() => handleInvite(inv, true)}
                  >
                    <Text style={s.inviteBtnText}>Join</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.inviteBtn, { backgroundColor: c.border }]}
                    onPress={() => handleInvite(inv, false)}
                  >
                    <Text style={[s.inviteBtnText, { color: c.gray }]}>Decline</Text>
                  </TouchableOpacity>
                </View>
              );
            }

            const league = item.data as League;
            return (
              <TouchableOpacity
                style={[s.leagueCard, { backgroundColor: c.surface, borderColor: c.border }]}
                onPress={() => router.push(`/league/${league.id}`)}
                activeOpacity={0.75}
              >
                <View style={[s.statusDot, { backgroundColor: statusColor(league.status, c.primary) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.leagueName, { color: c.textPrimary }]}>{league.name}</Text>
                  <Text style={[s.leagueMeta, { color: c.gray }]}>
                    {league.memberCount} member{league.memberCount !== 1 ? 's' : ''} · {timeRemaining(league.endDate)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.gray} />
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* FAB — Create League */}
      <TouchableOpacity
        style={[s.fab, { backgroundColor: c.primary }]}
        onPress={() => router.push('/league/create')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 26, fontWeight: '800', flex: 1 },
  browseBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  browseBtnText: { fontSize: 13, fontWeight: '600' },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  inviteCard: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 10, borderRadius: 14, borderWidth: 1.5, padding: 14 },
  inviteName: { fontSize: 15, fontWeight: '700' },
  inviteFrom: { fontSize: 13, marginTop: 2 },
  inviteBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  inviteBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  leagueCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 8, borderRadius: 14, borderWidth: 1, padding: 16 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  leagueName: { fontSize: 16, fontWeight: '700' },
  leagueMeta: { fontSize: 13, marginTop: 2 },
  empty: { fontSize: 17, fontWeight: '700', marginTop: 16 },
  emptySub: { fontSize: 14, marginTop: 6 },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
});
