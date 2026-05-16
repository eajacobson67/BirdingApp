import { useRef, useState, useCallback } from 'react';
import { Animated, Easing, Image, ImageSourcePropType, Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import type { BirdStyle } from '../../lib/birdStyles';
import { BIRD_STYLES } from '../../lib/birdStyles';


const BIRD_PNGS: Partial<Record<string, ImageSourcePropType>> = {
  waxwing:        require('../../assets/birds/cedar_waxwing.png'),
  cardinal:       require('../../assets/birds/cardinal.png'),
  robin:          require('../../assets/birds/robin.png'),
  hummingbird:    require('../../assets/birds/hummingbird.png'),
  paintedbunting: require('../../assets/birds/painted_bunting.png'),
};

const BIRD_SHADOWS: Partial<Record<string, ImageSourcePropType>> = {
  waxwing:        require('../../assets/birds/waxwing_shadow.png'),
  cardinal:       require('../../assets/birds/cardinal_shadow.png'),
  robin:          require('../../assets/birds/robin_shadow.png'),
  hummingbird:    require('../../assets/birds/hummingbird_shadow.png'),
  paintedbunting: require('../../assets/birds/paintedbunting_shadow.png'),
};

interface Feather {
  id: number;
  startX: number;
  width: number;
  height: number;
  color: string;
  // animation params (needed in rAF callback)
  travelY: number;
  totalDur: number;
  halfPeriod: number;
  cycles: number;
  swayAmp: number;
  tiltAmp: number;
  startDir: 1 | -1;
  // animated values
  translateX: Animated.Value;
  translateY: Animated.Value;
  opacity: Animated.Value;
  rotation: Animated.Value;   // raw degrees, oscillates ± tiltAmp
}

export interface WaveAnimations {
  scales: Animated.Value[];
  opacities: Animated.Value[];
}

interface Props {
  onPress: () => void;
  size?: number;
  birdStyle?: BirdStyle;
  ringSize?: number;
  waveAnimations: WaveAnimations;
}

// Build an oscillating sway sequence with eased reversals
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
      })
    );
    dir = (-dir) as 1 | -1;
  }
  return Animated.sequence(steps);
}

export function WaxwingButton({ onPress, size = 180, birdStyle, ringSize, waveAnimations }: Props) {
  const b = birdStyle ?? BIRD_STYLES[0];
  const pngSource = BIRD_PNGS[b.id];
  const featherColors = [b.theme.primary, b.theme.accent, b.theme.gray, b.theme.border];

  const ringScale = ringSize ? ringSize / size : 1.0;
  const { scales: waveScales, opacities: waveOpacities } = waveAnimations;

  const scale        = useRef(new Animated.Value(1)).current;
  const birdY        = useRef(new Animated.Value(0)).current;
  const birdOpacity  = useRef(new Animated.Value(1)).current;
  const shakeX       = useRef(new Animated.Value(0)).current;

  const holdRef = useRef<Animated.CompositeAnimation | null>(null);
  const waveRef = useRef<Animated.CompositeAnimation | null>(null);
  const [feathers, setFeathers] = useState<Feather[]>([]);
  const nextId = useRef(0);

  useFocusEffect(
    useCallback(() => {
      holdRef.current?.stop();
      waveRef.current?.stop();
      holdRef.current = null;
      waveRef.current = null;
      scale.setValue(1);
      birdY.setValue(0);
      shakeX.setValue(0);
      waveScales.forEach((ws, i) => { ws.setValue(ringScale); waveOpacities[i].setValue(0); });
      setFeathers([]);
      birdOpacity.setValue(0);
      Animated.timing(birdOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }, [])
  );

  function handlePressIn() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Animated.timing(scale, { toValue: 0.93, duration: 200, useNativeDriver: true }).start();

    holdRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(shakeX, { toValue: 5,  duration: 45, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -5, duration: 45, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 3,  duration: 45, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: -3, duration: 45, useNativeDriver: true }),
        Animated.timing(shakeX, { toValue: 0,  duration: 45, useNativeDriver: true }),
      ])
    );
    holdRef.current.start();

    waveScales.forEach((ws, i) => { ws.setValue(ringScale); waveOpacities[i].setValue(0); });

    waveRef.current = Animated.loop(
      Animated.stagger(300,
        waveScales.map((ws, i) =>
          Animated.sequence([
            Animated.parallel([
              Animated.timing(ws,               { toValue: ringScale, duration: 10,  useNativeDriver: true }),
              Animated.timing(waveOpacities[i], { toValue: 0,         duration: 10,  useNativeDriver: true }),
            ]),
            Animated.parallel([
              Animated.timing(ws, { toValue: ringScale + 1.8, duration: 900, useNativeDriver: true }),
              Animated.sequence([
                Animated.timing(waveOpacities[i], { toValue: 0.25, duration: 130, useNativeDriver: true }),
                Animated.timing(waveOpacities[i], { toValue: 0,    duration: 770, useNativeDriver: true }),
              ]),
            ]),
          ])
        )
      )
    );
    waveRef.current.start();
  }

  function handlePressOut() {
    holdRef.current?.stop();
    waveRef.current?.stop();
    holdRef.current = null;
    waveRef.current = null;
    shakeX.setValue(0);
    waveScales.forEach((ws, i) => { ws.setValue(ringScale); waveOpacities[i].setValue(0); });

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const count = 7 + Math.floor(Math.random() * 5);
    const newFeathers: Feather[] = Array.from({ length: count }, () => {
      const halfPeriod = 280 + Math.random() * 200;   // 280–480 ms per swing
      const cycles     = 4 + Math.floor(Math.random() * 4);  // 4–7 swings
      const totalDur   = halfPeriod * cycles;
      const swayAmp    = 35 + Math.random() * 45;     // 35–80 px horizontal
      const tiltAmp    = 22 + Math.random() * 28;     // 22–50 ° tilt
      const startDir   = (Math.random() > 0.5 ? 1 : -1) as 1 | -1;
      const travelY    = 320 + Math.random() * 250;   // fall 320–570 px

      return {
        id:       ++nextId.current,
        width:    5 + Math.random() * 7,
        height:   (5 + Math.random() * 7) * (2.5 + Math.random()),
        startX:   (Math.random() - 0.5) * size * 0.6,
        color:    featherColors[Math.floor(Math.random() * featherColors.length)],
        travelY, totalDur, halfPeriod, cycles, swayAmp, tiltAmp, startDir,
        translateX: new Animated.Value(startDir * swayAmp * 0.3),
        translateY: new Animated.Value(0),
        opacity:    new Animated.Value(0.85),
        rotation:   new Animated.Value(startDir * tiltAmp * 0.3),
      };
    });

    setFeathers(prev => [...prev, ...newFeathers]);

    requestAnimationFrame(() => {
      newFeathers.forEach(f => {
        Animated.parallel([
          // Fast burst outward, then drifts and slows
          Animated.timing(f.translateY, {
            toValue: f.travelY,
            duration: f.totalDur,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          // Stay visible through most of the fall, fade at the end
          Animated.timing(f.opacity, {
            toValue: 0,
            duration: f.totalDur,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          // Side-to-side sway
          buildSway(f.translateX, f.swayAmp, f.halfPeriod, f.cycles, f.startDir),
          // Tilt matching the sway direction
          buildSway(f.rotation,   f.tiltAmp, f.halfPeriod, f.cycles, f.startDir),
        ]).start(() => setFeathers(prev => prev.filter(x => x.id !== f.id)));
      });
    });

    Animated.parallel([
      Animated.timing(birdY,       { toValue: -size * 4, duration: 300, useNativeDriver: true }),
      Animated.timing(scale,       { toValue: 1.3,       duration: 300, useNativeDriver: true }),
      Animated.timing(birdOpacity, { toValue: 0,         duration: 230, useNativeDriver: true }),
    ]).start(() => onPress());
  }

  const shadowSource = BIRD_SHADOWS[b.id];
  const shadowInset = size * 0.015;

  const bird = (
    <Animated.View
      style={{
        width: size, height: size,
        opacity: birdOpacity,
        transform: [{ scale }, { translateY: birdY }, { translateX: shakeX }],
      }}
    >
      {shadowSource && (
        <Image
          source={shadowSource}
          resizeMode="contain"
          style={{
            position: 'absolute',
            width: size + shadowInset * 2,
            height: size + shadowInset * 2,
            top: -shadowInset,
            left: -shadowInset,
            opacity: 0.22,
          }}
        />
      )}
      {pngSource
        ? <Image source={pngSource} resizeMode="contain" style={{ width: size, height: size }} />
        : <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: b.body }} />
      }
    </Animated.View>
  );

  return (
    <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', overflow: 'visible' }}>

        {/* Feathers fall behind the bird */}
        {feathers.map(f => (
          <Animated.View
            key={f.id}
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: f.width,
              height: f.height,
              borderRadius: f.width / 2,
              backgroundColor: f.color,
              left: size / 2 + f.startX - f.width / 2,
              top:  size / 2 - f.height / 2,
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

        {/* Bird on top */}
        {bird}

      </View>
    </Pressable>
  );
}
