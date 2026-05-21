import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { BirdAvatar } from '../ui/BirdAvatar';
import { BIRD_STYLES } from '../../lib/birdStyles';
import { useColors } from '../../store/themeStore';
import type { LeagueMember } from '../../lib/firestore/leagues';

// Heights of each podium block by rank index (0=1st, 1=2nd, 2=3rd)
const BLOCK_HEIGHTS = [110, 78, 60] as const;
const LABELS = ['1st', '2nd', '3rd'] as const;
// Display order: 2nd on left, 1st in center, 3rd on right
const SLOT_ORDER = [1, 0, 2] as const;

// Fixed space above each block (avatar + name + birds labels)
const OVERHEAD = 86;
// Slot height = overhead + tallest block (never changes, prevents list resize)
const SLOT_H = OVERHEAD + BLOCK_HEIGHTS[0];
export const PODIUM_CONTAINER_H = 16 + SLOT_H + 8; // exported so parent can reserve space

interface Props {
  members: LeagueMember[];
}

export function LeaguePodium({ members }: Props) {
  const c = useColors();
  const top3 = members.slice(0, 3);

  // colors[rank]: gold for 1st, theme primary for 2nd, theme accent for 3rd
  const colors = ['#E8C84A', c.primary, c.accent] as const;

  // heights indexed by rank (0=gold, 1=silver, 2=bronze)
  const heights = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Only animate on initial member load, not on every re-render
    if (members.length === 0) return;
    heights.forEach((h) => h.setValue(0));
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    Animated.stagger(220, [
      Animated.spring(heights[1], { toValue: BLOCK_HEIGHTS[1], useNativeDriver: false, tension: 60, friction: 10 }),
      Animated.spring(heights[0], { toValue: BLOCK_HEIGHTS[0], useNativeDriver: false, tension: 60, friction: 10 }),
      Animated.spring(heights[2], { toValue: BLOCK_HEIGHTS[2], useNativeDriver: false, tension: 60, friction: 10 }),
    ]).start();
  }, [members.length > 0]);

  return (
    <Animated.View style={[s.container, { opacity }]}>
      <View style={s.row}>
        {SLOT_ORDER.map((rank) => {
          const member = top3[rank];
          const birdStyle = member
            ? (BIRD_STYLES.find((b) => b.id === member.birdStyleId) ?? BIRD_STYLES[0])
            : null;
          const color = colors[rank];
          return (
            <View key={rank} style={s.slot}>
              {/* Avatar + labels pinned to the top of the fixed-height slot */}
              <View style={s.slotTop}>
                {member ? (
                  <>
                    <BirdAvatar birdStyle={birdStyle!} size={44} />
                    <Text style={s.name} numberOfLines={1}>{member.displayName}</Text>
                    <Text style={[s.birds, { color }]}>{member.sightingCount} birds</Text>
                  </>
                ) : null}
              </View>
              {/* Block grows upward from the bottom, inside the fixed slot */}
              <Animated.View style={[s.block, { height: heights[rank], backgroundColor: color }]}>
                <Text style={s.rankLabel}>{LABELS[rank]}</Text>
              </Animated.View>
            </View>
          );
        })}
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: { height: PODIUM_CONTAINER_H, paddingTop: 16, paddingBottom: 8, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-end', height: SLOT_H },
  slot: { flex: 1, height: SLOT_H, alignItems: 'center', justifyContent: 'flex-end' },
  slotTop: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
  name: { color: '#1C1C1E', fontSize: 11, fontFamily: 'Nunito_600SemiBold', marginTop: 4, marginBottom: 1, textAlign: 'center', paddingHorizontal: 4 },
  birds: { fontSize: 11, fontFamily: 'Nunito_700Bold', marginBottom: 4 },
  block: { width: '88%', borderTopLeftRadius: 6, borderTopRightRadius: 6, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 6 },
  rankLabel: { color: '#FFFFFF', fontSize: 12, fontFamily: 'Nunito_700Bold' },
});
