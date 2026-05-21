import { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator, Share, BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import {
  getLeague, subscribeLeaderboard, startLeague, setLeagueEndTime,
  getLeagueSightings,
  type League, type LeagueMember, type LeagueSighting,
} from '../../lib/firestore/leagues';
import { BirdAvatar } from '../../components/ui/BirdAvatar';
import { BIRD_STYLES } from '../../lib/birdStyles';
import { LeaguePodium } from '../../components/league/LeaguePodium';

type DetailTab = 'members' | 'sightings';

function formatAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function timeRemaining(end: Date): string {
  const ms = end.getTime() - Date.now();
  if (ms <= 0) return 'Ended';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h left`;
  return `${Math.floor((ms % 3600000) / 60000)}m left`;
}

export default function LeagueDetailScreen() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, isAdmin } = useAuthStore();

  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailTab, setDetailTab] = useState<DetailTab>('members');
  const [sightings, setSightings] = useState<LeagueSighting[]>([]);
  const [sightingsLoading, setSightingsLoading] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { router.back(); return true; });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!id) return;
    getLeague(id).then((l) => { setLeague(l); setLoading(false); });
    unsubRef.current = subscribeLeaderboard(id, setMembers);
    return () => unsubRef.current?.();
  }, [id]);

  useEffect(() => {
    if (detailTab !== 'sightings' || sightings.length > 0 || !id) return;
    setSightingsLoading(true);
    getLeagueSightings(id).then((s) => { setSightings(s); setSightingsLoading(false); });
  }, [detailTab, id]);

  const isOwner = league?.createdBy === user?.uid;
  const myRank = members.findIndex((m) => m.userId === user?.uid) + 1;
  const myEntry = members.find((m) => m.userId === user?.uid);
  const memberMap = Object.fromEntries(members.map((m) => [m.userId, m.displayName]));
  const showPodium = (league?.status === 'active' || league?.status === 'completed') && members.length > 0;

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
    await Share.share({ message: `Join my Bird League: "${league.name}"` });
  }

  if (loading || !league) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <ActivityIndicator color={c.primary} size="large" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  const subtitleText = league.status === 'lobby' ? 'Lobby · Waiting to start'
    : league.status === 'completed' ? 'Completed'
    : timeRemaining(league.endDate);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color={c.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginHorizontal: 8 }}>
          <Text style={[s.title, { color: c.textPrimary }]} numberOfLines={1}>{league.name}</Text>
          <Text style={[s.subtitle, { color: league.status === 'active' ? c.primary : c.gray }]}>
            {subtitleText}
          </Text>
        </View>
        <TouchableOpacity onPress={handleShare}>
          <Ionicons name="share-outline" size={22} color={c.primary} />
        </TouchableOpacity>
      </View>

      {/* Podium — stable outside FlatList, animation only runs once on member load */}
      {showPodium && <LeaguePodium members={members} />}

      {/* Your standing bar — hidden in lobby (not yet started) */}
      {myEntry && league.status !== 'lobby' && (
        <View style={[s.myBar, { backgroundColor: c.primary + '18', borderColor: c.primary + '40' }]}>
          <View>
            <Text style={[s.myBarLabel, { color: c.primary }]}>YOUR STANDING</Text>
            <Text style={[s.myBarText, { color: c.primary }]}>
              #{myRank} · {myEntry.sightingCount} bird{myEntry.sightingCount !== 1 ? 's' : ''} · {myEntry.points} pts
            </Text>
          </View>
          <BirdAvatar
            birdStyle={BIRD_STYLES.find((b) => b.id === myEntry.birdStyleId) ?? BIRD_STYLES[0]}
            size={36}
          />
        </View>
      )}

      {/* Members / Sightings toggle */}
      <View style={[s.toggleRow, { backgroundColor: c.surface, borderColor: c.border }]}>
        {(['members', 'sightings'] as DetailTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[s.toggleBtn, detailTab === tab && { backgroundColor: c.primary }]}
            onPress={() => setDetailTab(tab)}
          >
            <Text style={[s.toggleText, { color: detailTab === tab ? '#FFFFFF' : c.gray }]}>
              {tab === 'members' ? 'Members' : 'Sightings'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {detailTab === 'members' ? (
        <FlatList
          data={members}
          keyExtractor={(item) => item.userId}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={<Text style={[s.empty, { color: c.gray }]}>No members yet.</Text>}
          renderItem={({ item, index }) => {
            const birdStyle = BIRD_STYLES.find((b) => b.id === item.birdStyleId) ?? BIRD_STYLES[0];
            const isMe = item.userId === user?.uid;
            const rankLabel = index < 3 ? ['1st', '2nd', '3rd'][index] : `#${index + 1}`;
            return (
              <TouchableOpacity
                style={[s.row, {
                  borderBottomColor: c.border,
                  backgroundColor: isMe ? c.primary + '10' : 'transparent',
                }]}
                onPress={() => router.push(isMe ? '/(tabs)/profile' : `/user/${item.userId}`)}
                activeOpacity={0.7}
              >
                <Text style={[s.rank, { color: index < 3 ? c.primary : c.gray }]}>{rankLabel}</Text>
                <BirdAvatar birdStyle={birdStyle} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.name, { color: c.textPrimary }]}>
                    {item.displayName}{isMe ? ' (you)' : ''}
                  </Text>
                  <Text style={[s.sightings, { color: c.gray }]}>
                    {item.sightingCount} bird{item.sightingCount !== 1 ? 's' : ''}
                  </Text>
                </View>
                <Text style={[s.points, { color: c.primary }]}>
                  {item.points}<Text style={[s.pts, { color: c.gray }]}> pts</Text>
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      ) : (
        <FlatList
          data={sightings}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            sightingsLoading
              ? <ActivityIndicator color={c.primary} style={{ marginTop: 40 }} />
              : <Text style={[s.empty, { color: c.gray }]}>No sightings yet.</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.sightingRow, { borderBottomColor: c.border, backgroundColor: c.surface }]}
              onPress={() => router.push(`/sighting/${item.sightingId}`)}
              activeOpacity={0.75}
            >
              {item.photoURL ? (
                <Image source={{ uri: item.photoURL }} style={s.sightingPhoto} resizeMode="cover" />
              ) : (
                <View style={[s.sightingPhotoPlaceholder, { backgroundColor: c.border }]}>
                  <Ionicons name="image-outline" size={22} color={c.gray} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={[s.sightingSpecies, { color: c.textPrimary }]} numberOfLines={1}>{item.species}</Text>
                <Text style={[s.sightingUser, { color: c.gray }]}>
                  {memberMap[item.userId] ? `@${memberMap[item.userId]}` : ''}
                </Text>
                <Text style={[s.sightingTime, { color: c.gray }]}>{formatAgo(item.timestamp)}</Text>
              </View>
              <Text style={[s.sightingPts, { color: c.primary }]}>
                {item.points}<Text style={[s.pts, { color: c.gray }]}> pts</Text>
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

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
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 18, fontFamily: 'Nunito_800ExtraBold' },
  subtitle: { fontSize: 13, fontFamily: 'Nunito_600SemiBold', marginTop: 1 },
  myBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginBottom: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  myBarLabel: { fontSize: 10, fontFamily: 'Nunito_700Bold', letterSpacing: 0.8, marginBottom: 2 },
  myBarText: { fontSize: 15, fontFamily: 'Nunito_700Bold' },
  toggleRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 4, borderWidth: 1 },
  toggleBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  toggleText: { fontSize: 13, fontFamily: 'Nunito_600SemiBold' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
  rank: { width: 36, fontSize: 13, fontFamily: 'Nunito_700Bold', textAlign: 'center' },
  name: { fontSize: 15, fontFamily: 'Nunito_700Bold' },
  sightings: { fontSize: 12, marginTop: 1 },
  points: { fontSize: 22, fontFamily: 'Nunito_800ExtraBold' },
  pts: { fontSize: 13, fontFamily: 'Nunito_400Regular' },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 15 },
  footer: { flexDirection: 'row', gap: 10, padding: 12, borderTopWidth: 1 },
  footerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  footerBtnText: { fontSize: 14, fontFamily: 'Nunito_700Bold' },
  sightingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
  sightingPhoto: { width: 52, height: 52, borderRadius: 8 },
  sightingPhotoPlaceholder: { width: 52, height: 52, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sightingSpecies: { fontSize: 15, fontFamily: 'Nunito_700Bold' },
  sightingUser: { fontSize: 12, marginTop: 1 },
  sightingTime: { fontSize: 12 },
  sightingPts: { fontSize: 18, fontFamily: 'Nunito_800ExtraBold' },
});
