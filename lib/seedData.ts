import { doc, setDoc, collection, addDoc, getDocs, query, where, Timestamp, GeoPoint } from 'firebase/firestore';
import { db } from './firebase';
import { geohashForLocation } from 'geofire-common';
import { joinLeague, logLeagueSighting } from './firestore/leagues';
import type { Rarity } from './birdRarity';

const RARITY_MAP: Record<string, Rarity> = {
  'american robin': 'common', 'northern cardinal': 'common', 'cedar waxwing': 'uncommon',
  'blue jay': 'common', 'american goldfinch': 'common', 'great horned owl': 'uncommon',
  'sandhill crane': 'uncommon', 'baltimore oriole': 'uncommon', 'peregrine falcon': 'rare',
  'bald eagle': 'rare', 'osprey': 'uncommon',
};

function seedRarity(species: string): Rarity {
  return RARITY_MAP[species.toLowerCase()] ?? 'common';
}

const daysAgo = (n: number) =>
  Timestamp.fromDate(new Date(Date.now() - n * 86400000));

interface FakeSighting {
  commonName: string;
  scientificName: string;
  lat: number;
  lng: number;
  locationName: string;
  state: string;
  country: string;
  daysAgo: number;
}

interface FakeUser {
  id: string;
  username: string;
  displayName: string;
  birdStyleId: string;
  totalSightings: number;
  totalSpecies: number;
  homeLat: number;
  homeLng: number;
  isFriend: boolean;
  yearSpecies: string[];
  statesVisited: string[];
  sightings: FakeSighting[];
}

const MADISON = { lat: 43.073, lng: -89.401, locationName: 'Madison, WI', state: 'Wisconsin', country: 'United States' };
const NEW_YORK = { lat: 40.712, lng: -74.006, locationName: 'New York, NY', state: 'New York', country: 'United States' };
const LONDON = { lat: 51.507, lng: -0.128, locationName: 'London, UK', state: '', country: 'United Kingdom' };
const TOKYO = { lat: 35.682, lng: 139.759, locationName: 'Tokyo, Japan', state: '', country: 'Japan' };
const SYDNEY = { lat: -33.868, lng: 151.209, locationName: 'Sydney, Australia', state: '', country: 'Australia' };
const CAPE_TOWN = { lat: -33.924, lng: 18.424, locationName: 'Cape Town, South Africa', state: '', country: 'South Africa' };
const NAIROBI = { lat: -1.286, lng: 36.817, locationName: 'Nairobi, Kenya', state: '', country: 'Kenya' };

const FAKE_USERS: FakeUser[] = [
  {
    id: 'fake_birder_aaa1',
    username: 'madisonbirder',
    displayName: 'Madison Birder',
    birdStyleId: 'waxwing',
    totalSightings: 183,
    totalSpecies: 47,
    homeLat: MADISON.lat,
    homeLng: MADISON.lng,
    isFriend: true,
    statesVisited: ['Wisconsin', 'Illinois', 'Minnesota'],
    yearSpecies: [
      'American Robin', 'Northern Cardinal', 'Blue Jay', 'Canada Goose', 'Mallard',
      'Red-winged Blackbird', 'Cedar Waxwing', 'American Goldfinch', 'Black-capped Chickadee',
      'Downy Woodpecker', 'White-breasted Nuthatch', 'Song Sparrow', 'Mourning Dove',
      'House Sparrow', 'Great Horned Owl', 'Sandhill Crane', 'Eastern Bluebird',
      'Baltimore Oriole', 'Common Nighthawk', 'Purple Martin',
    ],
    sightings: [
      { commonName: 'American Robin', scientificName: 'Turdus migratorius', ...MADISON, daysAgo: 1 },
      { commonName: 'Northern Cardinal', scientificName: 'Cardinalis cardinalis', ...MADISON, daysAgo: 2 },
      { commonName: 'Cedar Waxwing', scientificName: 'Bombycilla cedrorum', ...MADISON, daysAgo: 3 },
      { commonName: 'Sandhill Crane', scientificName: 'Antigone canadensis', ...MADISON, daysAgo: 5 },
      { commonName: 'Great Horned Owl', scientificName: 'Bubo virginianus', ...MADISON, daysAgo: 8 },
      { commonName: 'Baltimore Oriole', scientificName: 'Icterus galbula', lat: 43.08, lng: -89.39, locationName: 'Madison, WI', state: 'Wisconsin', country: 'United States', daysAgo: 10 },
    ],
  },
  {
    id: 'fake_birder_aaa2',
    username: 'cardinal_fan',
    displayName: 'Cardinal Fan',
    birdStyleId: 'cardinal',
    totalSightings: 67,
    totalSpecies: 23,
    homeLat: 43.06,
    homeLng: -89.41,
    isFriend: true,
    statesVisited: ['Wisconsin'],
    yearSpecies: [
      'Northern Cardinal', 'Blue Jay', 'American Robin', 'House Sparrow', 'Mourning Dove',
      'Downy Woodpecker', 'American Goldfinch', 'Black-capped Chickadee', 'Dark-eyed Junco',
      'White-throated Sparrow', 'House Finch', 'Common Grackle', 'Red-winged Blackbird',
    ],
    sightings: [
      { commonName: 'Northern Cardinal', scientificName: 'Cardinalis cardinalis', ...MADISON, daysAgo: 1 },
      { commonName: 'Blue Jay', scientificName: 'Cyanocitta cristata', ...MADISON, daysAgo: 4 },
      { commonName: 'American Goldfinch', scientificName: 'Spinus tristis', ...MADISON, daysAgo: 7 },
      { commonName: 'House Finch', scientificName: 'Haemorhous mexicanus', lat: 43.07, lng: -89.44, locationName: 'Madison, WI', state: 'Wisconsin', country: 'United States', daysAgo: 12 },
    ],
  },
  {
    id: 'fake_birder_aaa3',
    username: 'global_birder',
    displayName: 'Global Birder',
    birdStyleId: 'robin',
    totalSightings: 341,
    totalSpecies: 89,
    homeLat: MADISON.lat,
    homeLng: MADISON.lng,
    isFriend: true,
    statesVisited: ['Wisconsin', 'New York', 'California', 'Florida', 'Texas'],
    yearSpecies: [
      'American Robin', 'Northern Cardinal', 'Cedar Waxwing', 'Sandhill Crane',
      'European Robin', 'Common Wood Pigeon', 'Blue Tit', 'Great Tit',
      'Brown-eared Bulbul', 'Oriental Turtle Dove', 'Azure-winged Magpie',
      'Rainbow Lorikeet', 'Sulphur-crested Cockatoo', 'Australian Magpie',
      'African Fish Eagle', 'Superb Starling', 'Grey Crowned Crane',
      'Red-tailed Hawk', 'Peregrine Falcon', 'Osprey',
    ],
    sightings: [
      { commonName: 'American Robin', scientificName: 'Turdus migratorius', ...MADISON, daysAgo: 2 },
      { commonName: 'European Robin', scientificName: 'Erithacus rubecula', ...LONDON, daysAgo: 15 },
      { commonName: 'Brown-eared Bulbul', scientificName: 'Hypsipetes amaurotis', ...TOKYO, daysAgo: 30 },
      { commonName: 'Rainbow Lorikeet', scientificName: 'Trichoglossus moluccanus', ...SYDNEY, daysAgo: 45 },
      { commonName: 'African Fish Eagle', scientificName: 'Haliaeetus vocifer', ...NAIROBI, daysAgo: 60 },
      { commonName: 'Red-tailed Hawk', scientificName: 'Buteo jamaicensis', ...NEW_YORK, daysAgo: 90 },
    ],
  },
  {
    id: 'fake_birder_aaa4',
    username: 'hawk_watcher',
    displayName: 'Hawk Watcher',
    birdStyleId: 'cardinal',
    totalSightings: 112,
    totalSpecies: 34,
    homeLat: NEW_YORK.lat,
    homeLng: NEW_YORK.lng,
    isFriend: true,
    statesVisited: ['New York', 'New Jersey', 'Connecticut', 'Pennsylvania'],
    yearSpecies: [
      'Red-tailed Hawk', 'Peregrine Falcon', 'American Robin', 'House Sparrow',
      'Rock Pigeon', 'Common Grackle', 'Song Sparrow', 'Herring Gull',
      'Double-crested Cormorant', 'Osprey', 'Cooper\'s Hawk', 'Sharp-shinned Hawk',
      'Broad-winged Hawk', 'Bald Eagle', 'Northern Harrier',
    ],
    sightings: [
      { commonName: 'Red-tailed Hawk', scientificName: 'Buteo jamaicensis', ...NEW_YORK, daysAgo: 1 },
      { commonName: 'Peregrine Falcon', scientificName: 'Falco peregrinus', lat: 40.748, lng: -74.0, locationName: 'New York, NY', state: 'New York', country: 'United States', daysAgo: 3 },
      { commonName: 'Bald Eagle', scientificName: 'Haliaeetus leucocephalus', lat: 40.73, lng: -74.01, locationName: 'New York, NY', state: 'New York', country: 'United States', daysAgo: 6 },
      { commonName: 'Osprey', scientificName: 'Pandion haliaetus', lat: 40.72, lng: -74.02, locationName: 'New York, NY', state: 'New York', country: 'United States', daysAgo: 9 },
      { commonName: 'Northern Harrier', scientificName: 'Circus hudsonius', ...NEW_YORK, daysAgo: 14 },
    ],
  },
  {
    id: 'fake_birder_aaa5',
    username: 'wren_lover',
    displayName: 'Wren Lover',
    birdStyleId: 'waxwing',
    totalSightings: 38,
    totalSpecies: 12,
    homeLat: 43.09,
    homeLng: -89.38,
    isFriend: true,
    statesVisited: ['Wisconsin'],
    yearSpecies: [
      'House Wren', 'Carolina Wren', 'American Robin', 'Mourning Dove',
      'House Sparrow', 'American Goldfinch', 'Black-capped Chickadee',
      'White-breasted Nuthatch', 'Downy Woodpecker', 'Northern Cardinal',
    ],
    sightings: [
      { commonName: 'House Wren', scientificName: 'Troglodytes aedon', lat: 43.091, lng: -89.381, locationName: 'Madison, WI', state: 'Wisconsin', country: 'United States', daysAgo: 1 },
      { commonName: 'Carolina Wren', scientificName: 'Thryothorus ludovicianus', ...MADISON, daysAgo: 5 },
      { commonName: 'American Goldfinch', scientificName: 'Spinus tristis', lat: 43.088, lng: -89.385, locationName: 'Madison, WI', state: 'Wisconsin', country: 'United States', daysAgo: 9 },
    ],
  },
  {
    id: 'fake_birder_aaa6',
    username: 'tokyo_twitcher',
    displayName: 'Tokyo Twitcher',
    birdStyleId: 'robin',
    totalSightings: 256,
    totalSpecies: 67,
    homeLat: TOKYO.lat,
    homeLng: TOKYO.lng,
    isFriend: false,
    statesVisited: [],
    yearSpecies: [
      'Brown-eared Bulbul', 'Large-billed Crow', 'Oriental Turtle Dove',
      'Azure-winged Magpie', 'Japanese White-eye', 'Eastern Spot-billed Duck',
      'Grey-capped Greenfinch', 'Eurasian Tree Sparrow', 'Barn Swallow',
      'White Wagtail', 'Common Kingfisher', 'Little Egret',
      'Grey Heron', 'Black Kite', 'Common Buzzard',
    ],
    sightings: [
      { commonName: 'Brown-eared Bulbul', scientificName: 'Hypsipetes amaurotis', ...TOKYO, daysAgo: 1 },
      { commonName: 'Japanese White-eye', scientificName: 'Zosterops japonicus', lat: 35.69, lng: 139.77, locationName: 'Tokyo, Japan', state: '', country: 'Japan', daysAgo: 2 },
      { commonName: 'Azure-winged Magpie', scientificName: 'Cyanopica cyanus', lat: 35.67, lng: 139.75, locationName: 'Tokyo, Japan', state: '', country: 'Japan', daysAgo: 4 },
      { commonName: 'Common Kingfisher', scientificName: 'Alcedo atthis', lat: 35.70, lng: 139.78, locationName: 'Tokyo, Japan', state: '', country: 'Japan', daysAgo: 7 },
      { commonName: 'Oriental Turtle Dove', scientificName: 'Streptopelia orientalis', ...TOKYO, daysAgo: 10 },
    ],
  },
  {
    id: 'fake_birder_aaa7',
    username: 'aussie_birder',
    displayName: 'Aussie Birder',
    birdStyleId: 'cardinal',
    totalSightings: 189,
    totalSpecies: 55,
    homeLat: SYDNEY.lat,
    homeLng: SYDNEY.lng,
    isFriend: false,
    statesVisited: [],
    yearSpecies: [
      'Rainbow Lorikeet', 'Sulphur-crested Cockatoo', 'Australian Magpie',
      'Common Myna', 'Noisy Miner', 'Welcome Swallow',
      'Galah', 'Little Corella', 'Laughing Kookaburra',
      'Pacific Black Duck', 'Australian Pelican', 'Silver Gull',
      'Little Penguin', 'Superb Fairy-wren', 'Willie Wagtail',
    ],
    sightings: [
      { commonName: 'Rainbow Lorikeet', scientificName: 'Trichoglossus moluccanus', ...SYDNEY, daysAgo: 1 },
      { commonName: 'Sulphur-crested Cockatoo', scientificName: 'Cacatua galerita', lat: -33.86, lng: 151.21, locationName: 'Sydney, Australia', state: '', country: 'Australia', daysAgo: 3 },
      { commonName: 'Laughing Kookaburra', scientificName: 'Dacelo novaeguineae', lat: -33.88, lng: 151.20, locationName: 'Sydney, Australia', state: '', country: 'Australia', daysAgo: 5 },
      { commonName: 'Superb Fairy-wren', scientificName: 'Malurus cyaneus', lat: -33.87, lng: 151.22, locationName: 'Sydney, Australia', state: '', country: 'Australia', daysAgo: 8 },
      { commonName: 'Australian Pelican', scientificName: 'Pelecanus conspicillatus', ...SYDNEY, daysAgo: 12 },
    ],
  },
  {
    id: 'fake_birder_aaa8',
    username: 'cape_birder',
    displayName: 'Cape Birder',
    birdStyleId: 'waxwing',
    totalSightings: 143,
    totalSpecies: 41,
    homeLat: CAPE_TOWN.lat,
    homeLng: CAPE_TOWN.lng,
    isFriend: false,
    statesVisited: [],
    yearSpecies: [
      'Cape Gannet', 'African Penguin', 'Southern Boubou',
      'Cape Sparrow', 'Rock Kestrel', 'Hadeda Ibis',
      'Cattle Egret', 'Pied Crow', 'Cape Weaver',
      'Speckled Pigeon', 'Cape Francolin', 'African Sacred Ibis',
      'Black-headed Heron', 'Cape Cormorant', 'White-breasted Cormorant',
    ],
    sightings: [
      { commonName: 'African Penguin', scientificName: 'Spheniscus demersus', ...CAPE_TOWN, daysAgo: 1 },
      { commonName: 'Cape Gannet', scientificName: 'Morus capensis', lat: -33.91, lng: 18.43, locationName: 'Cape Town, South Africa', state: '', country: 'South Africa', daysAgo: 4 },
      { commonName: 'Hadeda Ibis', scientificName: 'Bostrychia hagedash', lat: -33.93, lng: 18.42, locationName: 'Cape Town, South Africa', state: '', country: 'South Africa', daysAgo: 7 },
      { commonName: 'Cape Weaver', scientificName: 'Ploceus capensis', ...CAPE_TOWN, daysAgo: 11 },
    ],
  },
  {
    id: 'fake_birder_aaa9',
    username: 'uk_lister',
    displayName: 'UK Lister',
    birdStyleId: 'robin',
    totalSightings: 312,
    totalSpecies: 78,
    homeLat: LONDON.lat,
    homeLng: LONDON.lng,
    isFriend: false,
    statesVisited: [],
    yearSpecies: [
      'European Robin', 'Common Wood Pigeon', 'Blue Tit', 'Great Tit',
      'Eurasian Blackbird', 'House Sparrow', 'Common Chaffinch',
      'Eurasian Jay', 'Song Thrush', 'Barnacle Goose',
      'Mute Swan', 'Common Moorhen', 'Eurasian Coot',
      'Little Grebe', 'Great Crested Grebe', 'Tufted Duck',
      'Common Pochard', 'Eurasian Teal', 'Common Goldeneye',
      'Barn Owl',
    ],
    sightings: [
      { commonName: 'European Robin', scientificName: 'Erithacus rubecula', ...LONDON, daysAgo: 1 },
      { commonName: 'Blue Tit', scientificName: 'Cyanistes caeruleus', lat: 51.51, lng: -0.12, locationName: 'London, UK', state: '', country: 'United Kingdom', daysAgo: 2 },
      { commonName: 'Mute Swan', scientificName: 'Cygnus olor', lat: 51.50, lng: -0.14, locationName: 'London, UK', state: '', country: 'United Kingdom', daysAgo: 3 },
      { commonName: 'Barn Owl', scientificName: 'Tyto alba', lat: 51.52, lng: -0.11, locationName: 'London, UK', state: '', country: 'United Kingdom', daysAgo: 6 },
      { commonName: 'Eurasian Jay', scientificName: 'Garrulus glandarius', ...LONDON, daysAgo: 10 },
      { commonName: 'Great Crested Grebe', scientificName: 'Podiceps cristatus', lat: 51.49, lng: -0.13, locationName: 'London, UK', state: '', country: 'United Kingdom', daysAgo: 14 },
    ],
  },
  {
    id: 'fake_birder_aab0',
    username: 'kenya_birder',
    displayName: 'Kenya Birder',
    birdStyleId: 'cardinal',
    totalSightings: 387,
    totalSpecies: 92,
    homeLat: NAIROBI.lat,
    homeLng: NAIROBI.lng,
    isFriend: false,
    statesVisited: [],
    yearSpecies: [
      'African Fish Eagle', 'Superb Starling', 'Hadada Ibis',
      'African Sacred Ibis', 'Grey Crowned Crane', 'Yellow-billed Stork',
      'Marabou Stork', 'White-backed Vulture', 'Bateleur',
      'Red-billed Oxpecker', 'Lilac-breasted Roller', 'African Jacana',
      'Secretary Bird', 'Ostrich', 'Common Ostrich',
      'African Grey Hornbill', 'Von der Decken\'s Hornbill', 'Red-billed Hornbill',
      'Martial Eagle', 'African Hawk-Eagle',
    ],
    sightings: [
      { commonName: 'African Fish Eagle', scientificName: 'Haliaeetus vocifer', ...NAIROBI, daysAgo: 1 },
      { commonName: 'Superb Starling', scientificName: 'Lamprotornis superbus', lat: -1.29, lng: 36.82, locationName: 'Nairobi, Kenya', state: '', country: 'Kenya', daysAgo: 2 },
      { commonName: 'Grey Crowned Crane', scientificName: 'Balearica regulorum', lat: -1.28, lng: 36.81, locationName: 'Nairobi, Kenya', state: '', country: 'Kenya', daysAgo: 3 },
      { commonName: 'Lilac-breasted Roller', scientificName: 'Coracias caudatus', lat: -1.30, lng: 36.83, locationName: 'Nairobi, Kenya', state: '', country: 'Kenya', daysAgo: 5 },
      { commonName: 'Secretary Bird', scientificName: 'Sagittarius serpentarius', ...NAIROBI, daysAgo: 7 },
      { commonName: 'Bateleur', scientificName: 'Terathopius ecaudatus', lat: -1.27, lng: 36.80, locationName: 'Nairobi, Kenya', state: '', country: 'Kenya', daysAgo: 9 },
      { commonName: 'Martial Eagle', scientificName: 'Polemaetus bellicosus', ...NAIROBI, daysAgo: 12 },
    ],
  },
];

export async function seedFakeData(currentUserId: string): Promise<void> {
  const year = '2026';

  for (const user of FAKE_USERS) {
    const geohash = geohashForLocation([user.homeLat, user.homeLng]);

    await setDoc(doc(db, 'users', user.id), {
      uid: user.id,
      username: user.username,
      displayName: user.displayName,
      photoURL: '',
      birdStyleId: user.birdStyleId,
      bio: '',
      totalSightings: user.totalSightings,
      totalSpecies: user.totalSpecies,
      yearSpecies: { [year]: user.yearSpecies },
      statesVisited: user.statesVisited,
      lastSightingDate: daysAgo(1),
      joinedAt: daysAgo(365),
      location: new GeoPoint(user.homeLat, user.homeLng),
      geohash,
    });

    for (const s of user.sightings) {
      const sightingGeohash = geohashForLocation([s.lat, s.lng]);
      await addDoc(collection(db, 'sightings'), {
        userId: user.id,
        commonName: s.commonName,
        scientificName: s.scientificName,
        confidence: 1.0,
        location: new GeoPoint(s.lat, s.lng),
        locationName: s.locationName,
        state: s.state,
        country: s.country,
        photoURL: null,
        audioURL: null,
        notes: '',
        timestamp: daysAgo(s.daysAgo),
        isPublic: true,
        likes: Math.floor(Math.random() * 12),
        geohash: sightingGeohash,
      });
    }

    if (user.isFriend) {
      await setDoc(doc(db, 'friendships', currentUserId, 'connections', user.id), {
        status: 'accepted',
        since: daysAgo(30),
      });
      await setDoc(doc(db, 'friendships', user.id, 'connections', currentUserId), {
        status: 'accepted',
        since: daysAgo(30),
      });
    }
  }

  // Auto-join friends into any active or lobby public leagues
  const leagueSnap = await getDocs(
    query(collection(db, 'leagues'), where('isPublic', '==', true), where('status', 'in', ['active', 'lobby'])),
  );
  if (leagueSnap.empty) return;

  const leagues = leagueSnap.docs.map((d) => ({
    id: d.id,
    status: d.data().status as string,
    config: (d.data().config ?? {}) as { rarityScoring?: boolean; requirePhotos?: boolean; targetBirds?: boolean },
  }));
  const friends = FAKE_USERS.filter((u) => u.isFriend);

  for (const league of leagues) {
    for (const friend of friends) {
      await joinLeague(league.id, friend.id, friend.displayName, friend.birdStyleId);

      // Only log sightings for active leagues — lobby leagues haven't started
      if (league.status !== 'active') continue;
      const toLog = friend.sightings.slice(0, 4);
      for (const s of toLog) {
        const sightingRef = await addDoc(collection(db, 'sightings'), {
          userId: friend.id,
          commonName: s.commonName,
          scientificName: s.scientificName,
          confidence: 1.0,
          location: new GeoPoint(s.lat, s.lng),
          locationName: s.locationName,
          state: s.state,
          country: s.country,
          photoURL: null,
          audioURL: null,
          notes: '',
          timestamp: daysAgo(s.daysAgo),
          isPublic: true,
          likes: 0,
          geohash: geohashForLocation([s.lat, s.lng]),
        });
        await logLeagueSighting(league.id, {
          sightingId: sightingRef.id,
          userId: friend.id,
          species: s.commonName,
          rarity: seedRarity(s.commonName),
          photoURL: null,
          config: {
            rarityScoring: league.config.rarityScoring ?? true,
            requirePhotos: league.config.requirePhotos ?? false,
            targetBirds: league.config.targetBirds ?? false,
          },
        });
      }
    }
  }
}
