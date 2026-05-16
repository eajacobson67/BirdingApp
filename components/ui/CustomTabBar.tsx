import { useRef, useEffect } from 'react';
import { View, Pressable, Animated } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useThemeStore } from '../../store/themeStore';

const NAV_H  = 64;   // visible tab bar row height
const PILL_W = 68;   // pill width
const PEEK   = 28;   // how far pill dome rises above nav bar top
const ICON_F = 52;   // focused icon size
const ICON_U = 36;   // unfocused icon size (via scale)

const PILL_H = NAV_H + PEEK;   // pill reaches from dome top to nav bar bottom

const SOURCES: Record<string, number> = {
  index:       require('../../assets/buttons/new_bird_button.png'),
  map:         require('../../assets/buttons/map_button.png'),
  league:      require('../../assets/buttons/league_button.png'),
  leaderboard: require('../../assets/buttons/trophy_button.png'),
  profile:     require('../../assets/buttons/user_button.png'),
};

const LABELS: Record<string, string> = {
  index:       'Log',
  map:         'Map',
  league:      'League',
  leaderboard: 'Ranks',
  profile:     'Me',
};

export function CustomTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { birdStyle } = useThemeStore();
  const t = birdStyle.theme;

  const anims = useRef(
    state.routes.map((_, i) => new Animated.Value(i === state.index ? 1 : 0))
  ).current;

  useEffect(() => {
    Animated.parallel(
      anims.map((a, i) =>
        Animated.spring(a, {
          toValue: i === state.index ? 1 : 0,
          useNativeDriver: true,
          tension: 160,
          friction: 13,
        })
      )
    ).start();
  }, [state.index]);

  const uscale = ICON_U / ICON_F;

  return (
    <View style={{ backgroundColor: t.surface, borderTopColor: t.border, borderTopWidth: 1, overflow: 'visible' }}>
      <View style={{ flexDirection: 'row', height: NAV_H, overflow: 'visible' }}>
        {state.routes.map((route, i) => {
          const a = anims[i];

          // Pill slides up slightly as it appears
          const pillOpacity    = a;
          const pillTranslateY = a.interpolate({ inputRange: [0, 1], outputRange: [6, 0] });

          // Icon floats up into the peek zone when focused
          const iconTranslateY = a.interpolate({ inputRange: [0, 1], outputRange: [0, -PEEK] });
          const iconScale      = a.interpolate({ inputRange: [0, 1], outputRange: [uscale, 1] });
          const whiteOpacity   = a;
          const grayOpacity    = a.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
          const labelOpacity   = a.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 0, 0] });

          const src = SOURCES[route.name];

          return (
            <Pressable
              key={route.key}
              onPress={() => navigation.navigate(route.name)}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'visible' }}
            >
              {/* Pill: rounded dome top, straight sides, extends to nav bar bottom */}
              <Animated.View style={{
                position: 'absolute',
                top: -PEEK,
                width: PILL_W,
                height: PILL_H,
                borderTopLeftRadius: PILL_W / 2,
                borderTopRightRadius: PILL_W / 2,
                backgroundColor: t.primary,
                opacity: pillOpacity,
                transform: [{ translateY: pillTranslateY }],
                shadowColor: t.primary,
                shadowOffset: { width: 0, height: -3 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6,
              }} />

              {/* Icon — floats up into peek zone when focused */}
              <Animated.View style={{
                width: ICON_F, height: ICON_F,
                alignItems: 'center', justifyContent: 'center',
                transform: [{ translateY: iconTranslateY }],
              }}>
                <Animated.Image
                  source={src}
                  style={{
                    position: 'absolute',
                    width: ICON_F, height: ICON_F,
                    tintColor: t.gray,
                    opacity: grayOpacity,
                    transform: [{ scale: iconScale }],
                  }}
                  resizeMode="contain"
                />
                <Animated.Image
                  source={src}
                  style={{
                    position: 'absolute',
                    width: ICON_F, height: ICON_F,
                    tintColor: '#FFFFFF',
                    opacity: whiteOpacity,
                    transform: [{ scale: iconScale }],
                  }}
                  resizeMode="contain"
                />
              </Animated.View>

              {/* Label — fades out when focused */}
              <Animated.Text style={{
                position: 'absolute',
                bottom: 5,
                fontSize: 10,
                fontWeight: '600',
                color: t.gray,
                opacity: labelOpacity,
              }}>
                {LABELS[route.name] ?? route.name}
              </Animated.Text>
            </Pressable>
          );
        })}
      </View>

      {(insets?.bottom ?? 0) > 0 && (
        <View style={{ height: insets.bottom, backgroundColor: t.surface }} />
      )}
    </View>
  );
}
