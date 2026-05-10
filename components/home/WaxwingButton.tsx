import { TouchableWithoutFeedback, View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Colors } from '../../constants/colors';

interface Props {
  onPress: () => void;
  size?: number;
}

export function WaxwingButton({ onPress, size = 160 }: Props) {
  const scale = useSharedValue(1);
  const wingLeft = useSharedValue(0);
  const wingRight = useSharedValue(0);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const leftWingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${wingLeft.value}deg` }],
  }));

  const rightWingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${wingRight.value}deg` }],
  }));

  function animate() {
    // Quick wing flap sequence
    wingLeft.value = withSequence(
      withTiming(-30, { duration: 80 }),
      withTiming(10, { duration: 80 }),
      withTiming(-25, { duration: 70 }),
      withTiming(5, { duration: 70 }),
      withSpring(0, { damping: 8 }),
    );
    wingRight.value = withSequence(
      withTiming(30, { duration: 80 }),
      withTiming(-10, { duration: 80 }),
      withTiming(25, { duration: 70 }),
      withTiming(-5, { duration: 70 }),
      withSpring(0, { damping: 8 }),
    );
    scale.value = withSequence(
      withTiming(0.92, { duration: 100 }),
      withTiming(1.08, { duration: 150 }),
      withSpring(1, { damping: 6, stiffness: 150 }, () => {
        runOnJS(onPress)();
      }),
    );
  }

  const bodySize = size;
  const wingW = size * 0.38;
  const wingH = size * 0.2;

  return (
    <TouchableWithoutFeedback onPress={animate}>
      <View style={[styles.container, { width: bodySize + wingW * 2, height: bodySize }]}>
        {/* Left wing */}
        <Animated.View
          style={[
            styles.wing,
            styles.wingLeft,
            leftWingStyle,
            { width: wingW, height: wingH, top: bodySize * 0.3 },
          ]}
        />

        {/* Body */}
        <Animated.View
          style={[
            styles.body,
            bodyStyle,
            { width: bodySize, height: bodySize, borderRadius: bodySize / 2 },
          ]}
        >
          {/* Eye */}
          <View style={[styles.mask, { width: bodySize * 0.6, height: bodySize * 0.2, top: bodySize * 0.32 }]} />
          <View style={[styles.eye, { width: bodySize * 0.08, height: bodySize * 0.08, top: bodySize * 0.28, left: bodySize * 0.58 }]} />

          {/* Crest */}
          <View style={[styles.crest, { width: bodySize * 0.12, height: bodySize * 0.22, top: -bodySize * 0.12, left: bodySize * 0.44 }]} />

          {/* Yellow belly */}
          <View style={[styles.belly, { width: bodySize * 0.5, height: bodySize * 0.3, bottom: bodySize * 0.05, left: bodySize * 0.25, borderRadius: bodySize * 0.15 }]} />
        </Animated.View>

        {/* Right wing */}
        <Animated.View
          style={[
            styles.wing,
            styles.wingRight,
            rightWingStyle,
            { width: wingW, height: wingH, top: bodySize * 0.3 },
          ]}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    backgroundColor: Colors.brown,
    overflow: 'hidden',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  mask: {
    position: 'absolute',
    backgroundColor: Colors.black,
    borderRadius: 8,
    left: 0,
  },
  eye: {
    position: 'absolute',
    backgroundColor: Colors.surface,
    borderRadius: 100,
  },
  crest: {
    position: 'absolute',
    backgroundColor: Colors.brown,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 0,
  },
  belly: {
    position: 'absolute',
    backgroundColor: Colors.yellow,
    opacity: 0.8,
  },
  wing: {
    backgroundColor: Colors.gray,
    borderRadius: 12,
  },
  wingLeft: {
    transformOrigin: 'right center',
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  wingRight: {
    transformOrigin: 'left center',
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
});
