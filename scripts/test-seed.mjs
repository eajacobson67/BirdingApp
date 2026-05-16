#!/usr/bin/env node
// scripts/test-seed.mjs
// Run this first to verify each component before running the full seed.
// node scripts/test-seed.mjs

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const EBIRD_KEY = '59vakk8sprlj';
const ST_KEY = process.env.EBIRD_ST_KEY;

console.log('\n--- Environment ---');
console.log('EBIRD_ST_KEY:                  ', ST_KEY ? `✓ set (${ST_KEY.slice(0, 4)}...)` : '✗ missing — set EBIRD_ST_KEY=<key>');
console.log('GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS ? `✓ ${process.env.GOOGLE_APPLICATION_CREDENTIALS}` : '✗ missing — set GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json');

// 1. Firebase Admin
console.log('\n--- Firebase ---');
let db;
try {
  initializeApp();
  db = getFirestore();
  await db.collection('_diag').doc('ping').set({ ts: new Date() });
  await db.collection('_diag').doc('ping').delete();
  console.log('Firebase Admin: ✓ connected and write/delete succeeded');
} catch (e) {
  console.error('Firebase Admin: ✗', e.message);
  console.error('Check that GOOGLE_APPLICATION_CREDENTIALS points to a valid service account JSON file.');
  process.exit(1);
}

// 2. eBird taxonomy
console.log('\n--- eBird Taxonomy API ---');
try {
  const res = await fetch(
    'https://api.ebird.org/v2/ref/taxonomy/ebird?fmt=json&cat=species&maxResults=3',
    { headers: { 'X-eBirdApiToken': EBIRD_KEY } },
  );
  if (res.ok) {
    const data = await res.json();
    console.log(`eBird taxonomy: ✓ HTTP ${res.status}, sample: ${data.map(b => b.speciesCode).join(', ')}`);
  } else {
    console.error(`eBird taxonomy: ✗ HTTP ${res.status}`);
  }
} catch (e) {
  console.error('eBird taxonomy: ✗', e.message);
}

// 3. eBird species list for Wisconsin
console.log('\n--- eBird Species List ---');
try {
  const res = await fetch(
    'https://api.ebird.org/v2/product/spplist/US-WI',
    { headers: { 'X-eBirdApiToken': EBIRD_KEY } },
  );
  if (res.ok) {
    const data = await res.json();
    console.log(`eBird spplist US-WI: ✓ ${data.length} species`);
  } else {
    console.error(`eBird spplist US-WI: ✗ HTTP ${res.status}`);
  }
} catch (e) {
  console.error('eBird spplist US-WI: ✗', e.message);
}

// 4. S&T API — American Robin is a reliable test species
console.log('\n--- eBird Status & Trends API ---');
if (!ST_KEY) {
  console.log('S&T API: skipped (EBIRD_ST_KEY not set)');
} else {
  try {
    const url = `https://st-download.ebird.org/v1/fetch?objKey=2023/amerob/regional_stats.csv&key=${ST_KEY}`;
    const res = await fetch(url);
    if (res.ok) {
      const text = await res.text();
      const lines = text.trim().split('\n');
      const wiRow = lines.find(l => l.includes('USA-WI'));
      console.log(`S&T API: ✓ HTTP ${res.status}, ${lines.length - 1} rows`);
      console.log(`  Wisconsin row: ${wiRow ?? '(not found)'}`);
    } else {
      const body = await res.text().catch(() => '');
      console.error(`S&T API: ✗ HTTP ${res.status} — ${body.slice(0, 200)}`);
      console.error('  Check that your EBIRD_ST_KEY is valid for S&T downloads.');
    }
  } catch (e) {
    console.error('S&T API: ✗', e.message);
  }
}

console.log('\nDone. Fix any ✗ above before running npm run seed.\n');
