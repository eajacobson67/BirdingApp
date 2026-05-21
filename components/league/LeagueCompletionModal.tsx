import { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, Animated, TouchableOpacity, StyleSheet, Dimensions, Easing } from 'react-native';
import { BirdAvatar } from '../ui/BirdAvatar';
import { BIRD_STYLES } from '../../lib/birdStyles';
import { useColors } from '../../store/themeStore';
import type { LeagueMember } from '../../lib/firestore/leagues';

const { width: W, height: H } = Dimensions.get('window');

interface Feather {
  id: number;
  startX: number;
  width: number;
  height: number;
  color: string;
  travelY: number;
  totalDur: number;
  halfPeriod: number;
  cycles: number;
  swayAmp: number;
  tiltAmp: number;
  startDir: 1 | -1;
  translateX: Animated.Value;
  translateY: Animated.Value;
  opacity: Animated.Value;
  rotation: Animated.Value;
}

function buildSway(
  value: Animated.Value,
  amplitude: number,
  halfPeriod: number,
  cycles: number,
  startDir: 1 | -1,
): Animated.CompositeAnimation {
  const steps: Animated.CompositeAnimation[] = [];
  let dir = startDir;
  for (let i = 0; i < cycles; i++) {
    steps.push(
      Animated.timing(value, {
        toValue: dir * amplitude,
        duration: halfPeriod,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    );
    dir = (-dir) as 1 | -1;
  }
  return Animated.sequence(steps);
}

interface Props {
  visible: boolean;
  rank: number;
  totalMembers: number;
  leagueName: string;
  myMember: LeagueMember | null;
  onClose: () => void;
}

export function LeagueCompletionModal({ visible, rank, totalMembers, leagueName, myMember, onClose }: Props) {
  const c = useColors();
  const [feathers, setFeathers] = useState<Feather[]>([]);
  const nextId = useRef(0);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.85)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  const birdStyle = myMember
    ? (BIRD_STYLES.find((b) => b.id === myMember.birdStyleId) ?? BIRD_STYLES[0])
    : BIRD_STYLES[0];

  const featherColors = [c.primary, c.accent, '#E8C84A', '#C0C0C0', '#CD7F32'];

  useEffect(() => {
    if (!visible) {
      setFeathers([]);
      backdropOpacity.setValue(0);
      cardScale.setValue(0.85);
      cardOpacity.setValue(0);
      return;
    }

    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(cardScale, { toValue: 1, tension: 80, friction: 12, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();

    // Spawn feathers in two waves
    spawnWave(18, 0);
    spawnWave(14, 1200);
  }, [visible]);

  function spawnWave(count: number, delayMs: number) {
    setTimeout(() => {
      const newFeathers: Feather[] = Array.from({ length: count }, () => {
        const halfPeriod = 320 + Math.random() * 260;
        const cycles = 4 + Math.floor(Math.random() * 4);
        const totalDur = halfPeriod * cycles;
        const swayAmp = 30 + Math.random() * 50;
        const tiltAmp = 20 + Math.random() * 35;
        const startDir = (Math.random() > 0.5 ? 1 : -1) as 1 | -1;
        const travelY = H + 120;
        return {
          id: ++nextId.current,
          width: 5 + Math.random() * 8,
          height: (5 + Math.random() * 8) * (2.2 + Math.random()),
          startX: Math.random() * W,
          color: featherColors[Math.floor(Math.random() * featherColors.length)],
          travelY, totalDur, halfPeriod, cycles, swayAmp, tiltAmp, startDir,
          translateX: new Animated.Value(startDir * swayAmp * -0.3),
          translateY: new Animated.Value(0),
          opacity: new Animated.Value(0.9),
          rotation: new Animated.Value(startDir * tiltAmp * 0.3),
        };
      });
      setFeathers((prev) => [...prev, ...newFeathers]);
      requestAnimationFrame(() => {
        newFeathers.forEach((f) => {
          Animated.parallel([
            Animated.timing(f.translateY, { toValue: f.travelY, duration: f.totalDur, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(f.opacity, { toValue: 0, duration: f.totalDur, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
            buildSway(f.translateX, f.swayAmp, f.halfPeriod, f.cycles, f.startDir),
            buildSway(f.rotation, f.tiltAmp, f.halfPeriod, f.cycles, f.startDir),
          ]).start(() => setFeathers((prev) => prev.filter((x) => x.id !== f.id)));
        });
      });
    }, delayMs);
  }

  const rankLabel = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[s.backdrop, { opacity: backdropOpacity }]}>
        {/* Feathers layer */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {feathers.map((f) => (
            <Animated.View
              key={f.id}
              style={{
                position: 'absolute',
                left: f.startX,
                top: -f.height,
                width: f.width,
                height: f.height,
                borderRadius: f.width / 2,
                backgroundColor: f.color,
                opacity: f.opacity,
                transform: [
                  { translateX: f.translateX },
                  { translateY: f.translateY },
                  { rotate: f.rotation.interpolate({ inputRange: [-180, 180], outputRange: ['-180deg', '180deg'] }) },
                ],
              }}
            />
          ))}
        </View>

        <Animated.View style={[s.card, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}>
          <Text style={[s.title, { color: c.primary }]}>League Complete</Text>
          <Text style={[s.leagueName, { color: '#8BA3B0' }]}>{leagueName}</Text>

          {myMember && (
            <View style={s.avatarRow}>
              <BirdAvatar birdStyle={birdStyle} size={72} />
            </View>
          )}

          <Text style={s.rankDisplay}>{rankLabel}</Text>
          <Text style={[s.rankSub, { color: '#8BA3B0' }]}>
            out of {totalMembers} {totalMembers === 1 ? 'birder' : 'birders'}
          </Text>

          {myMember && (
            <Text style={[s.stats, { color: c.gray }]}>
              {myMember.sightingCount} bird{myMember.sightingCount !== 1 ? 's' : ''} · {myMember.points} pts
            </Text>
          )}

          <TouchableOpacity style={[s.btn, { backgroundColor: c.primary }]} onPress={onClose} activeOpacity={0.85}>
            <Text style={s.btnText}>Nice!</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 32, alignItems: 'center', width: W * 0.82, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 12 },
  title: { fontSize: 22, fontFamily: 'Nunito_800ExtraBold', marginBottom: 4 },
  leagueName: { fontSize: 14, fontFamily: 'Nunito_600SemiBold', marginBottom: 20, textAlign: 'center' },
  avatarRow: { marginBottom: 16 },
  rankDisplay: { fontSize: 64, fontFamily: 'Nunito_800ExtraBold', color: '#1C1C1E', lineHeight: 72 },
  rankSub: { fontSize: 15, fontFamily: 'Nunito_600SemiBold', marginTop: 4, marginBottom: 8 },
  stats: { fontSize: 14, fontFamily: 'Nunito_600SemiBold', marginBottom: 24 },
  btn: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40 },
  btnText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Nunito_800ExtraBold' },
});
