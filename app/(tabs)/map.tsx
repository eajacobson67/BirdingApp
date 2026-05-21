import { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ActivityIndicator, Animated, ScrollView, BackHandler } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { getFastLocation } from '../../lib/location';
import { getRecentPublicSightings, subscribeToFriendSightings, Sighting } from '../../lib/firestore/sightings';
import { getUserProfile } from '../../lib/firestore/users';
import { useFriends } from '../../lib/hooks/useFriends';
import { fetchBirdThumbnails } from '../../lib/birdImages';
import { getUserLeagues, getLeagueLeaderboard } from '../../lib/firestore/leagues';


interface MapRegion { latDelta: number; lngDelta: number; }
interface Cluster { lat: number; lng: number; lead: Sighting; sightings: Sighting[]; count: number; }
type MapFilter = 'all' | 'friends' | 'league' | 'photos';
interface SelectedSighting { cluster: Cluster; usernames: Record<string, string | null>; }

function clusterSightings(sightings: Sighting[], region: MapRegion): Cluster[] {
  const latT = Math.max(region.latDelta * 0.07, 0.0008);
  const lngT = Math.max(region.lngDelta * 0.07, 0.0008);
  const visited = new Set<string>();
  const clusters: Cluster[] = [];
  for (const s of sightings) {
    if (visited.has(s.id)) continue;
    const group = sightings.filter(
      (o) =>
        !visited.has(o.id) &&
        Math.abs(o.location.lat - s.location.lat) < latT &&
        Math.abs(o.location.lng - s.location.lng) < lngT,
    );
    for (const g of group) visited.add(g.id);
    clusters.push({ lat: s.location.lat, lng: s.location.lng, lead: s, sightings: group, count: group.length });
  }
  return clusters;
}


function BirdPin({ primaryColor, photoUri, count }: {
  primaryColor: string;
  photoUri: string | null;
  count: number;
}) {
  const showPhoto = count === 1 && photoUri;
  return (
    <View style={{ width: 60, height: 68 }}>
      <Image
        source={require('../../assets/buttons/bird_pin.png')}
        style={{ width: 60, height: 60, tintColor: primaryColor }}
        resizeMode="contain"
      />
      {showPhoto && (
        <Image
          source={{ uri: photoUri }}
          style={{ position: 'absolute', top: 4, left: 7, width: 48, height: 48, borderRadius: 24 }}
          resizeMode="cover"
        />
      )}
      {count > 1 && (
        <View style={{
          position: 'absolute', top: 4, left: 7,
          width: 48, height: 48, borderRadius: 24,
          backgroundColor: '#FFFFFF',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 15, fontFamily: 'Nunito_700Bold', color: primaryColor }}>
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function MapScreen() {
  const theme = useTheme();
  const { user } = useAuthStore();
  const { friendIds } = useFriends(user?.uid ?? null);
  const [allSightings, setAllSightings] = useState<Sighting[]>([]);
  const [friendSightings, setFriendSightings] = useState<Sighting[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapFilter, setMapFilter] = useState<MapFilter>('all');
  const [region, setRegion] = useState<MapRegion>({ latDelta: 0.5, lngDelta: 0.5 });
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [leagueBounds, setLeagueBounds] = useState<Array<{ memberIds: Set<string>; start: Date; end: Date }>>([]);
  const [selected, setSelected] = useState<SelectedSighting | null>(null);
  const cardAnim = useRef(new Animated.Value(0)).current;
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    async function load() {
      console.log('[Map] load() start');
      try {
        console.log('[Map] requesting location...');
        const loc = await getFastLocation();
        console.log('[Map] location result:', loc);
        console.log('[Map] fetching sightings...');
        const data = await getRecentPublicSightings(200);
        console.log('[Map] sightings fetched:', data.length);
        if (loc) {
          const ul = { latitude: loc.lat, longitude: loc.lng };
          setUserLocation(ul);
          mapRef.current?.animateToRegion({ ...ul, latitudeDelta: 0.15, longitudeDelta: 0.15 }, 600);
        } else {
          console.warn('[Map] no location returned — permission denied or unavailable');
        }
        setAllSightings(data);
        const names = [...new Set(data.map((s) => s.commonName))];
        fetchBirdThumbnails(names).then(setThumbnails).catch((e) => console.warn('[Map] thumbnail fetch error:', e));
      } catch (e) {
        console.error('[Map] load error:', e);
      } finally {
        setLoading(false);
        console.log('[Map] load() done');
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (mapFilter !== 'friends' || friendIds.length === 0) return;
    return subscribeToFriendSightings(friendIds, setFriendSightings);
  }, [mapFilter, friendIds]);

  useEffect(() => {
    if (mapFilter !== 'league' || !user) return;
    getUserLeagues(user.uid).then(async (leagues) => {
      const activeLeagues = leagues.filter((l) => l.status === 'active');
      const bounds = await Promise.all(
        activeLeagues.map(async (l) => {
          const members = await getLeagueLeaderboard(l.id);
          const memberIds = new Set(members.map((m) => m.userId));
          memberIds.add(user.uid);
          return { memberIds, start: l.startDate, end: l.endDate };
        })
      );
      setLeagueBounds(bounds);
    });
  }, [mapFilter, user]);

  const displayed = useMemo(() => {
    if (mapFilter === 'friends') return friendSightings;
    if (mapFilter === 'league') return allSightings.filter((s) =>
      leagueBounds.some((b) => b.memberIds.has(s.userId) && s.timestamp >= b.start && s.timestamp <= b.end)
    );
    if (mapFilter === 'photos') return allSightings.filter((s) => !!s.photoURL);
    return allSightings;
  }, [mapFilter, allSightings, friendSightings, leagueBounds]);

  const clusters = useMemo(() => clusterSightings(displayed, region), [displayed, region]);
  const [clustersStable, setClustersStable] = useState(false);
  useEffect(() => {
    setClustersStable(false);
    const t = setTimeout(() => setClustersStable(true), 400);
    return () => clearTimeout(t);
  }, [clusters]);

  function centerOnUser() {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({ ...userLocation, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 400);
    }
  }



  function selectCluster(cluster: Cluster) {
    setSelected({ cluster, usernames: {} });
    mapRef.current?.animateToRegion({
      latitude: cluster.lat,
      longitude: cluster.lng,
      latitudeDelta: Math.min(region.latDelta, 0.05),
      longitudeDelta: Math.min(region.lngDelta, 0.05),
    }, 400);
    Animated.spring(cardAnim, { toValue: 1, useNativeDriver: true, tension: 100, friction: 12 }).start();
    const uniqueUserIds = [...new Set(cluster.sightings.map((s) => s.userId))];
    uniqueUserIds.forEach((uid) => {
      getUserProfile(uid).then((p) => {
        setSelected((prev) => prev ? { ...prev, usernames: { ...prev.usernames, [uid]: p?.username ?? null } } : null);
      });
    });
  }

  function dismissCard() {
    Animated.timing(cardAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setSelected(null));
  }

  useEffect(() => {
    if (!selected) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      dismissCard();
      return true;
    });
    return () => sub.remove();
  }, [selected]);

  const cardTranslateY = cardAnim.interpolate({ inputRange: [0, 1], outputRange: [200, 0] });

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{ latitude: 39.5, longitude: -98.35, latitudeDelta: 40, longitudeDelta: 40 }}
        showsUserLocation
        showsMyLocationButton={false}
        mapPadding={{ top: 0, left: 0, bottom: 0, right: 0 }}
        onPress={selected ? dismissCard : undefined}
        onRegionChangeComplete={(r: Region) =>
          setRegion({ latDelta: r.latitudeDelta, lngDelta: r.longitudeDelta })
        }
      >
        {clusters.map((c) => {
          return (
            <Marker
              key={`${c.lat}-${c.lng}-${c.lead.id}`}
              coordinate={{ latitude: c.lat, longitude: c.lng }}
              tracksViewChanges={!clustersStable}
              anchor={{ x: 0.5, y: 1 }}
              onPress={() => {
                if (c.count > 99) {
                  mapRef.current?.animateToRegion({
                    latitude: c.lat,
                    longitude: c.lng,
                    latitudeDelta: region.latDelta * 0.4,
                    longitudeDelta: region.lngDelta * 0.4,
                  }, 400);
                } else {
                  selectCluster(c);
                }
              }}
            >
              <BirdPin
                primaryColor={theme.primary}
                photoUri={c.lead.photoURL || thumbnails[c.lead.commonName] || null}
                count={c.count}
              />
            </Marker>
          );
        })}
      </MapView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={theme.primary} size="large" />
        </View>
      )}

      {selected && (
        <Animated.View
          style={[styles.sightingCard, { opacity: cardAnim, transform: [{ translateY: cardTranslateY }] }]}
        >
          <Text style={styles.cardClusterTitle}>
            {selected.cluster.count === 1 ? '1 sighting' : `${selected.cluster.count} sightings`}
          </Text>
          <ScrollView
            style={{ maxHeight: 260 }}
            showsVerticalScrollIndicator={false}
            scrollEnabled={selected.cluster.count > 1}
          >
            {selected.cluster.sightings.map((s, i) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.cardRow, i > 0 && styles.cardDivider]}
                onPress={() => { setSelected(null); router.push(`/sighting/${s.id}`); }}
                activeOpacity={0.8}
              >
                <Image
                  source={
                    s.photoURL ? { uri: s.photoURL }
                    : thumbnails[s.commonName] ? { uri: thumbnails[s.commonName] }
                    : require('../../assets/icon.png')
                  }
                  style={styles.cardPhoto}
                  resizeMode="cover"
                />
                <View style={styles.cardInfo}>
                  <Text style={styles.cardSpecies} numberOfLines={1}>{s.commonName}</Text>
                  <Text style={styles.cardUser} numberOfLines={1}>
                    {selected.usernames[s.userId] != null ? `@${selected.usernames[s.userId]}` : '…'}
                  </Text>
                  <Text style={styles.cardTime}>{formatAgo(s.timestamp)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.primary} />
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.cardClose} onPress={dismissCard}>
            <Ionicons name="close" size={16} color="#8BA3B0" />
          </TouchableOpacity>
        </Animated.View>
      )}

      <TouchableOpacity style={styles.locationBtn} onPress={centerOnUser}>
        <Ionicons name="radio-button-on" size={26} color={theme.primary} />
      </TouchableOpacity>

      <SafeAreaView style={styles.controls} edges={['top']}>
        <View style={styles.filterRow}>
          {(['all', 'friends', 'league', 'photos'] as MapFilter[]).map((tab) => {
            const active = mapFilter === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.filterChip, active && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                onPress={() => { setMapFilter(tab); dismissCard(); }}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {tab === 'all' ? 'All' : tab === 'friends' ? 'Friends' : tab === 'league' ? 'League' : 'Photos'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </SafeAreaView>
    </View>
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(245,239,224,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: { position: 'absolute', top: 0, left: 0, right: 0 },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexWrap: 'wrap',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1.5,
    borderColor: '#D9CFBB',
  },
  filterChipText: { fontSize: 13, fontFamily: 'Nunito_600SemiBold', color: '#1C1C1E' },
  filterChipTextActive: { color: '#FFFFFF' },
  locationBtn: {
    position: 'absolute',
    bottom: 64,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9CFBB',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  sightingCard: {
    position: 'absolute',
    bottom: 128,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardPhoto: { width: 56, height: 56, borderRadius: 10 },
  cardInfo: { flex: 1 },
  cardSpecies: { fontSize: 15, fontFamily: 'Nunito_700Bold', color: '#1C1C1E' },
  cardUser: { fontSize: 12, color: '#8BA3B0', marginTop: 2 },
  cardTime: { fontSize: 12, color: '#8BA3B0' },
  cardClose: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardClusterTitle: {
    fontSize: 12,
    fontFamily: 'Nunito_600SemiBold',
    color: '#8BA3B0',
    marginBottom: 8,
  },
  cardDivider: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0EBE0',
  },
});
