#!/usr/bin/env node
// Adds 30 sightings to the eajacobson67 account and updates their user stats.
// node scripts/seed-my-sightings.mjs

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { geohashForLocation } from 'geofire-common';

initializeApp();
const db = getFirestore();

const BIRDS = [
  { commonName: 'American Robin', scientificName: 'Turdus migratorius' },
  { commonName: 'Blue Jay', scientificName: 'Cyanocitta cristata' },
  { commonName: 'Northern Cardinal', scientificName: 'Cardinalis cardinalis' },
  { commonName: 'Black-capped Chickadee', scientificName: 'Poecile atricapillus' },
  { commonName: 'Downy Woodpecker', scientificName: 'Dryobates pubescens' },
  { commonName: 'Cedar Waxwing', scientificName: 'Bombycilla cedrorum' },
  { commonName: 'Red-tailed Hawk', scientificName: 'Buteo jamaicensis' },
  { commonName: 'American Goldfinch', scientificName: 'Spinus tristis' },
  { commonName: 'Song Sparrow', scientificName: 'Melospiza melodia' },
  { commonName: 'Dark-eyed Junco', scientificName: 'Junco hyemalis' },
  { commonName: 'White-breasted Nuthatch', scientificName: 'Sitta carolinensis' },
  { commonName: 'Common Grackle', scientificName: 'Quiscalus quiscula' },
  { commonName: 'Red-winged Blackbird', scientificName: 'Agelaius phoeniceus' },
  { commonName: 'Mourning Dove', scientificName: 'Zenaida macroura' },
  { commonName: 'Canada Goose', scientificName: 'Branta canadensis' },
  { commonName: 'Mallard', scientificName: 'Anas platyrhynchos' },
  { commonName: 'Great Blue Heron', scientificName: 'Ardea herodias' },
  { commonName: 'Belted Kingfisher', scientificName: 'Megaceryle alcyon' },
  { commonName: 'Eastern Phoebe', scientificName: 'Sayornis phoebe' },
  { commonName: 'Baltimore Oriole', scientificName: 'Icterus galbula' },
  { commonName: 'Rose-breasted Grosbeak', scientificName: 'Pheucticus ludovicianus' },
  { commonName: 'Ruby-throated Hummingbird', scientificName: 'Archilochus colubris' },
  { commonName: 'Tree Swallow', scientificName: 'Tachycineta bicolor' },
  { commonName: 'Barn Swallow', scientificName: 'Hirundo rustica' },
  { commonName: 'Killdeer', scientificName: 'Charadrius vociferus' },
  { commonName: 'Sandhill Crane', scientificName: 'Antigone canadensis' },
  { commonName: "Cooper's Hawk", scientificName: 'Accipiter cooperii' },
  { commonName: 'Indigo Bunting', scientificName: 'Passerina cyanea' },
  { commonName: 'Yellow Warbler', scientificName: 'Setophaga petechia' },
  { commonName: 'Common Loon', scientificName: 'Gavia immer' },
];

// Madison, WI area coords with slight variation per sighting
const BASE_LAT = 43.0731;
const BASE_LNG = -89.4012;

async function main() {
  // Find the user
  const snap = await db.collection('users').where('username', '==', 'eajacobson67').limit(1).get();
  if (snap.empty) { console.error('User eajacobson67 not found'); process.exit(1); }
  const userDoc = snap.docs[0];
  const uid = userDoc.id;
  console.log(`Found user: ${uid}`);

  const year = new Date().getFullYear().toString();
  const batch = db.batch();
  const speciesThisYear = BIRDS.map(b => b.commonName);

  // Create sighting documents
  for (let i = 0; i < BIRDS.length; i++) {
    const bird = BIRDS[i];
    const lat = BASE_LAT + (i - 15) * 0.008;
    const lng = BASE_LNG + (i % 7 - 3) * 0.01;
    const daysAgo = i * 3;
    const timestamp = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

    const ref = db.collection('sightings').doc();
    batch.set(ref, {
      userId: uid,
      commonName: bird.commonName,
      scientificName: bird.scientificName,
      confidence: 1.0,
      lat,
      lng,
      locationName: 'Madison, WI',
      state: 'Wisconsin',
      country: 'United States',
      photoURL: null,
      audioURL: null,
      notes: '',
      timestamp,
      isPublic: true,
      geohash: geohashForLocation([lat, lng]),
    });
  }

  // Update user stats
  const geohash = geohashForLocation([BASE_LAT, BASE_LNG]);
  batch.update(userDoc.ref, {
    totalSightings: FieldValue.increment(BIRDS.length),
    totalSpecies: FieldValue.increment(BIRDS.length),
    [`yearSpecies.${year}`]: FieldValue.arrayUnion(...speciesThisYear),
    location: { lat: BASE_LAT, lng: BASE_LNG },
    geohash,
    lastSightingDate: new Date(),
  });

  await batch.commit();
  console.log(`✓ Added ${BIRDS.length} sightings and updated stats for eajacobson67`);
}

main().catch(err => { console.error('✗', err.message); process.exit(1); });
