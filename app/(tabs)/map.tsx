import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import MapView, { Marker, Callout, Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { getCurrentLocation } from '../../lib/location';
import { getRecentPublicSightings, subscribeToFriendSightings, Sighting } from '../../lib/firestore/sightings';
import { useFriends } from '../../lib/hooks/useFriends';
import { fetchBirdThumbnails } from '../../lib/birdImages';
import { getUserLeagues, getLeagueLeaderboard } from '../../lib/firestore/leagues';

interface MapRegion { latDelta: number; lngDelta: number; }
interface Cluster { lat: number; lng: number; lead: Sighting; count: number; }

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
    clusters.push({ lat: s.location.lat, lng: s.location.lng, lead: s, count: group.length });
  }
  return clusters;
}

const BUBBLE = 46;

function BirdPin({
  cluster,
  thumbnail,
  onThumbnailLoad,
  leagueColor,
}: {
  cluster: Cluster;
  thumbnail?: string;
  onThumbnailLoad?: () => void;
  leagueColor?: string;
}) {
  const isCluster = cluster.count > 1;
  const isLeague = !!leagueColor;
  const bg = isCluster || isLeague ? (leagueColor ?? '#A67C52') : '#FFFFFF';

  return (
    <View style={pin.wrapper}>
      {/* Outer shadow ring */}
      <View style={[pin.shadow, (isCluster || isLeague) && { backgroundColor: (leagueColor ?? '#A67C52') + '55' }]}>
        {/* Main bubble */}
        <View style={[pin.bubble, (isCluster || isLeague) && { backgroundColor: leagueColor ?? '#A67C52' }]}>
          {isCluster ? (
            <Text style={pin.count}>{cluster.count}</Text>
          ) : thumbnail && !isLeague ? (
            <Image
              source={{ uri: thumbnail }}
              style={pin.thumb}
              resizeMode="cover"
              onLoad={onThumbnailLoad}
            />
          ) : isLeague ? (
            <Ionicons name="trophy" size={20} color="#FFFFFF" />
          ) : (
            <Text style={pin.initial}>{cluster.lead.commonName.charAt(0).toUpperCase()}</Text>
          )}
        </View>
      </View>
      {/* Pin tail — two layered triangles for a bordered look */}
      <View style={pin.tailOuter} />
      <View style={[pin.tailInner, { borderTopColor: bg }]} />
    </View>
  );
}

const pin = StyleSheet.create({
  wrapper: { alignItems: 'center' },
  shadow: {
    width: BUBBLE + 6,
    height: BUBBLE + 6,
    borderRadius: (BUBBLE + 6) / 2,
    backgroundColor: 'rgba(0,0,0,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadowCluster: { backgroundColor: 'rgba(166,124,82,0.35)' },
  bubble: {
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleCluster: { backgroundColor: '#A67C52' },
  thumb: {
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
  },
  count: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  initial: { fontSize: 18, fontWeight: '700', color: '#A67C52' },
  // Tail: larger dark outer triangle for shadow/border effect
  tailOuter: {
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 12,
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(0,0,0,0.18)',
    marginTop: -2,
  },
  // Inner fill triangle overlaid on top
  tailInner: {
    position: 'absolute',
    bottom: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 10,
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
  },
});

type MapFilter = 'all' | 'friends' | 'league';

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
  const [loadedThumbs, setLoadedThumbs] = useState<Record<string, boolean>>({});
  const [leagueMemberIds, setLeagueMemberIds] = useState<Set<string>>(new Set());
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    async function load() {
      const [loc, data] = await Promise.all([getCurrentLocation(), getRecentPublicSightings(200)]);
      if (loc) {
        const ul = { latitude: loc.lat, longitude: loc.lng };
        setUserLocation(ul);
        mapRef.current?.animateToRegion({ ...ul, latitudeDelta: 0.15, longitudeDelta: 0.15 }, 600);
      }
      setAllSightings(data);
      setLoading(false);
      const names = [...new Set(data.map((s) => s.commonName))];
      fetchBirdThumbnails(names).then(setThumbnails).catch(() => {});
    }
    load();
  }, []);

  // Subscribe to friend sightings when friends filter is active
  useEffect(() => {
    if (mapFilter !== 'friends' || friendIds.length === 0) return;
    return subscribeToFriendSightings(friendIds, setFriendSightings);
  }, [mapFilter, friendIds]);

  // Load league member IDs when league filter is activated
  useEffect(() => {
    if (mapFilter !== 'league' || !user) return;
    getUserLeagues(user.uid).then(async (leagues) => {
      const activeLeagues = leagues.filter((l) => l.status === 'active');
      const memberSets = await Promise.all(activeLeagues.map((l) => getLeagueLeaderboard(l.id)));
      const ids = new Set<string>();
      memberSets.flat().forEach((m) => ids.add(m.userId));
      setLeagueMemberIds(ids);
    });
  }, [mapFilter, user]);

  const displayed = mapFilter === 'friends' ? friendSightings
    : mapFilter === 'league' ? allSightings.filter((s) => leagueMemberIds.has(s.userId))
    : allSightings;
  const clusters = useMemo(() => clusterSightings(displayed, region), [displayed, region]);

  function centerOnUser() {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({ ...userLocation, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 400);
    }
  }

  const handleThumbnailLoad = useCallback((species: string) => {
    setLoadedThumbs((prev) => ({ ...prev, [species]: true }));
  }, []);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{ latitude: 39.5, longitude: -98.35, latitudeDelta: 40, longitudeDelta: 40 }}
        showsUserLocation
        onRegionChangeComplete={(r: Region) =>
          setRegion({ latDelta: r.latitudeDelta, lngDelta: r.longitudeDelta })
        }
      >
        {clusters.map((c) => {
          const thumb = thumbnails[c.lead.commonName];
          const isLeaguePin = mapFilter === 'league';
          const fullyLoaded = isLeaguePin || !thumb || !!loadedThumbs[c.lead.commonName];
          return (
            <Marker
              key={`${c.lat}-${c.lng}-${c.lead.id}`}
              coordinate={{ latitude: c.lat, longitude: c.lng }}
              tracksViewChanges={!fullyLoaded}
              anchor={{ x: 0.5, y: 1 }}
              onPress={c.count === 1 ? () => router.push(`/sighting/${c.lead.id}`) : undefined}
            >
              <BirdPin
                cluster={c}
                thumbnail={thumb}
                onThumbnailLoad={() => handleThumbnailLoad(c.lead.commonName)}
                leagueColor={isLeaguePin ? theme.primary : undefined}
              />
              {c.count === 1 && (
                <Callout onPress={() => router.push(`/sighting/${c.lead.id}`)}>
                  <View style={styles.callout}>
                    <Text style={styles.calloutSpecies}>{c.lead.commonName}</Text>
                    <Text style={styles.calloutMeta}>{c.lead.locationName}</Text>
                    <Text style={styles.calloutTime}>{formatAgo(c.lead.timestamp)}</Text>
                    <Text style={[styles.calloutAction, { color: theme.primary }]}>Tap to view →</Text>
                  </View>
                </Callout>
              )}
            </Marker>
          );
        })}
      </MapView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={theme.primary} size="large" />
        </View>
      )}

      <SafeAreaView style={styles.controls} edges={['top']}>
        <View style={styles.filterRow}>
          {(['all', 'friends', 'league'] as MapFilter[]).map((tab) => {
            const active = mapFilter === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.filterChip, active && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                onPress={() => setMapFilter(tab)}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {tab === 'all' ? 'All' : tab === 'friends' ? 'Friends' : 'League'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </SafeAreaView>

      <TouchableOpacity style={styles.locationBtn} onPress={centerOnUser}>
        <Ionicons name="radio-button-on" size={26} color={theme.primary} />
      </TouchableOpacity>
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
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1.5,
    borderColor: '#D9CFBB',
  },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#1C1C1E' },
  filterChipTextActive: { color: '#FFFFFF' },
  locationBtn: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9CFBB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  callout: { minWidth: 160, maxWidth: 220, padding: 4 },
  calloutSpecies: { fontSize: 15, fontWeight: '700', color: '#1C1C1E' },
  calloutMeta: { fontSize: 12, color: '#8BA3B0', marginTop: 2 },
  calloutTime: { fontSize: 12, color: '#8BA3B0' },
  calloutAction: { fontSize: 12, fontWeight: '600', marginTop: 4 },
});
