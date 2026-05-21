import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { searchUsersByUsername, UserProfile } from '../../lib/firestore/users';
import { getConnectionStatus, sendFriendRequest, Connection } from '../../lib/firestore/friends';
import { Avatar } from '../../components/ui/Avatar';

interface Result {
  profile: UserProfile;
  connection: Connection | null;
  requesting: boolean;
}

export default function FriendSearchScreen() {
  const c = useColors();
  const { user } = useAuthStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async () => {
    const term = query.trim();
    if (!term || !user) return;
    setLoading(true);
    setSearched(true);
    try {
      const profiles = await searchUsersByUsername(term);
      const withConnections = await Promise.all(
        profiles
          .filter(p => p.uid !== user.uid)
          .map(async p => ({
            profile: p,
            connection: await getConnectionStatus(user.uid, p.uid),
            requesting: false,
          }))
      );
      setResults(withConnections);
    } finally {
      setLoading(false);
    }
  }, [query, user]);

  async function sendRequest(uid: string) {
    if (!user) return;
    setResults(prev => prev.map(r => r.profile.uid === uid ? { ...r, requesting: true } : r));
    try {
      await sendFriendRequest(user.uid, uid);
      setResults(prev => prev.map(r =>
        r.profile.uid === uid
          ? { ...r, requesting: false, connection: { status: 'pending', since: new Date(), direction: 'sent' } }
          : r
      ));
    } catch {
      setResults(prev => prev.map(r => r.profile.uid === uid ? { ...r, requesting: false } : r));
    }
  }

  function buttonLabel(r: Result): string {
    if (r.connection?.status === 'accepted') return 'Friends ✓';
    if (r.connection?.status === 'pending') return r.connection.direction === 'sent' ? 'Sent' : 'Accept';
    return 'Add';
  }

  function buttonDisabled(r: Result): boolean {
    return r.requesting || r.connection?.status === 'accepted' || r.connection?.direction === 'sent';
  }

  function buttonStyle(r: Result) {
    if (r.connection?.status === 'accepted') return { backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.primary };
    if (r.connection?.status === 'pending') return { backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.border };
    return { backgroundColor: c.accent };
  }

  function buttonTextColor(r: Result): string {
    if (r.connection?.status === 'accepted') return c.primary;
    if (r.connection?.status === 'pending') return c.gray;
    return '#FFFFFF';
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={c.primary} />
        </TouchableOpacity>
        <Text style={[s.title, { color: c.textPrimary }]}>Find Friends</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Search bar */}
      <View style={[s.searchRow, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Ionicons name="search" size={18} color={c.gray} />
        <TextInput
          style={[s.input, { color: c.textPrimary }]}
          placeholder="Search by username"
          placeholderTextColor={c.gray}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={search}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
            <Ionicons name="close-circle" size={18} color={c.gray} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={c.primary} size="large" style={{ marginTop: 48 }} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={r => r.profile.uid}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListEmptyComponent={
            searched ? (
              <Text style={[s.empty, { color: c.gray }]}>No users found for "{query}".</Text>
            ) : (
              <Text style={[s.empty, { color: c.gray }]}>Type a username and press search.</Text>
            )
          }
          renderItem={({ item: r }) => (
            <View style={[s.row, { backgroundColor: c.surface, borderColor: c.border }]}>
              <TouchableOpacity onPress={() => router.push(`/user/${r.profile.uid}`)}>
                <Avatar photoURL={r.profile.photoURL} birdStyleId={r.profile.birdStyleId} size={44} />
              </TouchableOpacity>
              <TouchableOpacity
                style={s.meta}
                onPress={() => router.push(`/user/${r.profile.uid}`)}
              >
                <Text style={[s.displayName, { color: c.textPrimary }]}>{r.profile.displayName}</Text>
                <Text style={[s.username, { color: c.gray }]} numberOfLines={1}>@{r.profile.username}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btn, buttonStyle(r)]}
                onPress={() => sendRequest(r.profile.uid)}
                disabled={buttonDisabled(r)}
              >
                {r.requesting
                  ? <ActivityIndicator color="#FFFFFF" size="small" />
                  : <Text style={[s.btnText, { color: buttonTextColor(r) }]}>{buttonLabel(r)}</Text>}
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  title: { fontSize: 18, fontFamily: 'Nunito_800ExtraBold' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    margin: 16, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10,
  },
  input: { flex: 1, fontSize: 15, fontFamily: 'Nunito_600SemiBold', padding: 0 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 12,
  },
  meta: { flex: 1 },
  displayName: { fontSize: 15, fontFamily: 'Nunito_700Bold' },
  username: { fontSize: 13, marginTop: 1 },
  btn: { borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  btnText: { fontSize: 13, fontFamily: 'Nunito_700Bold' },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 15 },
});
