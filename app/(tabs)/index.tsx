import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WaxwingButton } from '../../components/home/WaxwingButton';
import { LogSubButton } from '../../components/home/LogSubButton';
import { Colors } from '../../constants/colors';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.topSpacer} />

        <View style={styles.centerContent}>
          <Text style={styles.hint}>Tap to log a sighting</Text>
          <WaxwingButton
            size={160}
            onPress={() => router.push('/log/select')}
          />
        </View>

        <View style={styles.subButtons}>
          <LogSubButton
            icon="🎙️"
            label="Sound ID"
            onPress={() => router.push('/log/audio')}
          />
          <LogSubButton
            icon="📷"
            label="Photo"
            onPress={() => router.push('/log/camera')}
          />
        </View>

        <View style={styles.bottomSpacer} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'space-between' },
  topSpacer: { flex: 1 },
  centerContent: { alignItems: 'center', gap: 24 },
  hint: {
    fontSize: 13,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  subButtons: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 48,
  },
  bottomSpacer: { flex: 1.2 },
});
