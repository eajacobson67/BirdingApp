#!/usr/bin/env node
// Seeds 100 fake user profiles into Firestore for leaderboard/nearby testing.
// Requires GOOGLE_APPLICATION_CREDENTIALS to point to your service account key.
// node scripts/seed-users.mjs

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { geohashForLocation } from 'geofire-common';

initializeApp();
const db = getFirestore();

// 30 users near Madison WI so "nearby" works locally; rest spread across US cities
const LOCATIONS = [
  ...Array.from({ length: 30 }, (_, i) => ({
    lat: 43.0731 + (i - 15) * 0.04,
    lng: -89.4012 + (i % 7 - 3) * 0.06,
  })),
  { lat: 43.0389, lng: -87.9065 }, // Milwaukee
  { lat: 44.5192, lng: -88.0198 }, // Green Bay
  { lat: 41.8781, lng: -87.6298 }, // Chicago
  { lat: 44.9778, lng: -93.2650 }, // Minneapolis
  { lat: 40.7128, lng: -74.0060 }, // New York
  { lat: 34.0522, lng: -118.2437 }, // Los Angeles
  { lat: 29.7604, lng: -95.3698 }, // Houston
  { lat: 33.4484, lng: -112.0740 }, // Phoenix
  { lat: 47.6062, lng: -122.3321 }, // Seattle
  { lat: 39.7392, lng: -104.9903 }, // Denver
  { lat: 42.3601, lng: -71.0589 }, // Boston
  { lat: 33.7490, lng: -84.3880 }, // Atlanta
  { lat: 25.7617, lng: -80.1918 }, // Miami
  { lat: 45.5051, lng: -122.6750 }, // Portland
  { lat: 32.7767, lng: -96.7970 }, // Dallas
  { lat: 39.9526, lng: -75.1652 }, // Philadelphia
  { lat: 36.1627, lng: -86.7816 }, // Nashville
  { lat: 35.2271, lng: -80.8431 }, // Charlotte
  { lat: 43.6591, lng: -70.2568 }, // Portland ME
  { lat: 41.2524, lng: -95.9980 }, // Omaha
  { lat: 38.2527, lng: -85.7585 }, // Louisville
  { lat: 39.1031, lng: -84.5120 }, // Cincinnati
  { lat: 42.3314, lng: -83.0458 }, // Detroit
  { lat: 43.0481, lng: -76.1474 }, // Syracuse
  { lat: 30.3322, lng: -81.6557 }, // Jacksonville
  { lat: 30.2672, lng: -97.7431 }, // Austin
  { lat: 35.4676, lng: -97.5164 }, // Oklahoma City
  { lat: 35.1495, lng: -90.0490 }, // Memphis
  { lat: 32.3668, lng: -86.3000 }, // Montgomery
  { lat: 35.7796, lng: -78.6382 }, // Raleigh
  { lat: 44.0521, lng: -91.6380 }, // La Crosse WI
  { lat: 44.8113, lng: -91.4985 }, // Eau Claire WI
  { lat: 46.7867, lng: -92.1005 }, // Duluth MN
  { lat: 43.5453, lng: -96.7311 }, // Sioux Falls
  { lat: 38.8951, lng: -77.0364 }, // Washington DC
  { lat: 39.7684, lng: -86.1581 }, // Indianapolis
  { lat: 41.4993, lng: -81.6944 }, // Cleveland
  { lat: 40.4406, lng: -79.9959 }, // Pittsburgh
  { lat: 43.0481, lng: -76.1474 }, // Syracuse NY
];

const BIRDS = [
  'American Robin', 'House Sparrow', 'European Starling', 'American Crow',
  'Blue Jay', 'Northern Cardinal', 'Mallard', 'Canada Goose',
  'Red-tailed Hawk', 'American Goldfinch', 'Dark-eyed Junco', 'Song Sparrow',
  'Black-capped Chickadee', 'Downy Woodpecker', 'White-breasted Nuthatch',
  'Cedar Waxwing', 'Common Grackle', 'Red-winged Blackbird', 'Mourning Dove',
  'Rock Pigeon', 'House Finch', 'Purple Finch', 'American Kestrel',
  "Cooper's Hawk", 'Ruby-throated Hummingbird', 'Baltimore Oriole',
  'Rose-breasted Grosbeak', 'Indigo Bunting', 'Yellow Warbler',
  'Common Yellowthroat', 'American Redstart', 'Wood Thrush', 'Eastern Bluebird',
  'Tree Swallow', 'Barn Swallow', 'Chimney Swift', 'Belted Kingfisher',
  'Great Blue Heron', 'Great Egret', 'Ring-billed Gull', 'Killdeer',
  'Sandhill Crane', 'Wild Turkey', 'Common Loon', 'Pileated Woodpecker',
  'Eastern Phoebe', 'Great Crested Flycatcher', 'Red-eyed Vireo',
  'Ovenbird', 'Swainson\'s Thrush', 'Veery',
];

// Simple deterministic shuffle via seeded LCG
function seededShuffle(arr, seed) {
  const out = [...arr];
  let s = seed;
  const rand = () => { s = (Math.imul(s, 1664525) + 1013904223) | 0; return ((s >>> 0) / 0x100000000); };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function seededRand(seed) {
  let s = seed;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) | 0; return (s >>> 0) / 0x100000000; };
}

async function main() {
  const year = new Date().getFullYear().toString();
  const prevYear = (new Date().getFullYear() - 1).toString();

  // Delete existing seed users first
  const existing = await db.collection('users').where('username', '>=', 'birder0').where('username', '<=', 'birder1').get();
  if (existing.size > 0) {
    const delBatch = db.batch();
    existing.docs.forEach(d => delBatch.delete(d.ref));
    await delBatch.commit();
    console.log(`Deleted ${existing.size} existing seed users`);
  }

  const batch = db.batch();

  for (let i = 1; i <= 100; i++) {
    const rand = seededRand(i * 31337);
    const locIdx = Math.floor(rand() * LOCATIONS.length);
    const base = LOCATIONS[locIdx];
    const lat = base.lat + (rand() - 0.5) * 0.1;
    const lng = base.lng + (rand() - 0.5) * 0.1;
    const geohash = geohashForLocation([lat, lng]);

    const totalSpecies = Math.floor(rand() * 240) + 5;
    const totalSightings = totalSpecies + Math.floor(rand() * totalSpecies * 3);

    const shuffled = seededShuffle(BIRDS, i * 99991);
    const yearCount = Math.min(totalSpecies, Math.max(1, Math.floor(rand() * 35) + 1));
    const prevCount = Math.min(totalSpecies - yearCount, Math.floor(rand() * 25));

    const uid = `seed_user_${String(i).padStart(3, '0')}`;
    const ref = db.collection('users').doc(uid);
    batch.set(ref, {
      uid,
      username: `birder${String(i).padStart(3, '0')}`,
      displayName: `Birder ${i}`,
      photoURL: '',
      bio: '',
      birdStyleId: null,
      totalSightings,
      totalSpecies,
      yearSpecies: {
        [year]: shuffled.slice(0, yearCount),
        [prevYear]: prevCount > 0 ? shuffled.slice(yearCount, yearCount + prevCount) : [],
      },
      statesVisited: [],
      lastSightingDate: null,
      joinedAt: new Date(Date.now() - Math.floor(rand() * 365 * 24 * 60 * 60 * 1000)),
      location: { lat, lng },
      geohash,
    });
  }

  await batch.commit();
  console.log('✓ 100 seed users written to Firestore');
}

main().catch(err => { console.error('✗', err.message); process.exit(1); });
