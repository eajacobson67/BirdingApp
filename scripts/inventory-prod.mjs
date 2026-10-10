#!/usr/bin/env node
// One-time read-only inventory of the prod project, to decide what to wipe
// before real users arrive. Does not delete anything.
// node scripts/inventory-prod.mjs
import { readFileSync } from 'fs';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const projectId = JSON.parse(readFileSync(keyPath, 'utf8')).project_id;
console.log(`Inventorying: ${projectId}\n`);

initializeApp();
const db = getFirestore();
const auth = getAuth();

async function count(collPath) {
  const snap = await db.collection(collPath).count().get();
  return snap.data().count;
}

const topLevel = ['users', 'sightings', 'leagues', 'species', 'commonBirds', 'friendships'];
for (const c of topLevel) {
  try {
    console.log(`${c.padEnd(14)} ${await count(c)}`);
  } catch (e) {
    console.log(`${c.padEnd(14)} (error: ${e.message})`);
  }
}

console.log('\n--- sample users (first 20) ---');
const usersSnap = await db.collection('users').limit(20).get();
for (const d of usersSnap.docs) {
  const u = d.data();
  console.log(`  ${d.id}  @${u.username ?? '?'}  "${u.displayName ?? '?'}"  sightings=${u.totalSightings ?? 0} species=${u.totalSpecies ?? 0}`);
}

console.log('\n--- auth users (first 20) ---');
const list = await auth.listUsers(20);
for (const u of list.users) {
  console.log(`  ${u.uid}  ${u.email ?? '(no email)'}  created=${u.metadata.creationTime}`);
}
console.log(`  ... total auth users: ${list.users.length < 20 ? list.users.length : '20+ (truncated)'}`);

console.log('\n--- sample sightings (first 10) ---');
const sightingsSnap = await db.collection('sightings').limit(10).get();
for (const d of sightingsSnap.docs) {
  const s = d.data();
  console.log(`  ${d.id}  userId=${s.userId}  ${s.commonName}  isPublic=${s.isPublic}`);
}

console.log('\n--- leagues ---');
const leaguesSnap = await db.collection('leagues').get();
for (const d of leaguesSnap.docs) {
  const l = d.data();
  console.log(`  ${d.id}  "${l.name}"  createdBy=${l.createdBy}  status=${l.status}`);
}
