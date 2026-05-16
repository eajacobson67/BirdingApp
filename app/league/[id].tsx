import { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, Share, BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import {
  getLeague, subscribeLeaderboard, inviteToLeague, startLeague, setLeagueEndTime,
  type League, type LeagueMember,
} from '../../lib/firestore/leagues';
import { RARITY_COLORS } from '../../lib/birdRarity';
import { BirdAvatar } from '../../components/ui/BirdAvatar';
import { BIRD_STYLES } from '../../lib/birdStyles';
import { AwardCeremony } from '../../components/league/AwardCeremony';

function timeRemaining(end: Date): string {
  const ms = end.getTime() - Date.now();
  if (ms <= 0) return 'Ended';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h left`;
  const mins = Math.floor((ms % 3600000) / 60000);
  return `${mins}m left`;
}

const MEDAL = ['🥇', '🥈', '🥉'];

export default function LeagueDetailScreen() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, isAdmin } = useAuthStore();

  const [league, setLeague] = useState<League | null>(null);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { router.back(); return true; });
    return () => sub.remove();
  }, []);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCeremony, setShowCeremony] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!id) return;
    getLeague(id).then((l) => {
      setLeague(l);
      setLoading(false);
    });

    unsubRef.current = subscribeLeaderboard(id, (m) => setMembers(m));
    return () => unsubRef.current?.();
  }, [id]);

  const isOwner = league?.createdBy === user?.uid;
  const myRank = members.findIndex((m) => m.userId === user?.uid) + 1;
  const myEntry = members.find((m) => m.userId === user?.uid);

  async function handleStart() {
    if (!id) return;
    await startLeague(id);
    setLeague((prev) => prev ? { ...prev, status: 'active' } : prev);
  }

  async function handleSet15s() {
    if (!id) return;
    await setLeagueEndTime(id, 15);
    setLeague((prev) => prev ? { ...prev, endDate: new Date(Date.now() + 15000) } : prev);
  }

  async function handleShare() {
    if (!league) return;
    await Share.share({ message: `Join my Bird League: "${league.name}" 🦅` });
  }

  if (loading || !league) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <ActivityIndicator color={c.primary} size="large" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color={c.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginHorizontal: 8 }}>
          <Text style={[s.title, { color: c.textPrimary }]} numberOfLines={1}>{league.name}</Text>
          <Text style={[s.subtitle, { color: league.status === 'active' ? c.primary : c.gray }]}>
            {league.status === 'lobby' ? 'Lobby · Waiting to start'
              : league.status === 'completed' ? 'Completed'
              : timeRemaining(league.endDate)}
          </Text>
        </View>
        <TouchableOpacity onPress={handleShare}>
          <Ionicons name="share-outline" size={22} color={c.primary} />
        </TouchableOpacity>
      </View>

      {/* My Stats Bar */}
      {myEntry && (
        <View style={[s.myBar, { backgroundColor: c.primary + '18', borderColor: c.primary + '40' }]}>
          <Text style={[s.myBarText, { color: c.primary }]}>
            Your rank: #{myRank} · {myEntry.points} pts · {myEntry.sightingCount} sighting{myEntry.sightingCount !== 1 ? 's' : ''}
          </Text>
          {league.status === 'completed' && myRank <= 3 && (
            <Text style={{ fontSize: 20 }}>{MEDAL[myRank - 1]}</Text>
          )}
        </View>
      )}

      <Text style={[s.sectionLabel, { color: c.gray }]}>LEADERBOARD</Text>

      <FlatList
        data={members}
        keyExtractor={(item) => item.userId}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          <Text style={[s.empty, { color: c.gray }]}>No members yet.</Text>
        }
        renderItem={({ item, index }) => {
          const birdStyle = BIRD_STYLES.find((b) => b.id === item.birdStyleId) ?? BIRD_STYLES[0];
          const isMe = item.userId === user?.uid;
          return (
            <TouchableOpacity
              style={[s.row, {
                borderBottomColor: c.border,
                backgroundColor: isMe ? c.primary + '10' : 'transparent',
              }]}
              onPress={() => router.push(isMe ? '/(tabs)/profile' : `/user/${item.userId}`)}
              activeOpacity={0.7}
            >
              <Text style={[s.rank, { color: index < 3 ? c.primary : c.gray }]}>
                {index < 3 ? MEDAL[index] : `#${index + 1}`}
              </Text>
              <BirdAvatar birdStyle={birdStyle} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={[s.name, { color: c.textPrimary }]}>
                  {item.displayName}{isMe ? ' (you)' : ''}
                </Text>
                <Text style={[s.sightings, { color: c.gray }]}>
                  {item.sightingCount} sighting{item.sightingCount !== 1 ? 's' : ''}
                </Text>
              </View>
              <Text style={[s.points, { color: c.primary }]}>{item.points}<Text style={[s.pts, { color: c.gray }]}> pts</Text></Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* Footer actions */}
      <View style={[s.footer, { borderTopColor: c.border, backgroundColor: c.surface }]}>
        {league.status === 'lobby' && isOwner && (
          <TouchableOpacity
            style={[s.footerBtn, { borderColor: c.border }]}
            onPress={() => router.push(`/league/${id}/invite`)}
          >
            <Ionicons name="person-add-outline" size={18} color={c.primary} />
            <Text style={[s.footerBtnText, { color: c.primary }]}>Invite</Text>
          </TouchableOpacity>
        )}
        {league.status === 'lobby' && isOwner && (
          <TouchableOpacity
            style={[s.footerBtn, { backgroundColor: c.primary, borderColor: c.primary, flex: 1 }]}
            onPress={handleStart}
          >
            <Ionicons name="play" size={18} color="#FFFFFF" />
            <Text style={[s.footerBtnText, { color: '#FFFFFF' }]}>Start League</Text>
          </TouchableOpacity>
        )}
        {league.status === 'active' && isAdmin && (
          <TouchableOpacity
            style={[s.footerBtn, { borderColor: c.border }]}
            onPress={handleSet15s}
          >
            <Ionicons name="timer-outline" size={18} color={c.gray} />
            <Text style={[s.footerBtnText, { color: c.gray }]}>15s</Text>
          </TouchableOpacity>
        )}
        {league.status === 'completed' && (
          <TouchableOpacity
            style={[s.footerBtn, { backgroundColor: c.primary, borderColor: c.primary, flex: 1 }]}
            onPress={() => setShowCeremony(true)}
          >
            <Ionicons name="trophy" size={18} color="#FFFFFF" />
            <Text style={[s.footerBtnText, { color: '#FFFFFF' }]}>Award Ceremony</Text>
          </TouchableOpacity>
        )}
      </View>

      <AwardCeremony
        visible={showCeremony}
        onClose={() => setShowCeremony(false)}
        members={members}
        myUserId={user?.uid ?? ''}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { fontSize: 13, fontWeight: '600', marginTop: 1 },
  myBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginBottom: 12, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  myBarText: { fontSize: 14, fontWeight: '700' },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, paddingHorizontal: 20, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
  rank: { width: 32, fontSize: 18, textAlign: 'center' },
  name: { fontSize: 15, fontWeight: '700' },
  sightings: { fontSize: 12, marginTop: 1 },
  points: { fontSize: 22, fontWeight: '800' },
  pts: { fontSize: 13, fontWeight: '400' },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 15 },
  footer: { flexDirection: 'row', gap: 10, padding: 12, borderTopWidth: 1 },
  footerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  footerBtnText: { fontSize: 14, fontWeight: '700' },
});
