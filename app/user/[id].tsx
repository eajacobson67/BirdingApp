import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../store/authStore';
import { getUserProfile, UserProfile } from '../../lib/firestore/users';
import { getUserSightings, Sighting } from '../../lib/firestore/sightings';
import {
  getConnectionStatus,
  sendFriendRequest,
  acceptFriendRequest,
  removeFriend,
  Connection,
} from '../../lib/firestore/friends';
import { StatCard } from '../../components/ui/StatCard';
import { BadgeIcon, BADGES } from '../../components/ui/BadgeIcon';

export default function UserProfileScreen() {
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
    Promise.all([
      getUserProfile(id),
      getUserSightings(id, 20),
      getConnectionStatus(user.uid, id),
    ]).then(([p, s, c]) => {
      setProfile(p);
      setSightings(s);
      setConnection(c);
      setLoading(false);
    });
  }, [id, user]);

  async function handleFriendAction() {
    if (!user || !id) return;
    setActionLoading(true);
    try {
      if (!connection) {
        await sendFriendRequest(user.uid, id);
        setConnection({ status: 'pending', since: new Date(), direction: 'sent' });
        Alert.alert('Request sent!', `Friend request sent to ${profile?.displayName}.`);
      } else if (connection.status === 'pending' && connection.direction === 'received') {
        await acceptFriendRequest(user.uid, id);
        setConnection({ status: 'accepted', since: new Date() });
      } else if (connection.status === 'accepted') {
        await removeFriend(user.uid, id);
        setConnection(null);
      }
    } catch (e: unknown) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setActionLoading(false);
    }
  }

  function friendButtonLabel(): string {
    if (!connection) return 'Add Friend';
    if (connection.status === 'pending' && connection.direction === 'sent') return 'Request Sent';
    if (connection.status === 'pending' && connection.direction === 'received') return 'Accept Request';
    return 'Friends ✓';
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={Colors.brown} size="large" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  const bigYear = profile?.yearSpecies?.[year]?.length ?? 0;
  const lifeList = [...new Set(Object.values(profile?.yearSpecies ?? {}).flat())].sort();
  const earnedBadges = BADGES.filter((b) => b.check(profile));

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarEmoji}>🐦</Text>
          </View>
          <View style={styles.headerMeta}>
            <Text style={styles.displayName}>{profile?.displayName ?? 'Birder'}</Text>
            <Text style={styles.username}>@{profile?.username}</Text>
            {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.friendBtn,
            connection?.status === 'accepted' && styles.friendBtnActive,
          ]}
          onPress={handleFriendAction}
          disabled={actionLoading || connection?.direction === 'sent'}
        >
          {actionLoading ? (
            <ActivityIndicator color={Colors.black} size="small" />
          ) : (
            <Text style={styles.friendBtnText}>{friendButtonLabel()}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.statsRow}>
          <StatCard label="Total Birds" value={profile?.totalSightings ?? 0} />
          <StatCard label="Species" value={profile?.totalSpecies ?? 0} />
          <StatCard label={`${year} Big Year`} value={bigYear} accent />
          <StatCard label="States" value={profile?.statesVisited?.length ?? 0} />
        </View>

        {earnedBadges.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Badges</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}>
              {earnedBadges.map((b) => <BadgeIcon key={b.id} badge={b} />)}
            </ScrollView>
          </View>
        )}

        <View style={styles.section}>
          <TouchableOpacity style={styles.sectionHeader} onPress={() => setLifeListExpanded((v) => !v)}>
            <Text style={styles.sectionTitle}>Life List ({lifeList.length})</Text>
            <Text style={styles.expandIcon}>{lifeListExpanded ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {lifeListExpanded && lifeList.map((species) => (
            <Text key={species} style={styles.lifeListItem}>• {species}</Text>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Sightings</Text>
          {sightings.map((s) => (
            <TouchableOpacity key={s.id} style={styles.sightingRow} onPress={() => router.push(`/sighting/${s.id}`)}>
              <View>
                <Text style={styles.sightingSpecies}>{s.commonName}</Text>
                <Text style={styles.sightingMeta}>{s.locationName} · {formatAgo(s.timestamp)}</Text>
              </View>
              <Text style={styles.arrow}>›</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', gap: 16, padding: 20, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.cream, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  avatarEmoji: { fontSize: 32 },
  headerMeta: { flex: 1 },
  displayName: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  username: { fontSize: 14, color: Colors.gray, marginTop: 2 },
  bio: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  friendBtn: { margin: 16, backgroundColor: Colors.yellow, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  friendBtnActive: { backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.brown },
  friendBtnText: { fontSize: 15, fontWeight: '700', color: Colors.black },
  statsRow: { flexDirection: 'row', gap: 10, padding: 16, flexWrap: 'wrap' },
  section: { marginTop: 16, paddingHorizontal: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 12 },
  expandIcon: { color: Colors.gray, fontSize: 14 },
  lifeListItem: { fontSize: 14, color: Colors.textPrimary, paddingVertical: 4 },
  sightingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sightingSpecies: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  sightingMeta: { fontSize: 13, color: Colors.gray, marginTop: 2 },
  arrow: { fontSize: 20, color: Colors.gray },
});
