import { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useColors } from '../../store/themeStore';
import { getNearbyCommonBirds, CommonBird } from '../../lib/commonBirds';
import { getCurrentLocation } from '../../lib/location';
import { getRarity, RARITY_COLORS, RARITY_LABELS } from '../../lib/birdRarity';

interface Props {
  visible: boolean;
  onSelect: (bird: CommonBird) => void;
  onClose: () => void;
}

export default function SelectBirdModal({ visible, onSelect, onClose }: Props) {
  const c = useColors();
  const [search, setSearch] = useState('');
  const [birds, setBirds] = useState<CommonBird[]>([]);
  const [filtered, setFiltered] = useState<CommonBird[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    getCurrentLocation().then(async (loc) => {
      const list = await getNearbyCommonBirds(loc?.lat ?? 0, loc?.lng ?? 0);
      setBirds(list);
      setFiltered(list);
      setLoading(false);
    });
  }, [visible]);

  useEffect(() => {
    if (!search.trim()) { setFiltered(birds); return; }
    const q = search.toLowerCase();
    setFiltered(birds.filter((b) => b.commonName.toLowerCase().includes(q) || b.scientificName.toLowerCase().includes(q)));
  }, [search, birds]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 28 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: c.textPrimary }}>Select Species</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ fontSize: 20, color: c.gray, padding: 4 }}>✕</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={{
            marginHorizontal: 16, marginBottom: 8,
            backgroundColor: c.surface, borderRadius: 12,
            paddingHorizontal: 16, paddingVertical: 12,
            fontSize: 16, color: c.textPrimary,
            borderWidth: 1, borderColor: c.border,
          }}
          placeholder="Search..."
          placeholderTextColor={c.gray}
          value={search}
          onChangeText={setSearch}
        />
        {loading ? (
          <ActivityIndicator color={c.primary} style={{ marginTop: 40 }} size="large" />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.speciesCode}
            renderItem={({ item }) => {
              const rarity = getRarity(item.commonName);
              const rarityColor = RARITY_COLORS[rarity];
              return (
                <TouchableOpacity
                  style={{ paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.border }}
                  onPress={() => onSelect(item)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: c.textPrimary, flex: 1 }}>{item.commonName}</Text>
                    <View style={{
                      backgroundColor: rarityColor + '22',
                      borderWidth: 1, borderColor: rarityColor,
                      borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2,
                    }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: rarityColor }}>{RARITY_LABELS[rarity]}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 13, color: c.gray, fontStyle: 'italic', marginTop: 2 }}>{item.scientificName}</Text>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}
