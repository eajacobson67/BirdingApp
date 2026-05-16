import { TouchableOpacity, Image, ImageSourcePropType } from 'react-native';
import { useColors } from '../../store/themeStore';

interface Props {
  source: ImageSourcePropType;
  onPress: () => void;
  size?: number;
}

export function LogSubButton({ source, onPress, size = 64 }: Props) {
  const c = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        width: size, height: size,
        borderRadius: size / 2,
        backgroundColor: c.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.32,
        shadowRadius: 14,
        elevation: 12,
      }}
    >
      <Image
        source={source}
        style={{ width: size, height: size, tintColor: '#FFFFFF' }}
        resizeMode="contain"
      />
    </TouchableOpacity>
  );
}
