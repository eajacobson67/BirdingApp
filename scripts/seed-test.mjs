#!/usr/bin/env node
// scripts/seed-test.mjs
// Seeds just Wisconsin with the top 20 species — verifies the full pipeline in ~30 seconds.
// If commonBirds/USA-WI and species/taxonomy appear in Firestore after this, the full seed will work.
// node scripts/seed-test.mjs

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const EBIRD_KEY = '59vakk8sprlj';
const ST_KEY    = process.env.EBIRD_ST_KEY;
const DELAY_MS  = 220;
const TEST_STATE_EBIRD  = 'US-WI';
const TEST_STATE_ST     = 'USA-WI';
const SPECIES_LIMIT     = 20; // only download S&T for the first 20 WI species

if (!ST_KEY) { console.error('Set EBIRD_ST_KEY'); process.exit(1); }

initializeApp();
const db = getFirestore();

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).filter(l => l.trim()).map(l => {
    const vals = l.split(',');
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? '').trim()]));
  });
}

async function main() {
  // 1. Taxonomy
  console.log('1. Fetching eBird taxonomy...');
  const taxRes = await fetch('https://api.ebird.org/v2/ref/taxonomy/ebird?fmt=json&cat=species', {
    headers: { 'X-eBirdApiToken': EBIRD_KEY },
  });
  if (!taxRes.ok) { console.error(`   ✗ HTTP ${taxRes.status}`); process.exit(1); }
  const taxonomy = await taxRes.json();
  const nameMap = new Map(taxonomy.map(b => [b.speciesCode, { commonName: b.comName, scientificName: b.sciName }]));
  console.log(`   ✓ ${nameMap.size} species loaded`);

  // 2. Wisconsin species list
  console.log(`2. Fetching species list for ${TEST_STATE_EBIRD}...`);
  const sppRes = await fetch(`https://api.ebird.org/v2/product/spplist/${TEST_STATE_EBIRD}`, {
    headers: { 'X-eBirdApiToken': EBIRD_KEY },
  });
  if (!sppRes.ok) { console.error(`   ✗ HTTP ${sppRes.status}`); process.exit(1); }
  const allCodes = await sppRes.json();
  const codes = allCodes.slice(0, SPECIES_LIMIT);
  console.log(`   ✓ ${allCodes.length} total WI species, testing first ${codes.length}`);

  // 3. S&T downloads — fetch just the first species and dump raw output for inspection
  const firstCode = codes[0];
  console.log(`3. Inspecting S&T response for first species: ${firstCode}`);
  const stUrl = `https://st-download.ebird.org/v1/fetch?objKey=2023/${firstCode}/regional_stats.csv&key=${ST_KEY}`;
  console.log(`   URL: ${stUrl}`);
  const stRes = await fetch(stUrl);
  console.log(`   HTTP status: ${stRes.status}`);
  const rawText = await stRes.text();
  const firstLines = rawText.split('\n').slice(0, 6);
  console.log('   First 6 lines of response:');
  firstLines.forEach(l => console.log('     |', l));

  if (!stRes.ok) {
    console.error(`\n✗ S&T API returned HTTP ${stRes.status}. Check your EBIRD_ST_KEY.`);
    process.exit(1);
  }

  // Now download the rest using whatever column/value names we actually see
  console.log(`\n   Downloading remaining ${codes.length - 1} species...`);
  const rows0 = parseCSV(rawText);
  const headers = rawText.split('\n')[0];
  console.log(`   CSV headers: ${headers}`);

  const abundanceMap = new Map();
  let ok = 0, failed = 0;

  function extractWI(rows) {
    // Try both known region_code formats and column name variants
    return rows.filter(r =>
      (r.region_code === TEST_STATE_ST || r.region_code === 'US-WI') &&
      (r.region_type === 'subnational1' || r.region_type === 'state')
    );
  }

  const wiRows0 = extractWI(rows0);
  if (wiRows0.length > 0) {
    const max = Math.max(...wiRows0.map(r => parseFloat(r.abundance_mean) || 0));
    if (max > 0) { abundanceMap.set(firstCode, max); ok++; }
  }

  for (const code of codes.slice(1)) {
    const res = await fetch(
      `https://st-download.ebird.org/v1/fetch?objKey=2023/${code}/regional_stats.csv&key=${ST_KEY}`,
    );
    if (!res.ok) {
      console.log(`   ✗ ${code}: HTTP ${res.status}`);
      failed++;
      await sleep(DELAY_MS);
      continue;
    }
    const wiRows = extractWI(parseCSV(await res.text()));
    if (wiRows.length > 0) {
      const max = Math.max(...wiRows.map(r => parseFloat(r.abundance_mean) || 0));
      if (max > 0) { abundanceMap.set(code, max); ok++; }
    }
    await sleep(DELAY_MS);
  }
  console.log(`   ✓ ${ok} species with WI abundance data, ${failed} S&T failures`);

  if (abundanceMap.size === 0) {
    console.error('\n✗ No abundance data collected — check EBIRD_ST_KEY and try again.');
    process.exit(1);
  }

  // 4. Write to Firestore
  console.log('4. Writing to Firestore...');
  const species = [...abundanceMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .filter(([code]) => nameMap.has(code))
    .map(([speciesCode, abundance]) => ({ speciesCode, abundance }));

  const taxonomyDoc = Object.fromEntries(
    [...abundanceMap.keys()].filter(c => nameMap.has(c)).map(c => [c, nameMap.get(c)])
  );

  await Promise.all([
    db.collection('commonBirds').doc(TEST_STATE_ST).set({ updatedAt: new Date(), species }),
    db.collection('species').doc('taxonomy').set(taxonomyDoc, { merge: true }),
  ]);
  console.log(`   ✓ commonBirds/${TEST_STATE_ST}: ${species.length} species written`);
  console.log(`   ✓ species/taxonomy: ${Object.keys(taxonomyDoc).length} entries written (merged)`);

  // 5. Read back to verify
  console.log('5. Reading back from Firestore...');
  const snap = await db.collection('commonBirds').doc(TEST_STATE_ST).get();
  const written = snap.data()?.species ?? [];
  console.log(`   ✓ Read back ${written.length} species from commonBirds/${TEST_STATE_ST}`);
  console.log('\n   Top 5:');
  written.slice(0, 5).forEach((s, i) => {
    const name = nameMap.get(s.speciesCode)?.commonName ?? s.speciesCode;
    console.log(`     ${i + 1}. ${name} (${s.speciesCode}) — abundance: ${s.abundance.toFixed(6)}`);
  });

  console.log('\n✓ Test seed successful. Run npm run seed for all states.\n');
}

main().catch(err => { console.error('\n✗', err.message); process.exit(1); });
