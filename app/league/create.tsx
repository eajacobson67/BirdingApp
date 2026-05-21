import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, Switch, ScrollView,
  TouchableOpacity, StyleSheet, Alert, Platform, BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { createLeague, type LeagueConfig } from '../../lib/firestore/leagues';
import { getUserProfile } from '../../lib/firestore/users';

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function formatDate(d: Date) {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CreateLeagueScreen() {
  const c = useColors();
  const { user } = useAuthStore();
  const { birdStyle } = useThemeStore();

  const [name, setName] = useState('');
  const [durationDays, setDurationDays] = useState(30);
  const [isPublic, setIsPublic] = useState(true);
  const [config, setConfig] = useState<LeagueConfig>({
    requirePhotos: false,
    rarityScoring: true,
    targetBirds: false,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { router.back(); return true; });
    return () => sub.remove();
  }, []);

  const startDate = new Date();
  const endDate = addDays(startDate, durationDays);

  function toggleConfig(key: keyof LeagueConfig) {
    setConfig((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleCreate() {
    if (!user) return;
    if (!name.trim()) { Alert.alert('Name required', 'Give your league a name.'); return; }

    setSubmitting(true);
    try {
      const profile = await getUserProfile(user.uid);
      const id = await createLeague({
        name: name.trim(),
        createdBy: user.uid,
        startDate,
        endDate,
        isPublic,
        config,
        creatorDisplayName: profile?.displayName ?? user.displayName ?? 'Birder',
        creatorBirdStyleId: birdStyle.id,
      });
      router.replace(`/league/${id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color={c.primary} />
        </TouchableOpacity>
        <Text style={[s.title, { color: c.textPrimary }]}>Create League</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={s.section}>
          <Text style={[s.label, { color: c.gray }]}>LEAGUE NAME</Text>
          <TextInput
            style={[s.input, { backgroundColor: c.surface, borderColor: c.border, color: c.textPrimary }]}
            placeholder="My League"
            placeholderTextColor={c.gray}
            value={name}
            onChangeText={setName}
            maxLength={40}
          />
        </View>

        <View style={s.section}>
          <Text style={[s.label, { color: c.gray }]}>DURATION</Text>
          <View style={s.durationRow}>
            {[7, 14, 30, 60].map((d) => (
              <TouchableOpacity
                key={d}
                style={[s.durationChip, { borderColor: c.border, backgroundColor: durationDays === d ? c.primary : c.surface }]}
                onPress={() => setDurationDays(d)}
              >
                <Text style={[s.durationText, { color: durationDays === d ? '#FFFFFF' : c.textPrimary }]}>{d}d</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[s.dateRange, { color: c.gray }]}>
            {formatDate(startDate)} → {formatDate(endDate)}
          </Text>
        </View>

        <View style={s.section}>
          <Text style={[s.label, { color: c.gray }]}>RULES</Text>
          <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <ToggleRow
              label="Rarity Scoring"
              description="Points scale with bird rarity (×1–×25)"
              value={config.rarityScoring}
              onToggle={() => toggleConfig('rarityScoring')}
              tintColor={c.primary}
              textColor={c.textPrimary}
              subColor={c.gray}
              borderColor={c.border}
            />
            <ToggleRow
              label="Require Photos"
              description="Sightings must include a photo"
              value={config.requirePhotos}
              onToggle={() => toggleConfig('requirePhotos')}
              tintColor={c.primary}
              textColor={c.textPrimary}
              subColor={c.gray}
              borderColor={c.border}
            />
            <ToggleRow
              label="Target Birds"
              description="+3 bonus pts for daily target species"
              value={config.targetBirds}
              onToggle={() => toggleConfig('targetBirds')}
              tintColor={c.primary}
              textColor={c.textPrimary}
              subColor={c.gray}
              borderColor="transparent"
            />
          </View>
        </View>

        <View style={s.section}>
          <View style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <ToggleRow
              label="Public League"
              description="Anyone can find and join"
              value={isPublic}
              onToggle={() => setIsPublic((v) => !v)}
              tintColor={c.primary}
              textColor={c.textPrimary}
              subColor={c.gray}
              borderColor="transparent"
            />
          </View>
        </View>

        <TouchableOpacity
          style={[s.createBtn, { backgroundColor: submitting ? c.border : c.primary }]}
          onPress={handleCreate}
          disabled={submitting}
          activeOpacity={0.85}
        >
          <Text style={s.createBtnText}>{submitting ? 'Creating…' : 'Create League'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function ToggleRow({
  label, description, value, onToggle, tintColor, textColor, subColor, borderColor,
}: {
  label: string; description: string; value: boolean; onToggle: () => void;
  tintColor: string; textColor: string; subColor: string; borderColor: string;
}) {
  return (
    <View style={[s.toggleRow, { borderBottomColor: borderColor }]}>
      <View style={{ flex: 1 }}>
        <Text style={[s.toggleLabel, { color: textColor }]}>{label}</Text>
        <Text style={[s.toggleSub, { color: subColor }]}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#E0E0E0', true: tintColor + '88' }}
        thumbColor={value ? tintColor : '#FFFFFF'}
      />
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 18, fontFamily: 'Nunito_800ExtraBold' },
  section: { paddingHorizontal: 20, marginBottom: 20 },
  label: { fontSize: 11, fontFamily: 'Nunito_700Bold', letterSpacing: 1, marginBottom: 8 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16 },
  durationRow: { flexDirection: 'row', gap: 10 },
  durationChip: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, borderWidth: 1 },
  durationText: { fontSize: 14, fontFamily: 'Nunito_700Bold' },
  dateRange: { fontSize: 13, marginTop: 8 },
  card: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  toggleLabel: { fontSize: 15, fontFamily: 'Nunito_600SemiBold' },
  toggleSub: { fontSize: 12, marginTop: 2 },
  createBtn: { marginHorizontal: 20, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  createBtnText: { fontSize: 16, fontFamily: 'Nunito_800ExtraBold', color: '#FFFFFF' },
});
