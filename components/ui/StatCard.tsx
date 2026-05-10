import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';

interface Props {
  label: string;
  value: number | string;
  accent?: boolean;
}

export function StatCard({ label, value, accent }: Props) {
  return (
    <View style={[styles.card, accent && styles.cardAccent]}>
      <Text style={[styles.value, accent && styles.valueAccent]}>{value}</Text>
      <Text style={[styles.label, accent && styles.labelAccent]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '22%',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardAccent: {
    backgroundColor: Colors.yellow,
    borderColor: Colors.yellow,
  },
  value: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  valueAccent: { color: Colors.black },
  label: { fontSize: 11, color: Colors.gray, marginTop: 4, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },
  labelAccent: { color: Colors.black, opacity: 0.7 },
});
