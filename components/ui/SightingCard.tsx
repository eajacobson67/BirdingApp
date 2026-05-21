import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useColors } from '../../store/themeStore';
import type { Sighting } from '../../lib/firestore/sightings';

const PLACEHOLDER = require('../../assets/buttons/placeholder_bird.png');

interface Props {
  sighting: Sighting;
  isFirst: boolean;
  onPress: () => void;
}

export function SightingCard({ sighting, isFirst, onPress }: Props) {
  const c = useColors();
  return (
    <TouchableOpacity
      style={[s.card, { backgroundColor: c.surface, borderColor: c.border }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {sighting.photoURL ? (
        <Image source={{ uri: sighting.photoURL }} style={s.photo} />
      ) : (
        <Image source={PLACEHOLDER} style={s.photo} resizeMode="contain" />
      )}
      <View style={s.info}>
        <View style={s.titleRow}>
          <Text style={[s.species, { color: c.textPrimary }]} numberOfLines={1}>
            {sighting.commonName}
          </Text>
          {isFirst && (
            <View style={[s.firstBadge, { backgroundColor: c.accent + '22' }]}>
              <Text style={[s.firstText, { color: c.accent }]}>✨ First!</Text>
            </View>
          )}
        </View>
        {!!sighting.locationName && (
          <Text style={[s.location, { color: c.gray }]} numberOfLines={1}>
            {sighting.locationName}
          </Text>
        )}
        <Text style={[s.time, { color: c.gray }]}>{formatAgo(sighting.timestamp)}</Text>
      </View>
    </TouchableOpacity>
  );
}

function formatAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  photo: { width: 72, height: 72, borderRadius: 10 },
  info: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  species: { fontSize: 15, fontFamily: 'Nunito_700Bold', flexShrink: 1 },
  firstBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  firstText: { fontSize: 11, fontFamily: 'Nunito_700Bold' },
  location: { fontSize: 13 },
  time: { fontSize: 12 },
});
