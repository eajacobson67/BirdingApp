import { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, Animated, TouchableOpacity, Text, ScrollView, Pressable, Image, BackHandler, Dimensions, ActivityIndicator } from 'react-native';
import { Svg, Defs, Pattern, Rect, Path, Line, G, Text as SvgText, TextPath } from 'react-native-svg';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WaxwingButton } from '../../components/home/WaxwingButton';
import { LogSubButton } from '../../components/home/LogSubButton';
import { useThemeStore, useColors } from '../../store/themeStore';
import { identifyFromLocalUri, BirdNetResult } from '../../lib/birdnet';
import { identifyFromImage, BirdVisionResult } from '../../lib/birdvision';
import { useAuthStore } from '../../store/authStore';
import { useBirdsStore } from '../../store/birdsStore';

const CONFIDENCE_THRESHOLD = 0.3;
const CHUNK_MS = 5000;

// ── Layout constants ──────────────────────────────────────────────────────────

const MAIN        = 188;
const RING_W      = 20;
const RING        = 252;
const LISTEN_RING = Math.round(RING * 0.62); // ~156px — ring shrinks in listen mode

const SUB    = 64;
const ORBIT  = 182;
const SIN45  = Math.SQRT2 / 2;
const DX = Math.round(ORBIT * SIN45);
const DY = Math.round(ORBIT * SIN45);

const CW  = 2 * (DX + SUB / 2 + 8);
const CH  = RING / 2 + DY + SUB / 2 + 12;
const CX  = CW / 2;
const RLF = Math.round(CX - RING / 2);
const SLF = Math.round(CX - DX - SUB / 2);
const SRF = Math.round(CX + DX - SUB / 2);
const STF = Math.round(RING / 2 + DY - SUB / 2);

const TEXT_R  = (RING / 2 + RING / 2 - RING_W) / 2;
const TEXT_CX = RING / 2;
const TEXT_CY = RING / 2 + 4;
const ARC_PATH =
  `M ${TEXT_CX - TEXT_R} ${TEXT_CY}` +
  ` A ${TEXT_R} ${TEXT_R} 0 0 0 ${TEXT_CX} ${TEXT_CY + TEXT_R}` +
  ` A ${TEXT_R} ${TEXT_R} 0 0 0 ${TEXT_CX + TEXT_R} ${TEXT_CY}`;

const LISTEN_TEXT_R  = (LISTEN_RING / 2 + LISTEN_RING / 2 - RING_W) / 2;
const LISTEN_TEXT_CX = LISTEN_RING / 2;
const LISTEN_TEXT_CY = LISTEN_RING / 2 + 4;
const LISTEN_ARC_PATH =
  `M ${LISTEN_TEXT_CX - LISTEN_TEXT_R} ${LISTEN_TEXT_CY}` +
  ` A ${LISTEN_TEXT_R} ${LISTEN_TEXT_R} 0 0 0 ${LISTEN_TEXT_CX} ${LISTEN_TEXT_CY + LISTEN_TEXT_R}` +
  ` A ${LISTEN_TEXT_R} ${LISTEN_TEXT_R} 0 0 0 ${LISTEN_TEXT_CX + LISTEN_TEXT_R} ${LISTEN_TEXT_CY}`;

const VANE = 'M 0 7 C -5 2 -4.5 -6 0 -11 C 4.5 -6 5 2 0 7 Z';

const WAVE_COUNT       = 3;   // press waves (WaxwingButton)
const AUDIO_WAVE_COUNT = 24;  // meter-driven waves
const AUDIO_WAVE_D     = LISTEN_RING + 60; // wave start diameter — 30px gap outside the ring
const SCREEN_H         = Dimensions.get('window').height;

// ─────────────────────────────────────────────────────────────────────────────

function mergeBirdResults(prev: BirdNetResult[], incoming: BirdNetResult[]): BirdNetResult[] {
  const map = new Map(prev.map(r => [r.commonName, r]));
  for (const r of incoming) {
    const existing = map.get(r.commonName);
    if (!existing || r.confidence > existing.confidence) map.set(r.commonName, r);
  }
  return [...map.values()].sort((a, b) => b.confidence - a.confidence);
}

export default function HomeScreen() {
  const { birdStyle } = useThemeStore();
  const t = birdStyle.theme;
  const c = useColors();
  const { user } = useAuthStore();
  const { location } = useBirdsStore();

  const [listenMode, setListenMode]       = useState(false);
  const [isListening, setIsListening]     = useState(false);
  const [listenResults, setListenResults] = useState<BirdNetResult[]>([]);

  const [cameraMode, setCameraMode]         = useState(false);
  const [galleryPhotos, setGalleryPhotos]   = useState<MediaLibrary.Asset[]>([]);
  const [selectedPhoto, setSelectedPhoto]   = useState<string | null>(null);
  const [cameraResults, setCameraResults]   = useState<BirdVisionResult[]>([]);
  const [cameraLoading, setCameraLoading]   = useState(false);
  const [clusterBottom, setClusterBottom]   = useState(SCREEN_H * 0.65);

  // Mode transition animations
  const clusterY          = useRef(new Animated.Value(0)).current;
  const subOpacity        = useRef(new Animated.Value(1)).current;
  const backOpacity       = useRef(new Animated.Value(0)).current;
  const listOpacity       = useRef(new Animated.Value(0)).current;
  const birdBtnOpacity    = useRef(new Animated.Value(1)).current;
  const micBtnOpacity     = useRef(new Animated.Value(0)).current;
  const cameraBtnOpacity  = useRef(new Animated.Value(0)).current;
  const galleryOpacity    = useRef(new Animated.Value(0)).current;
  const bottomAreaY       = useRef(new Animated.Value(0)).current;
  const ringSizeAnim      = useRef(new Animated.Value(RING)).current;
  const ringLeftAnim      = ringSizeAnim.interpolate({ inputRange: [LISTEN_RING, RING], outputRange: [RLF + (RING - LISTEN_RING) / 2, RLF] });
  const ringTopAnim       = ringSizeAnim.interpolate({ inputRange: [LISTEN_RING, RING], outputRange: [(RING - LISTEN_RING) / 2, 0] });
  const ringBRAnim        = ringSizeAnim.interpolate({ inputRange: [LISTEN_RING, RING], outputRange: [LISTEN_RING / 2, RING / 2] });

  // Press waves — owned here, passed down to WaxwingButton
  const waveScales    = useRef(Array.from({ length: WAVE_COUNT }, () => new Animated.Value(RING / MAIN))).current;
  const waveOpacities = useRef(Array.from({ length: WAVE_COUNT }, () => new Animated.Value(0))).current;
  const waveColors    = [t.primary, t.accent, t.gray];

  // Audio meter waves
  const audioWaveScales    = useRef(Array.from({ length: AUDIO_WAVE_COUNT }, () => new Animated.Value(1))).current;
  const audioWaveOpacities = useRef(Array.from({ length: AUDIO_WAVE_COUNT }, () => new Animated.Value(0))).current;
  const [audioWaveColors, setAudioWaveColors] = useState<string[]>(Array.from({ length: AUDIO_WAVE_COUNT }, () => t.primary));
  const themeColors = [t.primary, t.accent, t.gray, t.border];

  // Audio session refs (no stale closure from setInterval)
  const recordingRef   = useRef<Audio.Recording | null>(null);
  const pollTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const isListeningRef = useRef(false);
  const nextWaveIdx    = useRef(0);
  const lastWaveTime   = useRef(0);
  const userRef        = useRef(user);
  const locationRef    = useRef(location);
  useEffect(() => { userRef.current = user; },         [user]);
  useEffect(() => { locationRef.current = location; }, [location]);

  useEffect(() => () => { void stopListening(); }, []);

  // Android hardware back button exits listen/camera mode
  useEffect(() => {
    if (!listenMode && !cameraMode) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (listenMode) exitListenMode();
      else exitCameraMode();
      return true;
    });
    return () => sub.remove();
  }, [listenMode, cameraMode]);

  // ── Audio metering → wave animations ─────────────────────────────────────

  function onMeterUpdate(dBFS: number) {
    if (!isListeningRef.current) return;
    // Normalize -50 dBFS..0 → 0..1 (raised floor = more sensitive)
    const level = Math.min(1, Math.max(0, (dBFS + 50) / 50) * 2);
    const now = Date.now();
    const cooldown = Math.max(80, 150 - level * 70);
    if (level > 0.001 && now - lastWaveTime.current > cooldown) {
      lastWaveTime.current = now;
      spawnAudioWave(level);
    }
  }

  function spawnAudioWave(level: number) {
    const i  = nextWaveIdx.current % AUDIO_WAVE_COUNT;
    nextWaveIdx.current++;
    const ws = audioWaveScales[i];
    const wo = audioWaveOpacities[i];

    // Pick a random theme color for this wave
    const color = themeColors[Math.floor(Math.random() * themeColors.length)];
    setAudioWaveColors(prev => { const next = [...prev]; next[i] = color; return next; });

    const maxScale    = 2.2 + level * 2.0;
    const peakOpacity = 0.13 + level * 0.55;
    const duration    = 2000 + (1 - level) * 800;
    const fadeIn      = 200;

    ws.stopAnimation();
    wo.stopAnimation();
    ws.setValue(1);
    wo.setValue(0);
    Animated.parallel([
      Animated.timing(ws, { toValue: maxScale, duration, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(wo, { toValue: peakOpacity, duration: fadeIn,            useNativeDriver: true }),
        Animated.timing(wo, { toValue: 0,           duration: duration * 0.7,    useNativeDriver: true }),
      ]),
    ]).start();
  }

  // ── Listen mode transitions ───────────────────────────────────────────────

  function enterListenMode() {
    setListenMode(true);
    void startListening();
    Animated.parallel([
      Animated.spring(clusterY,       { toValue: -(SCREEN_H * 0.10 + 32),  useNativeDriver: true,  tension: 120, friction: 10 }),
      Animated.spring(bottomAreaY,    { toValue: -(SCREEN_H * 0.10 + 127), useNativeDriver: true,  tension: 120, friction: 10 }),
      Animated.spring(ringSizeAnim,   { toValue: LISTEN_RING, useNativeDriver: false, tension: 120, friction: 10 }),
      Animated.timing(subOpacity,     { toValue: 0,    duration: 180, useNativeDriver: true }),
      Animated.timing(backOpacity,    { toValue: 1,    duration: 300, useNativeDriver: true }),
      Animated.timing(listOpacity,    { toValue: 1,    duration: 400, useNativeDriver: true }),
      Animated.timing(birdBtnOpacity, { toValue: 0,    duration: 200, useNativeDriver: true }),
      Animated.timing(micBtnOpacity,  { toValue: 1,    duration: 280, useNativeDriver: true }),
    ]).start();
  }

  function exitListenMode() {
    void stopListening();
    setListenResults([]);
    setListenMode(false);
    audioWaveScales.forEach((s, i) => {
      s.stopAnimation(); audioWaveOpacities[i].stopAnimation();
      s.setValue(1);     audioWaveOpacities[i].setValue(0);
    });
    Animated.parallel([
      Animated.spring(clusterY,       { toValue: 0, useNativeDriver: true,  tension: 120, friction: 10 }),
      Animated.spring(bottomAreaY,    { toValue: 0, useNativeDriver: true,  tension: 120, friction: 10 }),
      Animated.spring(ringSizeAnim,   { toValue: RING, useNativeDriver: false, tension: 120, friction: 10 }),
      Animated.timing(subOpacity,     { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(backOpacity,    { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(listOpacity,    { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(birdBtnOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(micBtnOpacity,  { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
  }

  // ── Camera mode transitions ───────────────────────────────────────────────

  function enterCameraMode() {
    setCameraMode(true);
    void loadGallery();
    Animated.parallel([
      Animated.spring(clusterY,         { toValue: -(SCREEN_H * 0.10 + 32),  useNativeDriver: true,  tension: 120, friction: 10 }),
      Animated.spring(bottomAreaY,      { toValue: -(SCREEN_H * 0.10 + 127), useNativeDriver: true,  tension: 120, friction: 10 }),
      Animated.spring(ringSizeAnim,     { toValue: LISTEN_RING, useNativeDriver: false, tension: 120, friction: 10 }),
      Animated.timing(subOpacity,       { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(backOpacity,      { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(galleryOpacity,   { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(birdBtnOpacity,   { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(cameraBtnOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }

  function exitCameraMode() {
    setCameraMode(false);
    setSelectedPhoto(null);
    setGalleryPhotos([]);
    setCameraResults([]);
    setCameraLoading(false);
    Animated.parallel([
      Animated.spring(clusterY,         { toValue: 0, useNativeDriver: true,  tension: 120, friction: 10 }),
      Animated.spring(bottomAreaY,      { toValue: 0, useNativeDriver: true,  tension: 120, friction: 10 }),
      Animated.spring(ringSizeAnim,     { toValue: RING, useNativeDriver: false, tension: 120, friction: 10 }),
      Animated.timing(subOpacity,       { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(backOpacity,      { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(galleryOpacity,   { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(birdBtnOpacity,   { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(cameraBtnOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
  }

  async function loadGallery() {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') return;
    const { assets } = await MediaLibrary.getAssetsAsync({
      mediaType: MediaLibrary.MediaType.photo,
      first: 40,
      sortBy: MediaLibrary.SortBy.creationTime,
    });
    setGalleryPhotos(assets);
  }

  async function takePicture() {
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85, allowsEditing: false });
    if (!result.canceled) void submitImageForRecognition(result.assets[0].uri);
  }

  async function submitImageForRecognition(uri: string) {
    setCameraLoading(true);
    setCameraResults([]);
    try {
      const loc  = locationRef.current;
      const date = new Date().toISOString().split('T')[0];
      const results = await identifyFromImage(uri, loc?.lat ?? 0, loc?.lng ?? 0, date);
      const above = results.filter(r => r.confidence >= 0.1);
      setCameraResults(above.length ? above : results.slice(0, 3));
    } catch (e: unknown) {
      console.log('[BirdVision] error:', (e as Error).message);
    } finally {
      setCameraLoading(false);
    }
  }

  // ── Audio rolling buffer ──────────────────────────────────────────────────

  async function startNewChunk() {
    const { recording } = await Audio.Recording.createAsync(
      { ...Audio.RecordingOptionsPresets.HIGH_QUALITY, isMeteringEnabled: true },
      (status) => {
        if (status.isRecording && status.metering !== undefined) {
          onMeterUpdate(status.metering);
        }
      },
      100,
    );
    recordingRef.current = recording;
  }

  function dbg(msg: string) { console.log('[BirdNet]', msg); }

  async function processChunk(uri: string) {
    const loc = locationRef.current;
    dbg(`Chunk ready — sending to BirdNET…`);
    try {
      const date = new Date().toISOString().split('T')[0];
      const results = await identifyFromLocalUri(uri, loc?.lat ?? 0, loc?.lng ?? 0, date);
      if (results.length === 0) {
        dbg(`BirdNET → no detections`);
      } else {
        results.forEach(r => dbg(`BirdNET → ${r.commonName} (${Math.round(r.confidence * 100)}%)`));
      }
      const above = results.filter(r => r.confidence >= CONFIDENCE_THRESHOLD);
      if (above.length) setListenResults(prev => mergeBirdResults(prev, above));
    } catch (e: unknown) {
      dbg(`ERROR: ${(e as Error).message ?? String(e)}`);
    }
  }

  async function rotateChunk() {
    const old = recordingRef.current;
    if (!old) {
      // Recording was lost mid-session — restart it so metering resumes
      if (isListeningRef.current) {
        dbg('rotate: lost recording, recovering…');
        try { await startNewChunk(); } catch {}
      }
      return;
    }
    recordingRef.current = null;
    try {
      dbg('Rotating chunk…');
      await old.stopAndUnloadAsync();
      const uri = old.getURI();
      await startNewChunk();
      if (uri) void processChunk(uri);
      else dbg('rotate: getURI() returned null');
    } catch (e: unknown) {
      dbg(`rotate ERROR: ${(e as Error).message ?? String(e)}`);
      // Attempt to recover even if this rotation failed
      if (isListeningRef.current && !recordingRef.current) {
        try { await startNewChunk(); } catch {}
      }
    }
  }

  async function startListening() {
    setListenResults([]);
    try {
      const { status } = await Audio.requestPermissionsAsync();
      dbg(`Mic permission: ${status}`);
      if (status !== 'granted') return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      await startNewChunk();
      dbg(`Recording started — chunk every ${CHUNK_MS / 1000}s`);
      isListeningRef.current = true;
      setIsListening(true);
      pollTimerRef.current = setInterval(() => { void rotateChunk(); }, CHUNK_MS);
    } catch (e: unknown) {
      dbg(`startListening ERROR: ${(e as Error).message ?? String(e)}`);
    }
  }

  async function stopListening() {
    isListeningRef.current = false;
    if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
    const rec = recordingRef.current;
    if (rec) {
      recordingRef.current = null;
      try { await rec.stopAndUnloadAsync(); } catch {}
    }
    setIsListening(false);
  }

  function handleMainPress() {
    if (listenMode) {
      if (isListening) void stopListening();
      else void startListening();
    } else if (cameraMode) {
      void takePicture();
    } else {
      router.push('/log/select');
    }
  }

  const listenText = isListening ? 'LISTENING...' : 'TAP TO LISTEN FOR BIRDS';
  const ringColor  = isListening ? t.accent : t.primary;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#FFFFFF' }]}>

      {/* Feather texture background */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <Pattern id="feathers" x="0" y="0" width="72" height="72" patternUnits="userSpaceOnUse">
              <G transform="translate(36, 22) rotate(-18)">
                <Path d={VANE} fill={t.background} opacity="0.9" />
                <Line x1="0" y1="9" x2="0" y2="-13" stroke={t.background} strokeWidth="0.9" opacity="0.8" />
              </G>
              <G transform="translate(14, 52) rotate(28) scale(0.75)">
                <Path d={VANE} fill={t.background} opacity="0.85" />
                <Line x1="0" y1="9" x2="0" y2="-13" stroke={t.background} strokeWidth="0.9" opacity="0.75" />
              </G>
              <G transform="translate(60, 56) rotate(-6) scale(0.6)">
                <Path d={VANE} fill={t.background} opacity="0.8" />
                <Line x1="0" y1="9" x2="0" y2="-13" stroke={t.background} strokeWidth="0.9" opacity="0.7" />
              </G>
            </Pattern>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#feathers)" />
        </Svg>
      </View>

      {/* Back button */}
      <Animated.View style={[styles.backBtn, { opacity: backOpacity }]} pointerEvents={(listenMode || cameraMode) ? 'auto' : 'none'}>
        <TouchableOpacity onPress={listenMode ? exitListenMode : exitCameraMode} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={30} color={t.primary} />
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.inner}>
        <View style={styles.topSpacer} />

        {/* Cluster — slides up in listen mode */}
        <Animated.View
          style={[styles.cluster, { width: CW, height: CH, transform: [{ translateY: clusterY }] }]}
          onLayout={e => setClusterBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
        >

          {/* 1. Press waves — behind ring, driven by WaxwingButton */}
          {waveScales.map((ws, i) => (
            <Animated.View
              key={i}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: RLF, top: 0,
                width: RING, height: RING,
                borderRadius: RING / 2,
                borderWidth: 14,
                borderColor: waveColors[i],
                opacity: waveOpacities[i],
                transform: [{ scale: ws }],
              }}
            />
          ))}

          {/* 3. Ring — shrinks via width/height so border width and text stay the same size */}
          <Animated.View style={[styles.ring, {
            width: ringSizeAnim, height: ringSizeAnim,
            borderRadius: ringBRAnim,
            backgroundColor: t.background,
            borderColor: ringColor,
            left: ringLeftAnim, top: ringTopAnim,
            shadowColor: ringColor,
          }]}>
            {/* Curved hint text — normal mode only */}
            <Animated.View style={{ position: 'absolute', top: -RING_W, left: -RING_W, width: RING, height: RING, opacity: subOpacity }} pointerEvents="none">
              <Svg width={RING} height={RING}>
                <Defs>
                  <Path id="textArc" d={ARC_PATH} />
                </Defs>
                <SvgText fill="#FFFFFF" fontSize="9.5" fontWeight="700" letterSpacing="2" textAnchor="middle" opacity="0.9">
                  <TextPath href="#textArc" startOffset="50%">TAP TO LOG A SIGHTING</TextPath>
                </SvgText>
              </Svg>
            </Animated.View>

            {/* Listen mode text — curved along the smaller ring arc */}
            <Animated.View style={{ position: 'absolute', top: -RING_W, left: -RING_W, width: LISTEN_RING, height: LISTEN_RING, opacity: micBtnOpacity }} pointerEvents="none">
              <Svg width={LISTEN_RING} height={LISTEN_RING}>
                <Defs>
                  <Path id="listenArc" d={LISTEN_ARC_PATH} />
                </Defs>
                <SvgText fill="#FFFFFF" fontSize="9.5" fontWeight="700" letterSpacing="2" textAnchor="middle" opacity="0.9">
                  <TextPath href="#listenArc" startOffset="50%">{listenText}</TextPath>
                </SvgText>
              </Svg>
            </Animated.View>

            {/* Camera mode text — curved along the smaller ring arc */}
            <Animated.View style={{ position: 'absolute', top: -RING_W, left: -RING_W, width: LISTEN_RING, height: LISTEN_RING, opacity: cameraBtnOpacity }} pointerEvents="none">
              <Svg width={LISTEN_RING} height={LISTEN_RING}>
                <Defs>
                  <Path id="cameraArc" d={LISTEN_ARC_PATH} />
                </Defs>
                <SvgText fill="#FFFFFF" fontSize="9.5" fontWeight="700" letterSpacing="2" textAnchor="middle" opacity="0.9">
                  <TextPath href="#cameraArc" startOffset="50%">TAP TO TAKE A PICTURE</TextPath>
                </SvgText>
              </Svg>
            </Animated.View>
          </Animated.View>

          {/* Bird button — sibling of ring so it doesn't scale */}
          <Animated.View
            style={{ position: 'absolute', left: RLF + (RING - MAIN) / 2, top: (RING - MAIN) / 2, opacity: birdBtnOpacity }}
            pointerEvents={(listenMode || cameraMode) ? 'none' : 'auto'}
          >
            <WaxwingButton
              size={MAIN}
              ringSize={RING}
              birdStyle={birdStyle}
              waveAnimations={{ scales: waveScales, opacities: waveOpacities }}
              onPress={handleMainPress}
            />
          </Animated.View>

          {/* Mic button — sibling of ring, full-size icon */}
          <Animated.View
            style={{ position: 'absolute', left: RLF, top: 0, width: RING, height: RING, alignItems: 'center', justifyContent: 'center', opacity: micBtnOpacity }}
            pointerEvents={listenMode ? 'auto' : 'none'}
          >
            <Pressable onPress={handleMainPress} hitSlop={16}>
              <Image
                source={require('../../assets/buttons/microphone_button.png')}
                style={{ width: 130, height: 130, tintColor: ringColor }}
                resizeMode="contain"
              />
            </Pressable>
          </Animated.View>

          {/* Camera button — sibling of ring, full-size icon */}
          <Animated.View
            style={{ position: 'absolute', left: RLF, top: 0, width: RING, height: RING, alignItems: 'center', justifyContent: 'center', opacity: cameraBtnOpacity }}
            pointerEvents={cameraMode ? 'auto' : 'none'}
          >
            <Pressable onPress={handleMainPress} hitSlop={16}>
              <Image
                source={require('../../assets/buttons/camera_button.png')}
                style={{ width: 130, height: 130, tintColor: ringColor }}
                resizeMode="contain"
              />
            </Pressable>
          </Animated.View>

          {/* 4. Audio meter waves — only rendered in listen mode so they vanish instantly on exit */}
          {listenMode && audioWaveScales.map((ws, i) => (
            <Animated.View
              key={`aw${i}`}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: RLF + (RING - AUDIO_WAVE_D) / 2,
                top: (RING - AUDIO_WAVE_D) / 2,
                width: AUDIO_WAVE_D, height: AUDIO_WAVE_D,
                borderRadius: AUDIO_WAVE_D / 2,
                borderWidth: 6,
                borderColor: audioWaveColors[i],
                opacity: audioWaveOpacities[i],
                transform: [{ scale: ws }],
              }}
            />
          ))}

          {/* 5. Sub-buttons — fade out in listen/camera mode */}
          <Animated.View style={{ position: 'absolute', left: SLF, top: STF, opacity: subOpacity }} pointerEvents={(listenMode || cameraMode) ? 'none' : 'auto'}>
            <LogSubButton source={require('../../assets/buttons/microphone_button.png')} onPress={enterListenMode} />
          </Animated.View>
          <Animated.View style={{ position: 'absolute', left: SRF, top: STF, opacity: subOpacity }} pointerEvents={(listenMode || cameraMode) ? 'none' : 'auto'}>
            <LogSubButton source={require('../../assets/buttons/camera_button.png')} onPress={enterCameraMode} />
          </Animated.View>

        </Animated.View>

        {/* Restores the original flex ratio now that bottomArea is position:absolute */}
        <View style={{ flex: 1 }} pointerEvents="none" />

        {/* Bottom area — invisible in normal mode, slides up in listen/camera mode */}
        <Animated.View style={[styles.bottomArea, { top: clusterBottom, transform: [{ translateY: bottomAreaY }] }]} pointerEvents={(listenMode || cameraMode) ? 'auto' : 'none'}>

          {/* Listen mode: detected bird results */}
          <Animated.View style={{ flex: 1, width: '100%', opacity: listOpacity }} pointerEvents={listenMode ? 'auto' : 'none'}>
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, width: '100%' }}>
              {listenResults.length > 0 && (
                <>
                  <Text style={[styles.resultsLabel, { color: c.textPrimary }]}>Detected nearby</Text>
                  {listenResults.map((r, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.resultRow, { backgroundColor: c.surface, borderColor: t.border }]}
                      onPress={() => router.push({ pathname: '/log/confirm', params: { commonName: r.commonName, scientificName: r.scientificName } })}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.resultName, { color: c.textPrimary }]}>{r.commonName}</Text>
                        <Text style={[styles.resultSci, { color: t.gray }]}>{r.scientificName}</Text>
                      </View>
                      <View style={[styles.confPill, { backgroundColor: t.accent }]}>
                        <Text style={[styles.confText, { color: c.black }]}>{Math.round(r.confidence * 100)}%</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </ScrollView>
          </Animated.View>

          {/* Camera mode: loading / results / gallery */}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: galleryOpacity }]} pointerEvents={cameraMode ? 'auto' : 'none'}>

            {/* Loading */}
            {cameraLoading && (
              <View style={styles.cameraCenter}>
                <ActivityIndicator size="large" color={t.primary} />
                <Text style={[styles.cameraHint, { color: c.gray }]}>Identifying bird…</Text>
              </View>
            )}

            {/* Results */}
            {!cameraLoading && cameraResults.length > 0 && (
              <>
                <View style={styles.galleryHeader}>
                  <View />
                  <TouchableOpacity onPress={() => { setCameraResults([]); setSelectedPhoto(null); }} hitSlop={10} style={{ paddingRight: 12 }}>
                    <Text style={[styles.acceptText, { color: t.primary }]}>← New photo</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {cameraResults.map((r, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.resultRow, { backgroundColor: c.surface, borderColor: t.border }]}
                      onPress={() => router.push({ pathname: '/log/confirm', params: { commonName: r.commonName, scientificName: r.scientificName } })}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.resultName, { color: c.textPrimary, flex: 1 }]}>{r.commonName}</Text>
                      <View style={[styles.confPill, { backgroundColor: t.accent }]}>
                        <Text style={[styles.confText, { color: c.black }]}>{Math.round(r.confidence * 100)}%</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Gallery grid */}
            {!cameraLoading && cameraResults.length === 0 && (
              <>
                <View style={styles.galleryHeader}>
                  <View />
                  {selectedPhoto && (
                    <TouchableOpacity
                      style={[styles.acceptBtn, { backgroundColor: t.accent }]}
                      onPress={() => void submitImageForRecognition(selectedPhoto)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.acceptText, { color: '#fff' }]}>Identify</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 16 }}>
                  <View style={styles.photoGrid}>
                    {galleryPhotos.map(asset => (
                      <TouchableOpacity
                        key={asset.id}
                        onPress={() => setSelectedPhoto(asset.uri)}
                        activeOpacity={0.8}
                        style={[
                          styles.gridItem,
                          selectedPhoto === asset.uri && { borderColor: t.accent, borderWidth: 3 },
                        ]}
                      >
                        <Image source={{ uri: asset.uri }} style={styles.gridPhoto} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </>
            )}

          </Animated.View>

        </Animated.View>

      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1 },
  inner:        { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
  topSpacer:    { flex: 1.5 },
  cluster:      { position: 'relative' },
  backBtn:      { position: 'absolute', top: 56, left: 20, zIndex: 10 },
  ring: {
    position: 'absolute',
    borderWidth: RING_W,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.38,
    shadowRadius: 28,
    elevation: 16,
  },
  bottomArea:   { position: 'absolute', left: 0, right: 0, height: SCREEN_H * 0.65, paddingHorizontal: 20, paddingTop: 110 },
  resultsLabel: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  resultRow: {
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 8,
  },
  resultName: { fontSize: 16, fontWeight: '600' },
  resultSci:  { fontSize: 12, fontStyle: 'italic', marginTop: 2 },
  confPill:   { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  confText:   { fontSize: 13, fontWeight: '700' },
  galleryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  acceptBtn:   { borderRadius: 10, paddingHorizontal: 18, paddingVertical: 8 },
  acceptText:  { fontSize: 14, fontWeight: '700' },
  photoGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  gridItem:    { width: '32.5%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden' },
  gridPhoto:   { width: '100%', height: '100%' },
  cameraCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cameraHint:  { fontSize: 14, marginTop: 12 },
});
