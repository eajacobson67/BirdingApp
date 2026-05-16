#!/usr/bin/env node
// scripts/seed-birds.mjs
// Downloads eBird S&T per-state abundance data and seeds two Firestore collections:
//   commonBirds/{USA-WI}  →  { updatedAt, species: [{ speciesCode, abundance }] }  (300 per state)
//   species/taxonomy      →  { amerob: { commonName, scientificName }, ... }        (central lookup)
//
// One-time setup:
//   npm install --save-dev firebase-admin
//   Download service account key: Firebase console → Project Settings → Service accounts → Generate new private key
//   set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\serviceAccountKey.json
//   set EBIRD_ST_KEY=<your S&T API key>
//   node scripts/seed-birds.mjs
//
// On subsequent runs the download phase is skipped if seed-cache.json exists.
// To force a fresh download: node scripts/seed-birds.mjs --fresh

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const EBIRD_KEY         = '59vakk8sprlj';
const ST_KEY            = process.env.EBIRD_ST_KEY;
const DELAY_MS          = 220;
const SPECIES_PER_STATE = 300;
const FRESH             = process.argv.includes('--fresh');
const CACHE_PATH        = join(dirname(fileURLToPath(import.meta.url)), 'seed-cache.json');

if (!ST_KEY) {
  console.error('Set EBIRD_ST_KEY env var to your eBird Status & Trends API key');
  process.exit(1);
}

initializeApp();
const db = getFirestore();

const US_STATES = [
  'US-AL','US-AK','US-AZ','US-AR','US-CA','US-CO','US-CT','US-DE','US-FL','US-GA',
  'US-HI','US-ID','US-IL','US-IN','US-IA','US-KS','US-KY','US-LA','US-ME','US-MD',
  'US-MA','US-MI','US-MN','US-MS','US-MO','US-MT','US-NE','US-NV','US-NH','US-NJ',
  'US-NM','US-NY','US-NC','US-ND','US-OH','US-OK','US-OR','US-PA','US-RI','US-SC',
  'US-SD','US-TN','US-TX','US-UT','US-VT','US-VA','US-WA','US-WV','US-WI','US-WY',
  'US-DC',
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1)
    .filter(l => l.trim())
    .map(l => {
      const vals = l.split(',');
      return Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? '').trim()]));
    });
}

async function fetchJSON(url, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

function saveCache(nameMap, stateMap) {
  const data = {
    savedAt: new Date().toISOString(),
    nameMap: Object.fromEntries(nameMap),
    stateMap: Object.fromEntries(
      [...stateMap.entries()].map(([state, speciesMap]) => [state, Object.fromEntries(speciesMap)])
    ),
  };
  writeFileSync(CACHE_PATH, JSON.stringify(data));
  console.log(`  Cache saved to scripts/seed-cache.json (${(JSON.stringify(data).length / 1024).toFixed(0)} KB)`);
}

function loadCache() {
  const data = JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
  const nameMap = new Map(Object.entries(data.nameMap));
  const stateMap = new Map(
    Object.entries(data.stateMap).map(([state, speciesObj]) => [state, new Map(Object.entries(speciesObj))])
  );
  console.log(`  Loaded from cache (saved ${data.savedAt}): ${stateMap.size} states, ${nameMap.size} species`);
  return { nameMap, stateMap };
}

async function download() {
  // 1. Full eBird taxonomy
  console.log('Fetching eBird taxonomy...');
  const taxonomy = await fetchJSON(
    'https://api.ebird.org/v2/ref/taxonomy/ebird?fmt=json&cat=species',
    { 'X-eBirdApiToken': EBIRD_KEY },
  );
  const nameMap = new Map(taxonomy.map(b => [b.speciesCode, { commonName: b.comName, scientificName: b.sciName }]));
  console.log(`Taxonomy loaded: ${nameMap.size} species`);

  // 2. Union of all species codes across US states
  console.log('Fetching eBird species lists per state...');
  const allCodes = new Set();
  for (const state of US_STATES) {
    try {
      const codes = await fetchJSON(
        `https://api.ebird.org/v2/product/spplist/${state}`,
        { 'X-eBirdApiToken': EBIRD_KEY },
      );
      codes.forEach(c => allCodes.add(c));
      process.stdout.write(`  ${state}: ${codes.length} (total unique: ${allCodes.size})\r`);
    } catch (e) {
      console.warn(`\n  Warning: species list failed for ${state}: ${e.message}`);
    }
    await sleep(DELAY_MS);
  }
  console.log(`\nUnique North American species: ${allCodes.size}`);

  // 3. Download S&T CSV per species; accumulate max abundance per state
  const stateMap = new Map();
  const codes = [...allCodes];
  let processed = 0;
  let failed = 0;

  console.log(`Downloading S&T abundance data for ${codes.length} species...`);
  for (const code of codes) {
    processed++;
    if (processed % 100 === 0) {
      console.log(`  ${processed}/${codes.length} (${failed} failed)`);
      saveCache(nameMap, stateMap); // checkpoint every 100 species
    }

    try {
      const res = await fetch(
        `https://st-download.ebird.org/v1/fetch?objKey=2023/${code}/regional_stats.csv&key=${ST_KEY}`,
      );
      if (!res.ok) { failed++; await sleep(DELAY_MS); continue; }

      const rows = parseCSV(await res.text());
      for (const row of rows) {
        if (row.region_type !== 'subnational1' && row.region_type !== 'state') continue;
        const raw = row.region_code ?? '';
        let stateCode;
        if (raw.startsWith('USA-')) stateCode = raw;
        else if (raw.startsWith('US-')) stateCode = 'USA-' + raw.slice(3);
        else continue;

        const abundance = parseFloat(row.abundance_mean);
        if (!isFinite(abundance) || abundance <= 0) continue;

        if (!stateMap.has(stateCode)) stateMap.set(stateCode, new Map());
        const prev = stateMap.get(stateCode).get(code) ?? 0;
        if (abundance > prev) stateMap.get(stateCode).set(code, abundance);
      }
    } catch {
      failed++;
    }
    await sleep(DELAY_MS);
  }
  console.log(`\nDownload complete. States with data: ${stateMap.size}`);

  saveCache(nameMap, stateMap);
  return { nameMap, stateMap };
}

async function main() {
  let nameMap, stateMap;

  if (!FRESH && existsSync(CACHE_PATH)) {
    console.log('Found seed-cache.json — skipping download phase. Use --fresh to re-download.');
    ({ nameMap, stateMap } = loadCache());
  } else {
    if (FRESH) console.log('--fresh flag set, ignoring cache.');
    ({ nameMap, stateMap } = await download());
  }

  if (stateMap.size === 0) {
    console.error('\nNo state data collected. Check your EBIRD_ST_KEY and re-run.');
    process.exit(1);
  }

  // Write state docs
  console.log('\nWriting commonBirds state docs...');
  for (const [regionCode, speciesAbundance] of stateMap) {
    const species = [...speciesAbundance.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, SPECIES_PER_STATE)
      .filter(([code]) => nameMap.has(code))
      .map(([speciesCode, abundance]) => ({ speciesCode, abundance }));

    await db.collection('commonBirds').doc(regionCode).set({ updatedAt: new Date(), species });
    console.log(`  ${regionCode}: ${species.length} species`);
  }

  // Write central taxonomy doc
  console.log('Writing species/taxonomy doc...');
  const usedCodes = new Set([...stateMap.values()].flatMap(m => [...m.keys()]));
  const taxonomyDoc = {};
  for (const code of usedCodes) {
    if (nameMap.has(code)) taxonomyDoc[code] = nameMap.get(code);
  }
  await db.collection('species').doc('taxonomy').set(taxonomyDoc);
  console.log(`  species/taxonomy: ${Object.keys(taxonomyDoc).length} entries`);

  console.log('\nDone!');
}

main().catch(err => { console.error(err); process.exit(1); });
