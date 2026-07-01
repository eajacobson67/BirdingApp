import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { FilterImage } from 'react-native-svg/filter-image';
import { useColors } from '../../store/themeStore';
import type { Badge } from './BadgeIcon';

function buildColorMatrix(darkHex: string, lightHex: string): number[] {
  const parse = (h: string): [number, number, number] => {
    const s = h.replace('#', '');
    return [parseInt(s.slice(0, 2), 16) / 255, parseInt(s.slice(2, 4), 16) / 255, parseInt(s.slice(4, 6), 16) / 255];
  };
  const [r1, g1, b1] = parse(darkHex);
  const [r2, g2, b2] = parse(lightHex);
  const dr = (r2 - r1) / 3, dg = (g2 - g1) / 3, db = (b2 - b1) / 3;
  // prettier-ignore
  return [
    dr, dr, dr, 0, r1,
    dg, dg, dg, 0, g1,
    db, db, db, 0, b1,
     0,  0,  0, 1,  0,
  ];
}

interface Props {
  badge: Badge;
  onContinue: () => void;
}

export function BadgeUnlockModal({ badge, onContinue }: Props) {
  const c = useColors();
  const matrix = buildColorMatrix(c.primary, c.background);
  const filters = [{ name: 'feColorMatrix' as const, type: 'matrix' as const, values: matrix }];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onContinue}>
      <View style={s.overlay}>
        <View style={[s.card, { backgroundColor: c.surface }]}>
          <Text style={[s.title, { color: c.textPrimary }]}>You've received a new badge!</Text>
          <Text style={[s.badgeName, { color: c.primary }]}>{badge.label}</Text>
          <View style={[s.imgWrap, { borderColor: c.primary + '40', backgroundColor: c.background }]}>
            <FilterImage
              source={badge.pngAsset}
              style={s.img}
              filters={filters}
              resizeMode="contain"
            />
          </View>
          <TouchableOpacity
            style={[s.btn, { backgroundColor: c.primary }]}
            onPress={onContinue}
            activeOpacity={0.8}
          >
            <Text style={s.btnText}>Continue</Text>
          </TouchableOpacity>
        </View>
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
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Nunito_800ExtraBold',
    textAlign: 'center',
    lineHeight: 28,
  },
  badgeName: {
    fontSize: 16,
    fontFamily: 'Nunito_700Bold',
    textAlign: 'center',
  },
  imgWrap: {
    width: 160,
    height: 160,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  img: {
    width: 140,
    height: 140,
  },
  btn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  btnText: { fontSize: 15, fontFamily: 'Nunito_700Bold', color: '#FFFFFF' },
});
