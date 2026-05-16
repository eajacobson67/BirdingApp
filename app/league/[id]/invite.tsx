import { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../../store/themeStore';
import { useAuthStore } from '../../../store/authStore';
import { inviteToLeague, getLeague } from '../../../lib/firestore/leagues';
import { getUserProfile, type UserProfile } from '../../../lib/firestore/users';
import { getFriendIds } from '../../../lib/firestore/friends';

export default function InviteScreen() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();

  const [friends, setFriends] = useState<UserProfile[]>([]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { router.back(); return true; });
    return () => sub.remove();
  }, []);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [leagueName, setLeagueName] = useState('');

  useEffect(() => {
    if (!id || !user) return;
    Promise.all([
      getLeague(id),
      getFriendIds(user.uid),
    ]).then(async ([league, friendIds]) => {
      setLeagueName(league?.name ?? '');
      const profiles = await Promise.all(friendIds.map((fid) => getUserProfile(fid)));
      setFriends(profiles.filter((p): p is UserProfile => p !== null));
      setLoading(false);
    });
  }, [id, user]);

  async function handleInvite(friend: UserProfile) {
    if (!user || !id) return;
    const myProfile = await getUserProfile(user.uid);
    await inviteToLeague(
      id,
      leagueName,
      user.uid,
      myProfile?.displayName ?? user.displayName ?? 'Birder',
      friend.uid,
    );
    setInvitedIds((prev) => new Set([...prev, friend.uid]));
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color={c.primary} />
        </TouchableOpacity>
        <Text style={[s.title, { color: c.textPrimary }]}>Invite Friends</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={c.primary} size="large" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            <Text style={[s.empty, { color: c.gray }]}>No friends to invite yet.</Text>
          }
          renderItem={({ item }) => {
            const invited = invitedIds.has(item.uid);
            return (
              <View style={[s.row, { borderBottomColor: c.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.name, { color: c.textPrimary }]}>{item.displayName}</Text>
                  <Text style={[s.username, { color: c.gray }]}>@{item.username}</Text>
                </View>
                <TouchableOpacity
                  style={[s.inviteBtn, { backgroundColor: invited ? c.border : c.primary }]}
                  onPress={() => !invited && handleInvite(item)}
                  disabled={invited}
                >
                  <Text style={[s.inviteBtnText, { color: invited ? c.gray : '#FFFFFF' }]}>
                    {invited ? 'Invited' : 'Invite'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 18, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  name: { fontSize: 15, fontWeight: '700' },
  username: { fontSize: 13, marginTop: 1 },
  inviteBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  inviteBtnText: { fontSize: 13, fontWeight: '700' },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 15 },
});
