import { View, Text, Image, ImageSourcePropType } from 'react-native';
import { useColors } from '../../store/themeStore';

const BIRD_PNGS: Partial<Record<string, ImageSourcePropType>> = {
  waxwing:  require('../../assets/birds/cedar_waxwing.png'),
  cardinal: require('../../assets/birds/cardinal.png'),
  robin:    require('../../assets/birds/robin.png'),
};

interface Props {
  photoURL?: string | null;
  birdStyleId?: string | null;
  size?: number;
}

export function Avatar({ photoURL, birdStyleId, size = 44 }: Props) {
  const c = useColors();

  if (photoURL) {
    return (
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        overflow: 'hidden',
        backgroundColor: c.background,
        borderWidth: 1.5, borderColor: c.border,
      }}>
        <Image source={{ uri: photoURL }} style={{ width: size, height: size }} />
      </View>
    );
  }

  const pngSource = birdStyleId ? BIRD_PNGS[birdStyleId] : undefined;
  if (pngSource) {
    return <Image source={pngSource} style={{ width: size, height: size }} resizeMode="contain" />;
  }

  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: c.background,
      borderWidth: 1.5, borderColor: c.border,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: size * 0.5 }}>🐦</Text>
    </View>
  );
}
