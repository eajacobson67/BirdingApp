import { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { deleteAccount } from '../../lib/firestore/account';
import { DELETION_NOTICE } from '../../lib/legal';
import { getAuthErrorMessage } from '../../lib/authErrors';

export default function DeleteAccountScreen() {
  const c = useColors();
  const { user } = useAuthStore();
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);

  const armed = password.length > 0 && confirmText.trim().toUpperCase() === 'DELETE';

  function confirm() {
    Alert.alert(
      'Delete account?',
      'This permanently removes your profile, sightings, photos, recordings, friends and league scores. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void run() },
      ],
    );
  }

  async function run() {
    if (!user) return;
    setBusy(true);
    try {
      await deleteAccount(user, password);
      router.replace('/(auth)/login');
    } catch (e: unknown) {
      setBusy(false);
      Alert.alert('Could not delete account', getAuthErrorMessage(e));
    }
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
      <View style={[s.header, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} disabled={busy}>
          <Ionicons name="chevron-back" size={26} color={c.textPrimary} />
        </TouchableOpacity>
        <Text style={[s.title, { color: c.textPrimary }]}>Delete Account</Text>
      </View>

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {DELETION_NOTICE.filter((sec) => sec.heading !== 'In the app').map((section) => (
          <View key={section.heading} style={s.section}>
            <Text style={[s.heading, { color: c.textPrimary }]}>{section.heading}</Text>
            {section.body.map((p) => (
              <Text key={p} style={[s.paragraph, { color: c.textPrimary }]}>{p}</Text>
            ))}
            {section.bullets?.map((b) => (
              <View key={b} style={s.bulletRow}>
                <Text style={[s.bulletDot, { color: c.danger }]}>•</Text>
                <Text style={[s.paragraph, { color: c.textPrimary, flex: 1, marginTop: 0 }]}>{b}</Text>
              </View>
            ))}
          </View>
        ))}

        <View style={[s.confirmCard, { backgroundColor: c.surface, borderColor: c.danger + '55' }]}>
          <Text style={[s.label, { color: c.textPrimary }]}>Your password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            editable={!busy}
            placeholder="Password"
            placeholderTextColor={c.gray}
            style={[s.input, { color: c.textPrimary, borderColor: c.border, backgroundColor: c.background }]}
          />

          <Text style={[s.label, { color: c.textPrimary, marginTop: 16 }]}>
            Type DELETE to confirm
          </Text>
          <TextInput
            value={confirmText}
            onChangeText={setConfirmText}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!busy}
            placeholder="DELETE"
            placeholderTextColor={c.gray}
            style={[s.input, { color: c.textPrimary, borderColor: c.border, backgroundColor: c.background }]}
          />

          <TouchableOpacity
            onPress={confirm}
            disabled={!armed || busy}
            style={[s.deleteBtn, { backgroundColor: c.danger, opacity: armed && !busy ? 1 : 0.4 }]}
          >
            {busy
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={s.deleteBtnText}>Delete my account</Text>}
          </TouchableOpacity>

          {busy && (
            <Text style={[s.working, { color: c.gray }]}>
              Removing your data. Leave the app open until this finishes.
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  title: { fontSize: 18, fontFamily: 'Nunito_800ExtraBold' },
  body: { padding: 20, paddingBottom: 56 },
  section: { marginBottom: 20 },
  heading: { fontSize: 16, fontFamily: 'Nunito_700Bold', marginBottom: 4 },
  paragraph: { fontSize: 14, lineHeight: 21, marginTop: 8 },
  bulletRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  bulletDot: { fontSize: 14, lineHeight: 21 },
  confirmCard: { borderRadius: 16, borderWidth: 1.5, padding: 18, marginTop: 8 },
  label: { fontSize: 14, fontFamily: 'Nunito_700Bold', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  deleteBtn: { marginTop: 20, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  deleteBtnText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Nunito_700Bold' },
  working: { fontSize: 13, marginTop: 12, textAlign: 'center' },
});
