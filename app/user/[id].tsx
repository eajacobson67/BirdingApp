import { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useColors } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { getUserProfile, UserProfile } from '../../lib/firestore/users';
import { getUserSightings, Sighting } from '../../lib/firestore/sightings';
import { getConnectionStatus, sendFriendRequest, acceptFriendRequest, removeFriend, Connection } from '../../lib/firestore/friends';
import { StatCard } from '../../components/ui/StatCard';
import { BadgeIcon, BADGES } from '../../components/ui/BadgeIcon';

export default function UserProfileScreen() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [lifeListExpanded, setLifeListExpanded] = useState(false);
  const year = new Date().getFullYear().toString();

  useEffect(() => {
    if (!id || !user) return;
    Promise.all([getUserProfile(id), getUserSightings(id, 20), getConnectionStatus(user.uid, id)])
      .then(([p, s, conn]) => { setProfile(p); setSightings(s); setConnection(conn); setLoading(false); });
  }, [id, user]);

  async function handleFriendAction(accept?: boolean) {
    if (!user || !id) return;
    setActionLoading(true);
    try {
      if (!connection) {
        await sendFriendRequest(user.uid, id);
        setConnection({ status: 'pending', since: new Date(), direction: 'sent' });
        Alert.alert('Request sent!', `Friend request sent to ${profile?.displayName}.`);
      } else if (connection.status === 'pending' && connection.direction === 'received') {
        if (accept) {
          await acceptFriendRequest(user.uid, id);
          setConnection({ status: 'accepted', since: new Date() });
        } else {
          await removeFriend(user.uid, id);
          setConnection(null);
        }
      } else if (connection.status === 'accepted') {
        await removeFriend(user.uid, id);
        setConnection(null);
      }
    } catch (e: unknown) {
      Alert.alert('Error', (e as Error).message);
    } finally { setActionLoading(false); }
  }

  function friendButtonLabel(): string {
    if (!connection) return 'Add Friend';
    if (connection.status === 'pending' && connection.direction === 'sent') return 'Request Sent';
    return 'Friends ✓';
  }

  const isPendingReceived = connection?.status === 'pending' && connection?.direction === 'received';

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <ActivityIndicator color={c.primary} size="large" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  const bigYear = profile?.yearSpecies?.[year]?.length ?? 0;
  const lifeList = [...new Set(Object.values(profile?.yearSpecies ?? {}).flat())].sort();
  const earnedBadges = BADGES.filter((b) => b.check(profile));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <View style={[s.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
          <View style={[s.avatar, { backgroundColor: c.background, borderColor: c.border }]}>
            <Text style={s.avatarEmoji}>🐦</Text>
          </View>
          <View style={s.headerMeta}>
            <Text style={[s.displayName, { color: c.textPrimary }]}>{profile?.displayName ?? 'Birder'}</Text>
            <Text style={[s.username, { color: c.gray }]}>@{profile?.username}</Text>
            {profile?.bio ? <Text style={[s.bio, { color: c.gray }]}>{profile.bio}</Text> : null}
          </View>
        </View>

        {isPendingReceived ? (
          <View style={s.friendBtnRow}>
            <TouchableOpacity
              style={[s.friendBtn, { flex: 1, backgroundColor: c.primary }]}
              onPress={() => handleFriendAction(true)}
              disabled={actionLoading}
            >
              {actionLoading
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : <Text style={[s.friendBtnText, { color: '#FFFFFF' }]}>Accept</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.friendBtn, { flex: 1, backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.border }]}
              onPress={() => handleFriendAction(false)}
              disabled={actionLoading}
            >
              <Text style={[s.friendBtnText, { color: c.gray }]}>Decline</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              s.friendBtn,
              { margin: 16, backgroundColor: connection?.status === 'accepted' ? c.surface : c.accent },
              connection?.status === 'accepted' && { borderWidth: 1.5, borderColor: c.primary },
            ]}
            onPress={() => handleFriendAction()}
            disabled={actionLoading || connection?.direction === 'sent'}
          >
            {actionLoading
              ? <ActivityIndicator color={c.black} size="small" />
              : <Text style={[s.friendBtnText, { color: c.black }]}>{friendButtonLabel()}</Text>}
          </TouchableOpacity>
        )}

        <View style={s.statsRow}>
          <StatCard label="Total Birds" value={profile?.totalSightings ?? 0} />
          <StatCard label="Species" value={profile?.totalSpecies ?? 0} />
          <StatCard label={`${year} Big Year`} value={bigYear} accent />
          <StatCard label="States" value={profile?.statesVisited?.length ?? 0} />
        </View>

        {earnedBadges.length > 0 && (
          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: c.textPrimary }]}>Badges</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}>
              {earnedBadges.map((b) => <BadgeIcon key={b.id} badge={b} />)}
            </ScrollView>
          </View>
        )}

        <View style={s.section}>
          <TouchableOpacity style={s.sectionHeader} onPress={() => setLifeListExpanded((v) => !v)}>
            <Text style={[s.sectionTitle, { color: c.textPrimary }]}>Life List ({lifeList.length})</Text>
            <Text style={{ color: c.gray, fontSize: 14 }}>{lifeListExpanded ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {lifeListExpanded && lifeList.map((species) => (
            <Text key={species} style={[s.lifeListItem, { color: c.textPrimary }]}>• {species}</Text>
          ))}
        </View>

        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: c.textPrimary }]}>Recent Sightings</Text>
          {sightings.map((sig) => (
            <TouchableOpacity key={sig.id} style={[s.sightingRow, { borderBottomColor: c.border }]} onPress={() => router.push(`/sighting/${sig.id}`)}>
              <View>
                <Text style={[s.sightingSpecies, { color: c.textPrimary }]}>{sig.commonName}</Text>
                <Text style={[s.sightingMeta, { color: c.gray }]}>{sig.locationName} · {formatAgo(sig.timestamp)}</Text>
              </View>
              <Text style={{ fontSize: 20, color: c.gray }}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function formatAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', gap: 16, padding: 20, borderBottomWidth: 1 },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatarEmoji: { fontSize: 32 },
  headerMeta: { flex: 1 },
  displayName: { fontSize: 20, fontWeight: '800' },
  username: { fontSize: 14, marginTop: 2 },
  bio: { fontSize: 13, marginTop: 4 },
  friendBtnRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginVertical: 8 },
  friendBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  friendBtnText: { fontSize: 15, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 10, padding: 16, flexWrap: 'wrap' },
  section: { marginTop: 16, paddingHorizontal: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  lifeListItem: { fontSize: 14, paddingVertical: 4 },
  sightingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1 },
  sightingSpecies: { fontSize: 15, fontWeight: '600' },
  sightingMeta: { fontSize: 13, marginTop: 2 },
});
