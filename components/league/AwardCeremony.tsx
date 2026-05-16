import { useEffect, useRef } from 'react';
import { View, Text, Modal, Animated, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { BirdAvatar } from '../ui/BirdAvatar';
import { BIRD_STYLES } from '../../lib/birdStyles';
import type { LeagueMember } from '../../lib/firestore/leagues';

const { width: W } = Dimensions.get('window');

const PODIUM_COLORS = {
  0: '#E8C84A', // gold
  1: '#C0C0C0', // silver
  2: '#CD7F32', // bronze
};

const PODIUM_HEIGHTS = { 0: 130, 1: 90, 2: 70 };

// Slot order: 2nd (left), 1st (center), 3rd (right)
const SLOT_ORDER = [1, 0, 2] as const;

interface Props {
  visible: boolean;
  onClose: () => void;
  members: LeagueMember[];
  myUserId: string;
}

export function AwardCeremony({ visible, onClose, members, myUserId }: Props) {
  const top3 = members.slice(0, 3);
  const myRank = members.findIndex((m) => m.userId === myUserId) + 1;

  // Animated heights for each podium slot
  const heights = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      heights.forEach((h) => h.setValue(0));
      opacity.setValue(0);
      return;
    }

    // Fade in backdrop
    Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    // Staggered podium rise: 2nd → 1st → 3rd
    Animated.stagger(280, [
      Animated.spring(heights[1], { toValue: PODIUM_HEIGHTS[1], useNativeDriver: false }),
      Animated.spring(heights[0], { toValue: PODIUM_HEIGHTS[0], useNativeDriver: false }),
      Animated.spring(heights[2], { toValue: PODIUM_HEIGHTS[2], useNativeDriver: false }),
    ]).start();
  }, [visible]);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View style={[s.backdrop, { opacity }]}>
        <View style={s.container}>
          <Text style={s.header}>Award Ceremony</Text>

          {myRank > 0 && myRank <= 3 && (
            <Text style={s.personalMsg}>
              {medals[myRank - 1]} You placed #{myRank}!
            </Text>
          )}
          {myRank > 3 && (
            <Text style={s.personalMsg}>You finished #{myRank} — keep birding! 🦅</Text>
          )}

          {/* Podium */}
          <View style={s.podiumRow}>
            {SLOT_ORDER.map((rank) => {
              const member = top3[rank];
              if (!member) return <View key={rank} style={s.podiumSlot} />;
              const birdStyle = BIRD_STYLES.find((b) => b.id === member.birdStyleId) ?? BIRD_STYLES[0];
              const color = PODIUM_COLORS[rank as keyof typeof PODIUM_COLORS];
              const displayRank = rank + 1;

              return (
                <View key={rank} style={s.podiumSlot}>
                  <BirdAvatar birdStyle={birdStyle} size={48} />
                  <Text style={s.memberName} numberOfLines={1}>{member.displayName}</Text>
                  <Text style={[s.memberPts, { color }]}>{member.points} pts</Text>
                  <Animated.View
                    style={[s.podiumBlock, { height: heights[rank], backgroundColor: color }]}
                  >
                    <Text style={s.rankNum}>{medals[rank]}</Text>
                  </Animated.View>
                </View>
              );
            })}
          </View>

          {/* Rest of leaderboard */}
          {members.slice(3).map((m, i) => (
            <View key={m.userId} style={s.restRow}>
              <Text style={s.restRank}>#{i + 4}</Text>
              <Text style={s.restName} numberOfLines={1}>{m.displayName}</Text>
              <Text style={s.restPts}>{m.points} pts</Text>
            </View>
          ))}

          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <Text style={s.closeBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'flex-end' },
  container: { backgroundColor: '#1A1A2E', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 24, paddingHorizontal: 24, paddingBottom: 40 },
  header: { color: '#E8C84A', fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  personalMsg: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', textAlign: 'center', marginBottom: 24 },
  podiumRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 0, marginBottom: 24 },
  podiumSlot: { flex: 1, alignItems: 'center' },
  memberName: { color: '#FFFFFF', fontSize: 11, fontWeight: '600', marginTop: 4, marginBottom: 2, textAlign: 'center' },
  memberPts: { fontSize: 11, fontWeight: '700', marginBottom: 6 },
  podiumBlock: { width: '90%', borderTopLeftRadius: 8, borderTopRightRadius: 8, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 6 },
  rankNum: { fontSize: 22 },
  restRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#FFFFFF15' },
  restRank: { color: '#8BA3B0', width: 36, fontSize: 13, fontWeight: '700' },
  restName: { flex: 1, color: '#FFFFFF', fontSize: 14 },
  restPts: { color: '#8BA3B0', fontSize: 13, fontWeight: '600' },
  closeBtn: { marginTop: 24, backgroundColor: '#E8C84A', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  closeBtnText: { color: '#1A1A2E', fontSize: 16, fontWeight: '800' },
});
