import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { seedFakeData } from '../../lib/seedData';
import { BirdAvatar, BIRD_STYLES, BirdStyle } from '../../components/ui/BirdAvatar';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useThemeStore, useColors } from '../../store/themeStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import { getUserProfile, UserProfile } from '../../lib/firestore/users';
import { getUserSightings, Sighting } from '../../lib/firestore/sightings';
import { StatCard } from '../../components/ui/StatCard';
import { BadgeIcon, BADGES } from '../../components/ui/BadgeIcon';

export default function ProfileScreen() {
  const c = useColors();
  const { user, isAdmin } = useAuthStore();
  const setBirdStyle = useThemeStore((s) => s.setBirdStyle);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [loading, setLoading] = useState(true);
  const [lifeListExpanded, setLifeListExpanded] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [birdStyleId, setBirdStyleId] = useState('waxwing');

  const year = new Date().getFullYear().toString();

  useEffect(() => {
    if (!user) return;
    Promise.all([getUserProfile(user.uid), getUserSightings(user.uid, 100)])
      .then(([p, s]) => {
        setProfile(p);
        setSightings(s);
        if ((p as unknown as Record<string, string>)?.birdStyleId) {
          setBirdStyleId((p as unknown as Record<string, string>).birdStyleId);
        }
      })
      .finally(() => setLoading(false));
  }, [user]);

  async function saveBirdStyle(style: BirdStyle) {
    if (!user) return;
    setBirdStyleId(style.id);
    setBirdStyle(style.id);
    setPickerVisible(false);
    await updateDoc(doc(db, 'users', user.uid), { birdStyleId: style.id });
  }

  async function handleSignOut() {
    try {
      await signOut(auth);
      router.replace('/(auth)/login');
    } catch (e: unknown) {
      Alert.alert('Error', (e as Error).message);
    }
  }

  async function handleSeedData() {
    if (!user) return;
    Alert.alert(
      'Seed Test Data',
      'This will create 10 fake birder accounts and add 5 of them as your friends. Run once for testing.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Seed',
          onPress: async () => {
            try {
              await seedFakeData(user.uid);
              Alert.alert('Done!', '10 fake birders added. Check your map, leaderboard, and friends tabs.');
            } catch (e: unknown) {
              Alert.alert('Error', (e as Error).message);
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
        <ActivityIndicator color={c.primary} size="large" style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  const bigYear = profile?.yearSpecies?.[year]?.length ?? 0;
  const lifeList = [...new Set(Object.values(profile?.yearSpecies ?? {}).flat())].sort();
  const earnedBadges = BADGES.filter((b) => b.check(profile));

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        {/* Header */}
        <View style={[s.header, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={() => setPickerVisible(true)}>
            <BirdAvatar
              birdStyle={BIRD_STYLES.find((b) => b.id === birdStyleId) ?? BIRD_STYLES[0]}
              size={64}
            />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.displayName, { color: c.textPrimary }]}>{profile?.displayName ?? 'Birder'}</Text>
            <Text style={[s.username, { color: c.gray }]}>@{profile?.username}</Text>
            {profile?.bio ? <Text style={[s.bio, { color: c.gray }]}>{profile.bio}</Text> : null}
          </View>
          <TouchableOpacity onPress={handleSignOut} style={s.signOutBtn}>
            <Text style={[s.signOutText, { color: c.danger }]}>Sign out</Text>
          </TouchableOpacity>
        </View>

        {/* Bird avatar picker */}
        <Modal visible={pickerVisible} transparent animationType="slide">
          <View style={s.overlay}>
            <View style={[s.pickerSheet, { backgroundColor: c.surface }]}>
              <Text style={[s.pickerTitle, { color: c.textPrimary }]}>Choose your bird</Text>
              <ScrollView contentContainerStyle={s.pickerGrid} showsVerticalScrollIndicator={false}>
                {BIRD_STYLES.map((b) => (
                  <TouchableOpacity
                    key={b.id}
                    style={[s.pickerItem, { backgroundColor: c.background, borderColor: b.id === birdStyleId ? c.primary : 'transparent' }]}
                    onPress={() => saveBirdStyle(b)}
                  >
                    <BirdAvatar birdStyle={b} size={56} />
                    <Text style={[s.pickerLabel, { color: c.gray }]}>{b.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Text style={[s.pickerCancel, { color: c.gray }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

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
              {earnedBadges.map((b) => (
                <BadgeIcon key={b.id} badge={b} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Life List */}
        <View style={s.section}>
          <TouchableOpacity
            style={s.sectionHeader}
            onPress={() => setLifeListExpanded((v) => !v)}
          >
            <Text style={[s.sectionTitle, { color: c.textPrimary }]}>Life List ({lifeList.length})</Text>
            <Text style={[s.expandIcon, { color: c.gray }]}>{lifeListExpanded ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {lifeListExpanded &&
            lifeList.map((species) => (
              <Text key={species} style={[s.lifeListItem, { color: c.textPrimary }]}>• {species}</Text>
            ))}
        </View>

        {/* Admin: Seed Test Data */}
        {isAdmin && (
          <View style={[s.section, { marginTop: 32 }]}>
            <TouchableOpacity style={[s.seedBtn, { borderColor: c.border }]} onPress={handleSeedData}>
              <Text style={[s.seedBtnText, { color: c.gray }]}>Seed Test Data</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Recent Sightings */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: c.textPrimary }]}>Recent Sightings</Text>
          {sightings.slice(0, 10).map((sig) => (
            <TouchableOpacity
              key={sig.id}
              style={[s.sightingRow, { borderBottomColor: c.border }]}
              onPress={() => router.push(`/sighting/${sig.id}`)}
            >
              <View>
                <Text style={[s.sightingSpecies, { color: c.textPrimary }]}>{sig.commonName}</Text>
                <Text style={[s.sightingMeta, { color: c.gray }]}>{sig.locationName} · {formatAgo(sig.timestamp)}</Text>
              </View>
              <Text style={[s.arrow, { color: c.gray }]}>›</Text>
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
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    padding: 20,
    borderBottomWidth: 1,
  },
  displayName: { fontSize: 20, fontWeight: '800' },
  username: { fontSize: 14, marginTop: 2 },
  bio: { fontSize: 13, marginTop: 4, maxWidth: 180 },
  signOutBtn: { marginLeft: 'auto' },
  signOutText: { fontSize: 13 },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    flexWrap: 'wrap',
  },
  section: { marginTop: 16, paddingHorizontal: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  expandIcon: { fontSize: 14 },
  lifeListItem: { fontSize: 14, paddingVertical: 4 },
  sightingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  sightingSpecies: { fontSize: 15, fontWeight: '600' },
  sightingMeta: { fontSize: 13, marginTop: 2 },
  arrow: { fontSize: 20 },
  seedBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  seedBtnText: { fontSize: 13, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  pickerSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  pickerTitle: { fontSize: 18, fontWeight: '800', marginBottom: 20, textAlign: 'center' },
  pickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', paddingBottom: 8 },
  pickerItem: {
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 14,
    borderWidth: 2,
  },
  pickerLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center', maxWidth: 90 },
  pickerCancel: { textAlign: 'center', paddingVertical: 16, fontSize: 15 },
});
