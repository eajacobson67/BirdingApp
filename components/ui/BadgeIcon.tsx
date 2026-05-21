import { View, Text } from 'react-native';
import { FilterImage } from 'react-native-svg/filter-image';
import { useColors } from '../../store/themeStore';
import type { UserProfile } from '../../lib/firestore/users';

export interface Badge {
  id: string;
  label: string;
  pngAsset: number;
  check: (profile: UserProfile | null) => boolean;
}

export const BADGES: Badge[] = [
  {
    id: 'first', label: 'First Bird',
    pngAsset: require('../../assets/badges/1st_bird.png'),
    check: (p) => (p?.totalSightings ?? 0) >= 1,
  },
  {
    id: 'ten', label: '10 Species',
    pngAsset: require('../../assets/badges/10_bird.png'),
    check: (p) => (p?.totalSpecies ?? 0) >= 10,
  },
  {
    id: 'fifty', label: '50 Species',
    pngAsset: require('../../assets/badges/50_bird.png'),
    check: (p) => (p?.totalSpecies ?? 0) >= 50,
  },
  {
    id: 'waxwing', label: 'Waxwinger',
    pngAsset: require('../../assets/badges/cedar_waxwing.png'),
    check: (p) => Object.values(p?.yearSpecies ?? {}).flat().includes('Cedar Waxwing'),
  },
];

// Maps black (0,0,0) → darkHex and white (1,1,1) → lightHex, preserving alpha.
// Each row of the 4×5 matrix: [rR, rG, rB, rA, rConst].
// For a greyscale source (R=G=B=v): output = lightHex*v + darkHex*(1-v).
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

const BADGE_WIDTH = 80;

interface Props { badge: Badge }

export function BadgeIcon({ badge }: Props) {
  const c = useColors();
  const matrix = buildColorMatrix(c.primary, c.background);
  const filters = [{ name: 'feColorMatrix' as const, type: 'matrix' as const, values: matrix }];

  return (
    <View style={{
      width: BADGE_WIDTH,
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1.5, borderColor: c.primary + '40',
      overflow: 'hidden',
      alignItems: 'center',
    }}>
      <FilterImage
        source={badge.pngAsset}
        style={{ width: BADGE_WIDTH, height: BADGE_WIDTH }}
        filters={filters}
        resizeMode="contain"
      />
      <Text style={{
        fontSize: 10, color: c.primary, textAlign: 'center',
        fontFamily: 'Nunito_700Bold', paddingHorizontal: 6, paddingVertical: 6,
      }}>
        {badge.label}
      </Text>
    </View>
  );
}
