import { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { getUserProfile, UserProfile } from '../../lib/firestore/users';
import { getUserSightings, Sighting } from '../../lib/firestore/sightings';
import { getConnectionStatus, sendFriendRequest, acceptFriendRequest, removeFriend, Connection } from '../../lib/firestore/friends';
import { BirdAvatar, BIRD_STYLES } from '../../components/ui/BirdAvatar';
import { StatCard } from '../../components/ui/StatCard';
import { BadgeIcon, BADGES } from '../../components/ui/BadgeIcon';
import { SightingCard } from '../../components/ui/SightingCard';

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
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { router.back(); return true; });
    return () => sub.remove();
  }, []);

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

  const isPendingReceived = connection?.status === 'pending' && connection?.direction === 'received';
  const isPendingSent = connection?.status === 'pending' && connection?.direction === 'sent';
  const isAccepted = connection?.status === 'accepted';

  const firstSightingIds = useMemo(() => {
    const map = new Map<string, string>();
    sightings.forEach(s => map.set(s.commonName, s.id));
    return new Set(map.values());
  }, [sightings]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <View style={[s.navHeader, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
            <Ionicons name="chevron-back" size={28} color={c.primary} />
          </TouchableOpacity>
          <Text style={[s.navTitle, { color: c.textPrimary }]}>Profile</Text>
          <View style={{ width: 40 }} />
        </View>
        <ActivityIndicator color={c.primary} size="large" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  const birdStyleId = (profile as unknown as Record<string, string>)?.birdStyleId ?? 'waxwing';
  const birdStyle = BIRD_STYLES.find(b => b.id === birdStyleId) ?? BIRD_STYLES[0];
  const bigYear = profile?.yearSpecies?.[year]?.length ?? 0;
  const lifeList = [...new Set(Object.values(profile?.yearSpecies ?? {}).flat())].sort();
  const earnedBadges = BADGES.filter((b) => b.check(profile));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <View style={[s.navHeader, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="chevron-back" size={28} color={c.primary} />
        </TouchableOpacity>
        <Text style={[s.navTitle, { color: c.textPrimary }]}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        {/* Profile block */}
        <View style={[s.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
          <BirdAvatar birdStyle={birdStyle} size={64} />
          <View style={{ flex: 1 }}>
            <Text style={[s.displayName, { color: c.textPrimary }]}>{profile?.displayName ?? 'Birder'}</Text>
            <Text style={[s.username, { color: c.gray }]} numberOfLines={1}>@{profile?.username}</Text>
            {profile?.bio ? <Text style={[s.bio, { color: c.gray }]}>{profile.bio}</Text> : null}
          </View>
        </View>

        {/* Friend button */}
        {isPendingReceived ? (
          <View style={s.friendBtnRow}>
            <TouchableOpacity
              style={[s.friendBtn, { flex: 1, backgroundColor: c.accent }]}
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
              { margin: 16 },
              isAccepted
                ? { backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.primary }
                : isPendingSent
                  ? { backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.border }
                  : { backgroundColor: c.accent },
            ]}
            onPress={() => handleFriendAction()}
            disabled={actionLoading || isPendingSent}
          >
            {actionLoading
              ? <ActivityIndicator color={isAccepted ? c.primary : '#FFFFFF'} size="small" />
              : <Text style={[s.friendBtnText, {
                  color: isAccepted ? c.primary : isPendingSent ? c.gray : '#FFFFFF',
                }]}>
                  {isAccepted ? 'Friends ✓' : isPendingSent ? 'Request Sent' : 'Add Friend'}
                </Text>}
          </TouchableOpacity>
        )}

        {/* Stats */}
        <View style={s.statsRow}>
          <StatCard label="Total Birds" value={profile?.totalSightings ?? 0} />
          <StatCard label="Species" value={profile?.totalSpecies ?? 0} />
          <StatCard label={`${year} Big Year`} value={bigYear} accent />
          <StatCard label="States" value={profile?.statesVisited?.length ?? 0} />
        </View>

        {/* Badges */}
        {earnedBadges.length > 0 && (
          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: c.textPrimary }]}>Badges</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}>
              {earnedBadges.map((b) => <BadgeIcon key={b.id} badge={b} />)}
            </ScrollView>
          </View>
        )}

        {/* Life List */}
        <View style={s.section}>
          <TouchableOpacity style={s.sectionHeader} onPress={() => setLifeListExpanded((v) => !v)}>
            <Text style={[s.sectionTitle, { color: c.textPrimary }]}>Life List ({lifeList.length})</Text>
            <Text style={{ color: c.gray, fontSize: 14 }}>{lifeListExpanded ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {lifeListExpanded && (
            <View style={s.lifeListGrid}>
              {lifeList.map((species) => (
                <View key={species} style={[s.lifeListChip, { backgroundColor: c.primary + '12', borderColor: c.border }]}>
                  <View style={[s.chipDot, { backgroundColor: c.primary }]} />
                  <Text style={[s.chipText, { color: c.textPrimary }]} numberOfLines={1}>{species}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Recent Sightings */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: c.textPrimary }]}>Recent Sightings</Text>
          {sightings.length === 0 ? (
            <Text style={{ fontSize: 14, color: c.gray, marginTop: 8 }}>No sightings yet.</Text>
          ) : (
            sightings.map((sig) => (
              <SightingCard
                key={sig.id}
                sighting={sig}
                isFirst={firstSightingIds.has(sig.id)}
                onPress={() => router.push(`/sighting/${sig.id}`)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  navHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  navTitle: { fontSize: 17, fontFamily: 'Nunito_700Bold' },
  backBtn: { width: 40, alignItems: 'flex-start' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, padding: 20, borderBottomWidth: 1 },
  displayName: { fontSize: 20, fontFamily: 'Nunito_800ExtraBold' },
  username: { fontSize: 14, marginTop: 2 },
  bio: { fontSize: 13, marginTop: 4 },
  friendBtnRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginVertical: 12 },
  friendBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  friendBtnText: { fontSize: 15, fontFamily: 'Nunito_700Bold' },
  statsRow: { flexDirection: 'row', gap: 10, padding: 16, flexWrap: 'wrap' },
  section: { marginTop: 16, paddingHorizontal: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontFamily: 'Nunito_700Bold', marginBottom: 12 },
  lifeListGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  lifeListChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '48%',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 13, fontFamily: 'Nunito_600SemiBold', flex: 1 },
});
