// Shared entry point for every seed/admin script in this folder.
//
// These scripts use firebase-admin, which authenticates via whatever service
// account GOOGLE_APPLICATION_CREDENTIALS points at and then bypasses
// firestore.rules / storage.rules entirely. A bare initializeApp() trusts
// that env var blindly — if it's ever left pointing at the prod key (from an
// earlier session, another project, a copy-pasted export command), a seed
// script silently writes fake data straight into the real users' database.
// That is how prod ended up full of test data before the dev project existed.
//
// This reads the key file itself and refuses to run against
// birding-app-1a446, no matter what GOOGLE_APPLICATION_CREDENTIALS says.
import { readFileSync } from 'fs';
import { initializeApp } from 'firebase-admin/app';

const PROD_PROJECT_ID = 'birding-app-1a446';

export function initAdminApp() {
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyPath) {
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS to the dev project\'s service account key.');
    console.error('  C:\\Users\\eajac\\firebase-keys\\birdapp-dev-adminsdk.json');
    process.exit(1);
  }

  let projectId;
  try {
    projectId = JSON.parse(readFileSync(keyPath, 'utf8')).project_id;
  } catch (e) {
    console.error(`Could not read service account key at ${keyPath}: ${e.message}`);
    process.exit(1);
  }

  if (projectId === PROD_PROJECT_ID) {
    console.error('');
    console.error(`REFUSING TO RUN: GOOGLE_APPLICATION_CREDENTIALS points at ${PROD_PROJECT_ID} (production).`);
    console.error('Seed scripts write fake data with admin privileges that bypass every security rule.');
    console.error('Point GOOGLE_APPLICATION_CREDENTIALS at the dev key instead:');
    console.error('  C:\\Users\\eajac\\firebase-keys\\birdapp-dev-adminsdk.json');
    console.error('');
    process.exit(1);
  }

  console.log(`[adminApp] writing to project: ${projectId}`);
  return initializeApp();
}
