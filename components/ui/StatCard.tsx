import { View, Text } from 'react-native';
import { useColors } from '../../store/themeStore';

interface Props {
  label: string;
  value: number | string;
  accent?: boolean;
}

export function StatCard({ label, value, accent }: Props) {
  const c = useColors();
  return (
    <View style={{
      flex: 1, minWidth: '22%',
      backgroundColor: accent ? c.accent : c.surface,
      borderRadius: 12, padding: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: accent ? c.accent : c.border,
    }}>
      <Text style={{ fontSize: 24, fontWeight: '800', color: accent ? c.black : c.textPrimary }}>
        {value}
      </Text>
      <Text style={{
        fontSize: 11, color: accent ? c.black : c.gray,
        marginTop: 4, textAlign: 'center',
        textTransform: 'uppercase', letterSpacing: 0.5,
        opacity: accent ? 0.75 : 1,
      }}>
        {label}
      </Text>
    </View>
  );
}
