import { useRef, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Easing,
  Modal, Dimensions,
} from 'react-native';
import { Svg, G, Rect } from 'react-native-svg';
import { BirdAvatar } from './BirdAvatar';
import type { BirdStyle } from '../../lib/birdStyles';

const RAYS      = 16;
const SIZE      = 260;
const CENTER    = SIZE / 2;
const RAY_OUTER = 120;
const RAY_INNER = 48;
const RAY_W     = 18;

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
  birdStyle: BirdStyle;
  onSelectNow: () => void;
  onContinue: () => void;
}

export function BirdUnlockModal({ birdStyle, onSelectNow, onContinue }: Props) {
  const spin    = useRef(new Animated.Value(0)).current;
  const nextId  = useRef(0);
  const [feathers, setFeathers] = useState<Feather[]>([]);

  const { primary, accent, gray, border } = birdStyle.theme;
  const featherColors = [primary, accent, gray, border];

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 12000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();

    const count = 10 + Math.floor(Math.random() * 6);
    const newFeathers: Feather[] = Array.from({ length: count }, () => {
      const halfPeriod = 280 + Math.random() * 200;
      const cycles     = 4 + Math.floor(Math.random() * 4);
      const totalDur   = halfPeriod * cycles;
      const swayAmp    = 35 + Math.random() * 45;
      const tiltAmp    = 22 + Math.random() * 28;
      const startDir   = (Math.random() > 0.5 ? 1 : -1) as 1 | -1;
      const travelY    = -(200 + Math.random() * 300); // upward

      return {
        id:       ++nextId.current,
        width:    5 + Math.random() * 7,
        height:   (5 + Math.random() * 7) * (2.5 + Math.random()),
        startX:   (Math.random() - 0.5) * 200,
        color:    featherColors[Math.floor(Math.random() * featherColors.length)],
        travelY, totalDur, halfPeriod, cycles, swayAmp, tiltAmp, startDir,
        translateX: new Animated.Value(startDir * swayAmp * 0.3),
        translateY: new Animated.Value(0),
        opacity:    new Animated.Value(0.85),
        rotation:   new Animated.Value(startDir * tiltAmp * 0.3),
      };
    });

    setFeathers(newFeathers);

    requestAnimationFrame(() => {
      newFeathers.forEach(f => {
        Animated.parallel([
          Animated.timing(f.translateY, {
            toValue: f.travelY,
            duration: f.totalDur,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(f.opacity, {
            toValue: 0,
            duration: f.totalDur,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          buildSway(f.translateX, f.swayAmp, f.halfPeriod, f.cycles, f.startDir),
          buildSway(f.rotation,   f.tiltAmp, f.halfPeriod, f.cycles, f.startDir),
        ]).start(() => setFeathers(prev => prev.filter(x => x.id !== f.id)));
      });
    });
  }, []);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const { width: SW, height: SH } = Dimensions.get('window');

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onContinue}>
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.title}>
            <Text style={[s.birdName, { color: primary }]}>{birdStyle.label}</Text>
            {' has been added\nto your nest!'}
          </Text>

          <View style={s.raysWrap}>
            <Animated.View style={{ transform: [{ rotate }] }}>
              <Svg width={SIZE} height={SIZE}>
                <G x={CENTER} y={CENTER}>
                  {Array.from({ length: RAYS }).map((_, i) => (
                    <Rect
                      key={i}
                      x={-RAY_W / 2}
                      y={-RAY_OUTER}
                      width={RAY_W}
                      height={RAY_OUTER - RAY_INNER}
                      rx={RAY_W / 2}
                      fill={i % 2 === 0 ? primary : accent}
                      opacity={i % 2 === 0 ? 0.35 : 0.2}
                      transform={`rotate(${i * (360 / RAYS)} 0 0)`}
                    />
                  ))}
                </G>
              </Svg>
            </Animated.View>

            <View style={s.avatarWrap} pointerEvents="none">
              <BirdAvatar birdStyle={birdStyle} size={110} />
            </View>
          </View>

          <View style={s.btnRow}>
            <TouchableOpacity
              style={[s.btn, s.btnSecondary, { borderColor: primary }]}
              onPress={onContinue}
              activeOpacity={0.8}
            >
              <Text style={[s.btnText, { color: primary }]}>Continue</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btn, s.btnPrimary, { backgroundColor: primary }]}
              onPress={onSelectNow}
              activeOpacity={0.8}
            >
              <Text style={[s.btnText, { color: '#FFFFFF' }]}>Select now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Feathers rendered full-screen so they overflow the card */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {feathers.map(f => (
          <Animated.View
            key={f.id}
            style={{
              position: 'absolute',
              width:        f.width,
              height:       f.height,
              borderRadius: f.width / 2,
              backgroundColor: f.color,
              left: SW / 2 + f.startX - f.width / 2,
              top:  SH / 2 - f.height / 2,
              opacity: f.opacity,
              transform: [
                { translateX: f.translateX },
                { translateY: f.translateY },
                { rotate: f.rotation.interpolate({
                    inputRange:  [-60, 60],
                    outputRange: ['-60deg', '60deg'],
                    extrapolate: 'clamp',
                  }),
                },
              ],
            }}
          />
        ))}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    gap: 20,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Nunito_700Bold',
    textAlign: 'center',
    color: '#1C1C1E',
    lineHeight: 26,
  },
  birdName: { fontFamily: 'Nunito_800ExtraBold' },
  raysWrap: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRow: { flexDirection: 'row', gap: 12, width: '100%' },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnPrimary: {},
  btnSecondary: { borderWidth: 1.5 },
  btnText: { fontSize: 15, fontFamily: 'Nunito_700Bold' },
});
