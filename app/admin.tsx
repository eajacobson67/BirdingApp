import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useColors } from '../store/themeStore';
import { useAuthStore } from '../store/authStore';
import {
  getUserProfile, searchUsersByUsername, promoteToAdmin,
  adminSetStats, adminClearLifeList, adminRemoveSpeciesFromLifeList,
} from '../lib/firestore/users';
import { getActiveLeagues, setLeagueEndTime } from '../lib/firestore/leagues';
import { BADGES } from '../components/ui/BadgeIcon';
import type { UserProfile } from '../lib/firestore/users';
import type { League } from '../lib/firestore/leagues';

const BADGE_REVOKE: Record<string, (uid: string) => Promise<void>> = {
  first:   (uid) => adminSetStats(uid, { totalSightings: 0 }),
  ten:     (uid) => adminSetStats(uid, { totalSpecies: 0 }),
  fifty:   (uid) => adminSetStats(uid, { totalSpecies: 9 }),
  waxwing: (uid) => adminRemoveSpeciesFromLifeList(uid, 'Cedar Waxwing'),
};

export default function AdminScreen() {
  const c = useColors();
  const { user } = useAuthStore();

  // ── Leagues ───────────────────────────────────────────────────────────────
  const [leagues, setLeagues]           = useState<League[]>([]);
  const [leaguesLoading, setLeaguesLoading] = useState(true);
  const [leagueWorking, setLeagueWorking]   = useState<string | null>(null);

  // ── Promote user ──────────────────────────────────────────────────────────
  const [promoteQuery, setPromoteQuery] = useState('');
  const [promoteResults, setPromoteResults] = useState<UserProfile[]>([]);
  const [promoting, setPromoting]       = useState<string | null>(null);

  // ── Switch account ────────────────────────────────────────────────────────
  const [switchEmail, setSwitchEmail]     = useState('');
  const [switchPassword, setSwitchPassword] = useState('');
  const [switching, setSwitching]         = useState(false);

  // ── Test stats ────────────────────────────────────────────────────────────
  const [profile, setProfile]           = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [sightingsInput, setSightingsInput] = useState('');
  const [speciesInput, setSpeciesInput]   = useState('');
  const [statsWorking, setStatsWorking]   = useState(false);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { router.back(); return true; });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    getActiveLeagues().then((ls) => { setLeagues(ls); setLeaguesLoading(false); });
  }, []);

  const loadProfile = useCallback(() => {
    if (!user) return;
    setProfileLoading(true);
    getUserProfile(user.uid).then((p) => {
      setProfile(p);
      setSightingsInput(String(p?.totalSightings ?? 0));
      setSpeciesInput(String(p?.totalSpecies ?? 0));
      setProfileLoading(false);
    });
  }, [user]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleSet15s(leagueId: string) {
    setLeagueWorking(leagueId);
    try {
      await setLeagueEndTime(leagueId, 15);
      setLeagues((prev) => prev.map((l) =>
        l.id === leagueId ? { ...l, endDate: new Date(Date.now() + 15000) } : l
      ));
    } finally {
      setLeagueWorking(null);
    }
  }

  async function handlePromoteSearch() {
    if (!promoteQuery.trim()) return;
    const results = await searchUsersByUsername(promoteQuery.trim().toLowerCase());
    setPromoteResults(results);
  }

  async function handlePromote(uid: string, displayName: string) {
    Alert.alert('Promote to Admin', `Make ${displayName} an admin?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Promote', style: 'destructive',
        onPress: async () => {
          setPromoting(uid);
          try {
            await promoteToAdmin(uid);
            setPromoteResults((prev) => prev.map((u) => u.uid === uid ? { ...u, isAdmin: true } : u));
          } finally {
            setPromoting(null);
          }
        },
      },
    ]);
  }

  async function handleSwitchAccount() {
    if (!switchEmail.trim() || !switchPassword) return;
    setSwitching(true);
    try {
      await signInWithEmailAndPassword(auth, switchEmail.trim(), switchPassword);
      // Auth listener in _layout.tsx handles navigation automatically
    } catch (e: unknown) {
      Alert.alert('Sign-in failed', (e as Error).message ?? 'Unknown error');
      setSwitching(false);
    }
  }

  async function handleSetSightings() {
    if (!user || !profile) return;
    const n = parseInt(sightingsInput, 10);
    if (isNaN(n) || n < 0) return;
    setStatsWorking(true);
    await adminSetStats(user.uid, { totalSightings: n });
    await loadProfile();
    setStatsWorking(false);
  }

  async function handleSetSpecies() {
    if (!user || !profile) return;
    const n = parseInt(speciesInput, 10);
    if (isNaN(n) || n < 0) return;
    setStatsWorking(true);
    await adminSetStats(user.uid, { totalSpecies: n });
    await loadProfile();
    setStatsWorking(false);
  }

  async function handleClearLifeList() {
    if (!user) return;
    Alert.alert('Clear Life List', 'Remove all species from this account\'s life list?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive',
        onPress: async () => {
          setStatsWorking(true);
          await adminClearLifeList(user.uid);
          await loadProfile();
          setStatsWorking(false);
        },
      },
    ]);
  }

  async function handleRevokeBadge(badgeId: string, label: string) {
    if (!user) return;
    const revoke = BADGE_REVOKE[badgeId];
    if (!revoke) return;
    Alert.alert('Revoke Badge', `Revoke "${label}" by clearing its underlying data?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke', style: 'destructive',
        onPress: async () => {
          setStatsWorking(true);
          await revoke(user.uid);
          await loadProfile();
          setStatsWorking(false);
        },
      },
    ]);
  }

  const earnedBadges = profile ? BADGES.filter((b) => b.check(profile)) : [];
  const lifeList = profile ? [...new Set(Object.values(profile.yearSpecies).flat())] : [];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="chevron-back" size={28} color={c.primary} />
        </TouchableOpacity>
        <Text style={[s.title, { color: c.textPrimary }]}>Admin</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>

        {/* ── Active Leagues ── */}
        <Text style={[s.sectionTitle, { color: c.textPrimary }]}>Active Leagues</Text>
        {leaguesLoading
          ? <ActivityIndicator color={c.primary} style={{ marginVertical: 12 }} />
          : leagues.length === 0
            ? <Text style={[s.empty, { color: c.gray }]}>No active leagues</Text>
            : leagues.map((l) => (
              <View key={l.id} style={[s.row, { borderColor: c.border }]}>
                <Text style={[s.rowLabel, { color: c.textPrimary, flex: 1 }]} numberOfLines={1}>{l.name}</Text>
                <TouchableOpacity
                  style={[s.pill, { backgroundColor: c.primary }]}
                  onPress={() => handleSet15s(l.id)}
                  disabled={leagueWorking === l.id}
                >
                  {leagueWorking === l.id
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={s.pillText}>Set 15s</Text>
                  }
                </TouchableOpacity>
              </View>
            ))
        }

        <View style={[s.divider, { backgroundColor: c.border }]} />

        {/* ── Promote User ── */}
        <Text style={[s.sectionTitle, { color: c.textPrimary }]}>Promote User</Text>
        <View style={s.inputRow}>
          <TextInput
            style={[s.input, { flex: 1, borderColor: c.border, color: c.textPrimary, backgroundColor: c.surface }]}
            placeholder="Username"
            placeholderTextColor={c.gray}
            value={promoteQuery}
            onChangeText={setPromoteQuery}
            onSubmitEditing={handlePromoteSearch}
            autoCapitalize="none"
          />
          <TouchableOpacity style={[s.pill, { backgroundColor: c.primary }]} onPress={handlePromoteSearch}>
            <Text style={s.pillText}>Search</Text>
          </TouchableOpacity>
        </View>
        {promoteResults.map((u) => (
          <View key={u.uid} style={[s.row, { borderColor: c.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.rowLabel, { color: c.textPrimary }]}>{u.displayName}</Text>
              <Text style={[s.rowSub, { color: c.gray }]}>@{u.username}{u.isAdmin ? ' · admin' : ''}</Text>
            </View>
            {!u.isAdmin && (
              <TouchableOpacity
                style={[s.pill, { backgroundColor: c.accent }]}
                onPress={() => handlePromote(u.uid, u.displayName)}
                disabled={promoting === u.uid}
              >
                {promoting === u.uid
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.pillText}>Promote</Text>
                }
              </TouchableOpacity>
            )}
            {u.isAdmin && <Ionicons name="shield-checkmark" size={20} color={c.primary} />}
          </View>
        ))}

        <View style={[s.divider, { backgroundColor: c.border }]} />

        {/* ── Switch Account ── */}
        <Text style={[s.sectionTitle, { color: c.textPrimary }]}>Switch Account</Text>
        <TextInput
          style={[s.input, { borderColor: c.border, color: c.textPrimary, backgroundColor: c.surface, marginBottom: 8 }]}
          placeholder="Email"
          placeholderTextColor={c.gray}
          value={switchEmail}
          onChangeText={setSwitchEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={[s.input, { borderColor: c.border, color: c.textPrimary, backgroundColor: c.surface, marginBottom: 8 }]}
          placeholder="Password"
          placeholderTextColor={c.gray}
          value={switchPassword}
          onChangeText={setSwitchPassword}
          secureTextEntry
        />
        <TouchableOpacity
          style={[s.pill, { backgroundColor: c.primary, alignSelf: 'flex-start' }]}
          onPress={handleSwitchAccount}
          disabled={switching}
        >
          {switching
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={s.pillText}>Switch</Text>
          }
        </TouchableOpacity>

        <View style={[s.divider, { backgroundColor: c.border }]} />

        {/* ── Test Stats ── */}
        <Text style={[s.sectionTitle, { color: c.textPrimary }]}>Test Stats (current user)</Text>
        {profileLoading
          ? <ActivityIndicator color={c.primary} style={{ marginVertical: 12 }} />
          : (
            <>
              {/* Sightings */}
              <Text style={[s.fieldLabel, { color: c.gray }]}>Total sightings</Text>
              <View style={s.inputRow}>
                <TextInput
                  style={[s.input, { flex: 1, borderColor: c.border, color: c.textPrimary, backgroundColor: c.surface }]}
                  value={sightingsInput}
                  onChangeText={setSightingsInput}
                  keyboardType="number-pad"
                />
                <TouchableOpacity
                  style={[s.pill, { backgroundColor: c.primary }]}
                  onPress={handleSetSightings}
                  disabled={statsWorking}
                >
                  <Text style={s.pillText}>Set</Text>
                </TouchableOpacity>
              </View>

              {/* Species */}
              <Text style={[s.fieldLabel, { color: c.gray }]}>Total species (life list count)</Text>
              <View style={s.inputRow}>
                <TextInput
                  style={[s.input, { flex: 1, borderColor: c.border, color: c.textPrimary, backgroundColor: c.surface }]}
                  value={speciesInput}
                  onChangeText={setSpeciesInput}
                  keyboardType="number-pad"
                />
                <TouchableOpacity
                  style={[s.pill, { backgroundColor: c.primary }]}
                  onPress={handleSetSpecies}
                  disabled={statsWorking}
                >
                  <Text style={s.pillText}>Set</Text>
                </TouchableOpacity>
              </View>

              {/* Life list */}
              <View style={s.inputRow}>
                <Text style={[s.fieldLabel, { color: c.gray, flex: 1 }]}>
                  Life list: {lifeList.length} species
                </Text>
                <TouchableOpacity
                  style={[s.pill, { backgroundColor: c.danger }]}
                  onPress={handleClearLifeList}
                  disabled={statsWorking}
                >
                  <Text style={s.pillText}>Clear all</Text>
                </TouchableOpacity>
              </View>

              {/* Earned badges */}
              {earnedBadges.length > 0 && (
                <>
                  <Text style={[s.fieldLabel, { color: c.gray, marginTop: 8 }]}>Earned badges</Text>
                  {earnedBadges.map((b) => (
                    <View key={b.id} style={[s.row, { borderColor: c.border }]}>
                      <Text style={[s.rowLabel, { color: c.textPrimary, flex: 1 }]}>{b.label}</Text>
                      {BADGE_REVOKE[b.id] && (
                        <TouchableOpacity
                          style={[s.pill, { backgroundColor: c.danger }]}
                          onPress={() => handleRevokeBadge(b.id, b.label)}
                          disabled={statsWorking}
                        >
                          <Text style={s.pillText}>Revoke</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </>
              )}
              {earnedBadges.length === 0 && (
                <Text style={[s.empty, { color: c.gray }]}>No badges earned</Text>
              )}
            </>
          )
        }

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn:      { width: 40, alignItems: 'center' },
  title:        { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: 'Nunito_700Bold' },
  scroll:       { padding: 16 },
  sectionTitle: { fontSize: 16, fontFamily: 'Nunito_800ExtraBold', marginBottom: 10 },
  fieldLabel:   { fontSize: 12, fontFamily: 'Nunito_600SemiBold', marginBottom: 6 },
  divider:      { height: 1, marginVertical: 20 },
  empty:        { fontSize: 13, fontFamily: 'Nunito_400Regular', marginBottom: 12 },
  row:          { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 8, gap: 10 },
  rowLabel:     { fontSize: 14, fontFamily: 'Nunito_600SemiBold' },
  rowSub:       { fontSize: 12, marginTop: 1 },
  inputRow:     { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 10 },
  input:        { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, fontFamily: 'Nunito_400Regular' },
  pill:         { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9, minWidth: 70, alignItems: 'center' },
  pillText:     { color: '#fff', fontSize: 13, fontFamily: 'Nunito_700Bold' },
});
