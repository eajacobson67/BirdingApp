import { View, Text } from 'react-native';
import { useColors } from '../../store/themeStore';
import type { UserProfile } from '../../lib/firestore/users';

export interface Badge {
  id: string;
  emoji: string;
  label: string;
  check: (profile: UserProfile | null) => boolean;
}

export const BADGES: Badge[] = [
  { id: 'first', emoji: '🥚', label: 'First Bird', check: (p) => (p?.totalSightings ?? 0) >= 1 },
  { id: 'ten', emoji: '🐣', label: '10 Species', check: (p) => (p?.totalSpecies ?? 0) >= 10 },
  { id: 'fifty', emoji: '🦅', label: '50 Species', check: (p) => (p?.totalSpecies ?? 0) >= 50 },
  { id: 'hundred', emoji: '🏅', label: '100 Species', check: (p) => (p?.totalSpecies ?? 0) >= 100 },
  { id: 'traveler', emoji: '🗺️', label: 'State Traveler', check: (p) => (p?.statesVisited?.length ?? 0) >= 3 },
  { id: 'bigyear25', emoji: '📅', label: '25 Big Year', check: (p) => {
    const year = new Date().getFullYear().toString();
    return (p?.yearSpecies?.[year]?.length ?? 0) >= 25;
  }},
  { id: 'waxwing', emoji: '🦜', label: 'Cedar Waxwing Fan', check: (p) => {
    return Object.values(p?.yearSpecies ?? {}).flat().includes('Cedar Waxwing');
  }},
];

interface Props { badge: Badge }

export function BadgeIcon({ badge }: Props) {
  const c = useColors();
  return (
    <View style={{
      alignItems: 'center', gap: 6,
      backgroundColor: c.surface,
      borderRadius: 12, padding: 12,
      minWidth: 76, borderWidth: 1, borderColor: c.border,
    }}>
      <Text style={{ fontSize: 28 }}>{badge.emoji}</Text>
      <Text style={{ fontSize: 10, color: c.gray, textAlign: 'center', fontWeight: '600' }}>
        {badge.label}
      </Text>
    </View>
  );
}
