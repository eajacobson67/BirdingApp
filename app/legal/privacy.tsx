import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../store/themeStore';
import { PRIVACY_POLICY, LEGAL_EFFECTIVE_DATE, LEGAL_CONTACT_EMAIL } from '../../lib/legal';

export default function PrivacyScreen() {
  const c = useColors();

  return (
    <SafeAreaView style={[s.container, { backgroundColor: c.background }]}>
      <View style={[s.header, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={c.textPrimary} />
        </TouchableOpacity>
        <Text style={[s.title, { color: c.textPrimary }]}>Privacy Policy</Text>
      </View>

      <ScrollView contentContainerStyle={s.body}>
        <Text style={[s.effective, { color: c.gray }]}>
          Effective {LEGAL_EFFECTIVE_DATE} · {LEGAL_CONTACT_EMAIL}
        </Text>

        {PRIVACY_POLICY.map((section) => (
          <View key={section.heading} style={s.section}>
            <Text style={[s.heading, { color: c.textPrimary }]}>{section.heading}</Text>
            {section.body.map((p) => (
              <Text key={p} style={[s.paragraph, { color: c.textPrimary }]}>{p}</Text>
            ))}
            {section.bullets?.map((b) => (
              <View key={b} style={s.bulletRow}>
                <Text style={[s.bulletDot, { color: c.primary }]}>•</Text>
                <Text style={[s.paragraph, { color: c.textPrimary, flex: 1, marginTop: 0 }]}>{b}</Text>
              </View>
            ))}
          </View>
        ))}
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
  effective: { fontSize: 13, marginBottom: 20 },
  section: { marginBottom: 22 },
  heading: { fontSize: 16, fontFamily: 'Nunito_700Bold', marginBottom: 8 },
  paragraph: { fontSize: 14, lineHeight: 21, marginTop: 8 },
  bulletRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  bulletDot: { fontSize: 14, lineHeight: 21 },
});
