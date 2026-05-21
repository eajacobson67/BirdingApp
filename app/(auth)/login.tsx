import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  Animated,
} from 'react-native';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useColors } from '../../store/themeStore';
import { getAuthErrorMessage } from '../../lib/authErrors';
import { BIRD_STYLES, BirdStyle } from '../../lib/birdStyles';
import { BirdAvatar } from '../../components/ui/BirdAvatar';

const BIRD_FADE_MS = 900;   // each half of the crossfade
const INTERVAL_MS  = 5000;  // how often a new bird appears
const COLOR_MS     = 4500;  // palette fade — finishes before next cycle

function pickRandom(exclude: string): BirdStyle {
  const pool = BIRD_STYLES.filter(b => b.id !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}

const initBird = BIRD_STYLES[Math.floor(Math.random() * BIRD_STYLES.length)];

export default function LoginScreen() {
  const c = useColors();
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);

  // ── Bird swap ─────────────────────────────────────────────────────────────
  // Single opacity: fade out → commit new bird in state → fade in.
  // The fade-in is deferred to a useEffect so it only starts AFTER React has
  // re-rendered with the new bird, eliminating the old-bird-flash race.
  const birdRef       = useRef<BirdStyle>(initBird);
  const [bird, setBird] = useState<BirdStyle>(initBird);
  const birdOpacity   = useRef(new Animated.Value(1)).current;
  const [triggerIn, setTriggerIn] = useState(0); // increment to signal "fade in now"

  useEffect(() => {
    if (triggerIn === 0) return;
    Animated.timing(birdOpacity, {
      toValue: 1, duration: BIRD_FADE_MS, useNativeDriver: true,
    }).start();
  }, [triggerIn]);

  // ── Palette overlay ───────────────────────────────────────────────────────
  // Two stacked views: a static "base" layer and an animated "target" overlay.
  // We only animate OPACITY (native driver), never interpolate colors.
  // After the overlay reaches opacity 1, we promote target→base and reset
  // the overlay to 0 AFTER the re-render (via useEffect + pendingReset ref),
  // so both layers show the same color at the moment of reset — no flash.
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const [base,   setBase]   = useState({ bg: initBird.theme.background, accent: initBird.theme.accent, primary: initBird.theme.primary });
  const [target, setTarget] = useState({ bg: initBird.theme.background, accent: initBird.theme.accent, primary: initBird.theme.primary });
  const pendingReset = useRef(false);

  useEffect(() => {
    if (!pendingReset.current) return;
    overlayOpacity.setValue(0);
    pendingReset.current = false;
  }, [base]); // runs after base state commits to the new color

  // ── Main cycle ────────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      const next = pickRandom(birdRef.current.id);

      // 1. Start color overlay fading in (native thread)
      setTarget({ bg: next.theme.background, accent: next.theme.accent, primary: next.theme.primary });
      Animated.timing(overlayOpacity, {
        toValue: 1, duration: COLOR_MS, useNativeDriver: true,
      }).start(() => {
        // Overlay is fully opaque — promote to base, then reset overlay via effect
        pendingReset.current = true;
        setBase({ bg: next.theme.background, accent: next.theme.accent, primary: next.theme.primary });
      });

      // 2. Fade out bird → swap → trigger fade-in after re-render
      Animated.timing(birdOpacity, {
        toValue: 0, duration: BIRD_FADE_MS, useNativeDriver: true,
      }).start(() => {
        birdRef.current = next;
        setBird(next);
        setTriggerIn(n => n + 1); // increments → useEffect above fires post-render
      });
    }, INTERVAL_MS);

    return () => clearInterval(timer);
  }, []);

  async function handleLogin() {
    if (!email || !password) return;
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace('/(tabs)');
    } catch (e: unknown) {
      Alert.alert('Sign in failed', getAuthErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={s.container}>

      {/* Background: static base + animated overlay — both on native thread */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: base.bg }]} />
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: target.bg, opacity: overlayOpacity }]}
        pointerEvents="none"
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={s.inner}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          <View style={s.birdWrap}>
            <Animated.View style={{ opacity: birdOpacity }}>
              <BirdAvatar birdStyle={bird} size={130} />
            </Animated.View>
          </View>

          {/* Title: same base+overlay opacity trick so color fades with the palette */}
          <View style={s.titleWrap}>
            <Text style={[s.appName, { color: base.primary }]}>Bird League</Text>
            <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', opacity: overlayOpacity }]} pointerEvents="none">
              <Text style={[s.appName, { color: target.primary }]}>Bird League</Text>
            </Animated.View>
          </View>
          <Text style={[s.tagline, { color: c.gray }]}>Find. Share. Compete.</Text>

          <TextInput
            style={[s.input, { backgroundColor: c.surface, color: c.textPrimary, borderColor: c.border }]}
            placeholder="Email"
            placeholderTextColor={c.gray}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <View style={[s.passwordWrap, { backgroundColor: c.surface, borderColor: c.border }]}>
            <TextInput
              style={[s.passwordInput, { color: c.textPrimary }]}
              placeholder="Password"
              placeholderTextColor={c.gray}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword(v => !v)} hitSlop={8}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.gray} />
            </TouchableOpacity>
          </View>

          {/* Button: same base+overlay pattern as background */}
          <TouchableOpacity
            style={[s.btn, { backgroundColor: base.accent }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Animated.View
              style={[StyleSheet.absoluteFill, { backgroundColor: target.accent, borderRadius: 12, opacity: overlayOpacity }]}
              pointerEvents="none"
            />
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>Sign In</Text>
            }
          </TouchableOpacity>

          <Link href="/(auth)/signup" style={[s.link, { color: c.gray }]}>
            Don't have an account? <Text style={[s.linkBold, { color: c.primary }]}>Sign up</Text>
          </Link>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  inner: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
    gap: 12,
  },
  birdWrap: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  titleWrap: {
    alignItems: 'center',
  },
  appName: {
    fontSize: 36,
    fontFamily: 'Nunito_800ExtraBold',
    textAlign: 'center',
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  eyeBtn: { paddingHorizontal: 14 },
  btn: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    overflow: 'hidden',
  },
  btnText:  { fontSize: 16, fontFamily: 'Nunito_700Bold', color: '#fff' },
  link:     { textAlign: 'center', marginTop: 16, fontSize: 14 },
  linkBold: { fontFamily: 'Nunito_700Bold' },
});
