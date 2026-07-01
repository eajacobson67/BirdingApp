import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  BackHandler,
} from 'react-native';
import { BirdAvatar, BIRD_STYLES, BirdStyle } from '../../components/ui/BirdAvatar';
import { DEFAULT_BIRD_ID } from '../../lib/birdStyles';
import { Avatar } from '../../components/ui/Avatar';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useThemeStore, useColors } from '../../store/themeStore';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useAuthStore } from '../../store/authStore';
import { getUserProfile, UserProfile } from '../../lib/firestore/users';
import { getUserSightings, Sighting } from '../../lib/firestore/sightings';
import { getFriendsLeaderboard } from '../../lib/firestore/friends';
import { getUserLeaguePlacements } from '../../lib/firestore/leagues';
import { StatCard } from '../../components/ui/StatCard';
import { BadgeIcon, BADGES } from '../../components/ui/BadgeIcon';
import { SightingCard } from '../../components/ui/SightingCard';

export default function ProfileScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const setBirdStyle = useThemeStore((s) => s.setBirdStyle);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [lifeListExpanded, setLifeListExpanded] = useState(false);
  const [friendsExpanded, setFriendsExpanded] = useState(false);
  const [sightingsExpanded, setSightingsExpanded] = useState(false);
  const [leaguePlacements, setLeaguePlacements] = useState<{ total: number; first: number; second: number; third: number } | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [birdStyleId, setBirdStyleId] = useState(DEFAULT_BIRD_ID);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');

  const year = new Date().getFullYear().toString();

  const availableBirds = useMemo(() => {
    const unlocked = new Set([DEFAULT_BIRD_ID, ...(profile?.unlockedBirds ?? [])]);
    return BIRD_STYLES.filter((b) => unlocked.has(b.id));
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    getUserLeaguePlacements(user.uid).then(setLeaguePlacements).catch(() => {});
    Promise.all([
      getUserProfile(user.uid),
      getUserSightings(user.uid, 200),
      getFriendsLeaderboard(user.uid),
    ]).then(([p, s, f]) => {
      setProfile(p);
      setSightings(s);
      setFriends(f);
      if ((p as unknown as Record<string, string>)?.birdStyleId) {
        setBirdStyleId((p as unknown as Record<string, string>).birdStyleId);
      }
    }).finally(() => setLoading(false));
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      getUserProfile(user.uid).then((p) => setProfile(p));
    }, [user]),
  );

  useEffect(() => {
    if (!pickerVisible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setPickerVisible(false);
      return true;
    });
    return () => sub.remove();
  }, [pickerVisible]);

  async function saveBirdStyle(style: BirdStyle) {
    if (!user) return;
    setBirdStyleId(style.id);
    setBirdStyle(style.id);
    setPickerVisible(false);
    await updateDoc(doc(db, 'users', user.uid), { birdStyleId: style.id });
  }

  async function saveDisplayName() {
    const name = draftName.trim();
    setEditingName(false);
    if (!user || !name || name === profile?.displayName) return;
    setProfile(prev => prev ? { ...prev, displayName: name } : prev);
    await updateDoc(doc(db, 'users', user.uid), { displayName: name });
  }

  async function handleSignOut() {
    try {
      await signOut(auth);
      router.replace('/(auth)/login');
    } catch (e: unknown) {
      Alert.alert('Error', (e as Error).message);
    }
  }

  const firstSightingIds = useMemo(() => {
    const map = new Map<string, string>();
    sightings.forEach(s => map.set(s.commonName, s.id));
    return new Set(map.values());
  }, [sightings]);

  const speciesCount = useMemo(() => {
    const map = new Map<string, number>();
    sightings.forEach(s => map.set(s.commonName, (map.get(s.commonName) ?? 0) + 1));
    return map;
  }, [sightings]);

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
        <View style={[s.header, { backgroundColor: c.surface, borderBottomColor: c.border, alignItems: 'center' }]}>
          <TouchableOpacity onPress={() => setPickerVisible(true)}>
            <BirdAvatar
              birdStyle={BIRD_STYLES.find((b) => b.id === birdStyleId) ?? BIRD_STYLES[0]}
              size={64}
            />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            {editingName ? (
              <TextInput
                value={draftName}
                onChangeText={setDraftName}
                onBlur={saveDisplayName}
                onSubmitEditing={saveDisplayName}
                autoFocus
                maxLength={15}
                style={[s.displayNameInput, { color: c.textPrimary, borderColor: c.primary }]}
              />
            ) : (
              <TouchableOpacity
                onPress={() => { setDraftName(profile?.displayName ?? ''); setEditingName(true); }}
                style={s.nameRow}
              >
                <Text style={[s.displayName, { color: c.textPrimary }]}>{profile?.displayName ?? 'Birder'}</Text>
                <Text style={[s.editHint, { color: c.gray }]}>✎</Text>
              </TouchableOpacity>
            )}
            <Text style={[s.username, { color: c.gray }]} numberOfLines={1}>@{profile?.username}</Text>
            {profile?.bio ? <Text style={[s.bio, { color: c.gray }]}>{profile.bio}</Text> : null}
          </View>
          <TouchableOpacity
            onPress={handleSignOut}
            style={[s.signOutBtn, { backgroundColor: c.danger + '18', borderColor: c.danger + '55' }]}
          >
            <Text style={[s.signOutText, { color: c.danger }]}>Sign out</Text>
          </TouchableOpacity>
        </View>

        {/* Bird avatar picker */}
        <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={() => setPickerVisible(false)}>
          <View style={s.overlay}>
            <View style={[s.pickerSheet, { backgroundColor: c.surface, paddingBottom: 24 + insets.bottom }]}>
              <Text style={[s.pickerTitle, { color: c.textPrimary }]}>Choose your bird</Text>
              <ScrollView contentContainerStyle={s.pickerGrid} showsVerticalScrollIndicator={false}>
                {availableBirds.map((b) => (
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
          <StatCard label="League 1st" value={leaguePlacements?.first ?? '—'} />
          <StatCard label="League 2nd" value={leaguePlacements?.second ?? '—'} />
          <StatCard label="League 3rd" value={leaguePlacements?.third ?? '—'} />
        </View>

        {/* Badges */}
        {earnedBadges.length > 0 && (
          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: c.textPrimary, marginBottom: 12 }]}>Badges</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {earnedBadges.map((b) => (
                <BadgeIcon key={b.id} badge={b} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Find Friends */}
        <TouchableOpacity
          style={[s.findFriendsBtn, { backgroundColor: c.accent }]}
          onPress={() => router.push('/friends/search')}
        >
          <Text style={s.findFriendsBtnText}>+ Find Friends</Text>
        </TouchableOpacity>

        {/* Friends */}
        <View style={[s.section, s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <TouchableOpacity style={s.sectionHeader} onPress={() => setFriendsExpanded(v => !v)}>
            <Text style={[s.sectionTitle, { color: c.textPrimary, marginBottom: 0 }]}>
              Friends ({friends.length})
            </Text>
            <Text style={[s.expandIcon, { color: c.gray }]}>{friendsExpanded ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {friendsExpanded && (
            <View style={[s.expandedContent, { borderTopColor: c.border }]}>
              {friends.length === 0
                ? <Text style={[s.empty, { color: c.gray }]}>No friends yet — find some!</Text>
                : friends.map(f => (
                    <TouchableOpacity
                      key={f.uid}
                      style={[s.friendRow, { borderBottomColor: c.border }]}
                      onPress={() => router.push(`/user/${f.uid}`)}
                      activeOpacity={0.7}
                    >
                      <Avatar photoURL={f.photoURL} birdStyleId={f.birdStyleId} size={38} />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.friendName, { color: c.textPrimary }]}>{f.displayName}</Text>
                        <Text style={[s.friendUsername, { color: c.gray }]} numberOfLines={1}>@{f.username}</Text>
                      </View>
                      <Text style={[s.friendSpecies, { color: c.primary }]}>{f.totalSpecies} sp</Text>
                    </TouchableOpacity>
                  ))
              }
            </View>
          )}
        </View>

        {/* Life List */}
        <View style={[s.section, s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <TouchableOpacity style={s.sectionHeader} onPress={() => setLifeListExpanded(v => !v)}>
            <Text style={[s.sectionTitle, { color: c.textPrimary, marginBottom: 0 }]}>
              Life List ({lifeList.length})
            </Text>
            <Text style={[s.expandIcon, { color: c.gray }]}>{lifeListExpanded ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {lifeListExpanded && (
            <View style={[s.expandedContent, { borderTopColor: c.border }]}>
              <View style={s.lifeListGrid}>
                {lifeList.map((species) => (
                  <View key={species} style={[s.lifeListChip, { backgroundColor: c.primary + '12', borderColor: c.border }]}>
                    <Text style={[s.chipText, { color: c.textPrimary }]} numberOfLines={1}>{species}</Text>
                    <Text style={[s.chipCount, { color: c.primary }]}>×{speciesCount.get(species) ?? 0}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Recent Sightings */}
        <View style={[s.section, s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <TouchableOpacity style={s.sectionHeader} onPress={() => setSightingsExpanded(v => !v)}>
            <Text style={[s.sectionTitle, { color: c.textPrimary, marginBottom: 0 }]}>
              Recent Sightings ({sightings.length})
            </Text>
            <Text style={[s.expandIcon, { color: c.gray }]}>{sightingsExpanded ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {sightingsExpanded && (
            <View style={[s.expandedContent, { borderTopColor: c.border }]}>
              {sightings.length === 0 ? (
                <Text style={[s.empty, { color: c.gray }]}>No sightings yet.</Text>
              ) : (
                sightings.slice(0, 10).map((sig) => (
                  <SightingCard
                    key={sig.id}
                    sighting={sig}
                    isFirst={firstSightingIds.has(sig.id)}
                    onPress={() => router.push(`/sighting/${sig.id}`)}
                  />
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    borderBottomWidth: 1,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  displayName: { fontSize: 20, fontFamily: 'Nunito_800ExtraBold' },
  displayNameInput: {
    fontSize: 20,
    fontFamily: 'Nunito_800ExtraBold',
    borderBottomWidth: 2,
    paddingVertical: 2,
    paddingHorizontal: 0,
    marginBottom: 2,
  },
  editHint: { fontSize: 16, marginTop: 2 },
  username: { fontSize: 14, marginTop: 2 },
  bio: { fontSize: 13, marginTop: 4, maxWidth: 180 },
  signOutBtn: {
    marginLeft: 'auto',
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  signOutText: { fontSize: 13, fontFamily: 'Nunito_600SemiBold' },
  statsRow: { flexDirection: 'row', gap: 10, padding: 16, flexWrap: 'wrap' },
  section: { marginTop: 12, marginHorizontal: 16 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, overflow: 'hidden' },
  findFriendsBtn: {
    marginHorizontal: 16, marginTop: 12,
    borderRadius: 12, paddingVertical: 14,
    alignItems: 'center',
  },
  findFriendsBtnText: { fontSize: 15, fontFamily: 'Nunito_700Bold', color: '#FFFFFF' },
  expandedContent: { marginTop: 12, borderTopWidth: 1, paddingTop: 12 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 17, fontFamily: 'Nunito_700Bold', marginBottom: 0 },
  expandIcon: { fontSize: 14 },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  friendName: { fontSize: 14, fontFamily: 'Nunito_700Bold' },
  friendUsername: { fontSize: 12, marginTop: 1 },
  friendSpecies: { fontSize: 13, fontFamily: 'Nunito_700Bold' },
  lifeListGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  lifeListChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    width: '48%',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  chipText: { fontSize: 13, fontFamily: 'Nunito_600SemiBold', flex: 1 },
  chipCount: { fontSize: 12, fontFamily: 'Nunito_700Bold' },
  empty: { fontSize: 14, marginTop: 8 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  pickerSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  pickerTitle: { fontSize: 18, fontFamily: 'Nunito_800ExtraBold', marginBottom: 20, textAlign: 'center' },
  pickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', paddingBottom: 8 },
  pickerItem: { width: 100, alignItems: 'center', gap: 6, padding: 10, borderRadius: 14, borderWidth: 2 },
  pickerLabel: { fontSize: 11, fontFamily: 'Nunito_600SemiBold', textAlign: 'center', width: '100%' },
  pickerCancel: { textAlign: 'center', paddingVertical: 16, fontSize: 15 },
});
