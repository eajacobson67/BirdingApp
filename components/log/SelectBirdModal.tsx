import { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { getNearbyCommonBirds, CommonBird } from '../../lib/commonBirds';
import { getCurrentLocation } from '../../lib/location';

interface Props {
  visible: boolean;
  onSelect: (bird: CommonBird) => void;
  onClose: () => void;
}

export default function SelectBirdModal({ visible, onSelect, onClose }: Props) {
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
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Select Species</Text>
          <TouchableOpacity onPress={onClose}><Text style={styles.close}>✕</Text></TouchableOpacity>
        </View>
        <TextInput
          style={styles.search}
          placeholder="Search..."
          placeholderTextColor={Colors.gray}
          value={search}
          onChangeText={setSearch}
        />
        {loading ? (
          <ActivityIndicator color={Colors.brown} style={{ marginTop: 40 }} size="large" />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.speciesCode}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.row} onPress={() => onSelect(item)} activeOpacity={0.7}>
                <Text style={styles.common}>{item.commonName}</Text>
                <Text style={styles.sci}>{item.scientificName}</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 28 },
  title: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  close: { fontSize: 20, color: Colors.gray, padding: 4 },
  search: { margin: 16, marginTop: 0, backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border },
  row: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  common: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  sci: { fontSize: 13, color: Colors.gray, fontStyle: 'italic', marginTop: 2 },
});
