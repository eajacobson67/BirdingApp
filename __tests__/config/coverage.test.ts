/**
 * Coverage guards. These are the tests that stop permission bugs being found
 * one screen at a time: they enumerate what the app actually touches and assert
 * the rules and indexes keep up. Adding a new collection or a new composite
 * query without covering it will fail here rather than on a user's phone.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { extract } = require('../../scripts/extract-firebase-usage.js');

const ROOT = resolve(__dirname, '../..');
const firestoreRules = readFileSync(resolve(ROOT, 'firestore.rules'), 'utf8');
const storageRules = readFileSync(resolve(ROOT, 'storage.rules'), 'utf8');
const indexes = JSON.parse(readFileSync(resolve(ROOT, 'firestore.indexes.json'), 'utf8'));

interface QueryShape {
  file: string;
  collectionId: string;
  equality: string[];
  ranges: string[];
  order: { field: string; direction: string }[];
  needsIndex: boolean;
}

const usage = extract();

describe('firestore rule coverage', () => {
  test('the extractor found the app source', () => {
    expect(usage.filesScanned).toBeGreaterThan(20);
    expect(usage.collections.length).toBeGreaterThan(0);
  });

  for (const name of usage.collections as string[]) {
    test(`top-level collection "${name}" has a rule`, () => {
      expect(firestoreRules).toMatch(new RegExp(`match /${name}/`));
    });
  }

  for (const name of usage.subcollections as string[]) {
    test(`subcollection "${name}" has a rule`, () => {
      // Subcollections may sit at any depth, e.g. /friendships/{uid}/connections/{id}
      expect(firestoreRules).toMatch(new RegExp(`match /[^\\n]*\\b${name}/`));
    });
  }

  test('rules do not contain a blanket allow-all', () => {
    const normalised = firestoreRules.replace(/\s+/g, ' ');
    expect(normalised).not.toMatch(/match \/\{document=\*\*\} \{ allow read, write: if true/);
    expect(normalised).not.toMatch(/allow read, write: if true;/);
  });

  test('rules have not been left in open test mode', () => {
    // The console's "test mode" default expires on a date and allows everything.
    expect(firestoreRules).not.toMatch(/request\.time\s*<\s*timestamp\.date/);
  });
});

describe('storage rule coverage', () => {
  for (const prefix of usage.storagePrefixes as string[]) {
    test(`storage prefix "${prefix}" has a rule`, () => {
      expect(storageRules).toMatch(new RegExp(`match /${prefix}/`));
    });
  }

  test('storage has a catch-all deny', () => {
    expect(storageRules.replace(/\s+/g, ' ')).toMatch(
      /match \/\{allPaths=\*\*\} \{ allow read, write: if false/,
    );
  });

  test('storage uploads are size-capped', () => {
    expect(storageRules).toMatch(/request\.resource\.size\s*</);
  });
});

describe('composite index coverage', () => {
  const needing = usage.queryShapes.filter((s: { needsIndex: boolean }) => s.needsIndex);

  test('at least one query was detected as needing an index', () => {
    expect(needing.length).toBeGreaterThan(0);
  });

  for (const shape of needing as QueryShape[]) {
    test(`${shape.file} :: "${shape.collectionId}" [${shape.equality.join(',')}] has an index`, () => {
      const required = [
        ...shape.equality,
        ...shape.ranges,
        ...shape.order.map((o) => o.field),
      ];

      const match = indexes.indexes.find(
        (idx: { collectionGroup: string; fields: { fieldPath: string }[] }) => {
          if (idx.collectionGroup !== shape.collectionId) return false;
          const paths = idx.fields.map((f) => f.fieldPath);
          return required.every((f) => paths.includes(f));
        },
      );

      expect(match).toBeDefined();
    });
  }
});

describe('google maps configuration', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const appConfig = require('../../app.config.js').default ?? require('../../app.config.js');
  const expo = appConfig.expo;

  test('android declares a google maps api key binding', () => {
    expect(expo.android?.config?.googleMaps).toBeDefined();
  });

  /**
   * The map renders as a blank grey tile if this is unset at BUILD time, with
   * no runtime error anywhere. Prebuild bakes the value into the manifest, so
   * an unset key is only detectable here or by looking at the screen.
   */
  test('GOOGLE_MAPS_API_KEY resolves to a non-empty value', () => {
    const key = expo.android.config.googleMaps.apiKey;
    expect(key).toBeTruthy();
    expect(String(key).length).toBeGreaterThan(20);
  });

  test('the maps key is not a placeholder', () => {
    const key = String(expo.android.config.googleMaps.apiKey ?? '');
    expect(key).not.toMatch(/YOUR_|PLACEHOLDER|CHANGEME|xxxx/i);
  });

  test('the maps key is not hardcoded in app.config.js', () => {
    const raw = readFileSync(resolve(ROOT, 'app.config.js'), 'utf8');
    expect(raw).toMatch(/process\.env\.GOOGLE_MAPS_API_KEY/);
    expect(raw).not.toMatch(/apiKey:\s*['"]AIza/);
  });
});

describe('play store release readiness', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const appConfig = require('../../app.config.js').default ?? require('../../app.config.js');
  const expo = appConfig.expo;

  test('android package id is set and not an example', () => {
    expect(expo.android.package).toBeTruthy();
    expect(expo.android.package).not.toMatch(/example|test|changeme/i);
  });

  test('an explicit versionCode is declared', () => {
    // Play rejects a reused versionCode. Leaving it implicit means prebuild
    // regenerates 1 every time and uploads silently collide.
    expect(expo.android.versionCode).toBeDefined();
    expect(typeof expo.android.versionCode).toBe('number');
  });

  test('version is a valid semver string', () => {
    expect(expo.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('no duplicate android permissions', () => {
    const perms: string[] = expo.android.permissions;
    const normalised = perms.map((p) => p.replace(/^android\.permission\./, ''));
    expect(new Set(normalised).size).toBe(normalised.length);
  });

  test('every declared permission is one the app actually uses', () => {
    const perms: string[] = expo.android.permissions.map((p: string) =>
      p.replace(/^android\.permission\./, ''),
    );
    const allowed = new Set([
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'RECORD_AUDIO',
      'MODIFY_AUDIO_SETTINGS',
      'CAMERA',
      'READ_MEDIA_IMAGES',
      'READ_EXTERNAL_STORAGE',
    ]);
    for (const p of perms) expect(allowed.has(p)).toBe(true);
  });
});

/**
 * Play submission blockers that are invisible from the running app.
 *
 * Each of these was a real reason the first upload would have been rejected or
 * silently mis-signed. They are asserted here because none of them fail at
 * runtime — a debug-signed AAB builds fine, and a missing privacy policy only
 * surfaces in review, days later.
 */
describe('play store submission blockers', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const appConfig = require('../../app.config.js').default ?? require('../../app.config.js');
  const plugins: unknown[] = appConfig.expo.plugins;
  const pluginNames = plugins.map((p) => (Array.isArray(p) ? p[0] : p));

  test('release builds are signed by the upload keystore plugin', () => {
    // Without this, android/app/build.gradle keeps the react-native template's
    // `signingConfig signingConfigs.debug` for release and Play rejects the AAB.
    expect(pluginNames).toContain('./plugins/withReleaseSigning');
  });

  test('the manifest cleanup plugin is registered', () => {
    expect(pluginNames).toContain('./plugins/withManifestCleanup');
  });

  test('the signing plugin fails the build when credentials are missing', () => {
    const src = readFileSync(resolve(ROOT, 'plugins/withReleaseSigning.js'), 'utf8');
    expect(src).toMatch(/throw new GradleException/);
    expect(src).toMatch(/BIRDAPP_UPLOAD_STORE_FILE/);
  });

  test('no keystore or signing password is committed to the repo', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { execSync } = require('child_process');
    const tracked = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }).split('\n');
    const secrets = tracked.filter((f: string) =>
      /\.(jks|keystore|p12)$/.test(f) && !f.endsWith('debug.keystore'),
    );
    expect(secrets).toEqual([]);
  });

  test('expo-dev-client is not a production dependency', () => {
    // It merges SYSTEM_ALERT_WINDOW into the manifest, which Play asks a
    // developer to justify in writing.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('../../package.json');
    expect(pkg.dependencies['expo-dev-client']).toBeUndefined();
    expect(pkg.devDependencies['expo-dev-client']).toBeDefined();
  });
});

describe('data deletion and privacy disclosures', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PRIVACY_POLICY, DELETION_NOTICE } = require('../../lib/legal');

  test('an in-app privacy policy screen exists and is routed', () => {
    const layout = readFileSync(resolve(ROOT, 'app/_layout.tsx'), 'utf8');
    expect(layout).toMatch(/name="legal\/privacy"/);
  });

  test('an in-app account deletion screen exists and is routed', () => {
    const layout = readFileSync(resolve(ROOT, 'app/_layout.tsx'), 'utf8');
    expect(layout).toMatch(/name="settings\/delete-account"/);
  });

  test('the profile screen links to both', () => {
    const profile = readFileSync(resolve(ROOT, 'app/(tabs)/profile.tsx'), 'utf8');
    expect(profile).toMatch(/\/legal\/privacy/);
    expect(profile).toMatch(/\/settings\/delete-account/);
  });

  test('the policy names every category of data the app collects', () => {
    const text = JSON.stringify(PRIVACY_POLICY).toLowerCase();
    for (const topic of ['location', 'camera', 'microphone', 'photo', 'email', 'notification']) {
      expect(text).toContain(topic);
    }
  });

  test('the policy states that sightings are public by default', () => {
    expect(JSON.stringify(PRIVACY_POLICY)).toMatch(/public by default/i);
  });

  /**
   * Play compares the hosted policy against the app. docs/ is generated from
   * lib/legal.ts by `npm run legal:html`; if a heading is missing here, the two
   * have drifted and the hosted copy is stale.
   */
  test('the hosted pages are regenerated from lib/legal.ts', () => {
    const privacy = readFileSync(resolve(ROOT, 'docs/privacy.html'), 'utf8');
    for (const section of PRIVACY_POLICY) {
      expect(privacy).toContain(section.heading);
    }
    const deletion = readFileSync(resolve(ROOT, 'docs/delete-account.html'), 'utf8');
    for (const section of DELETION_NOTICE) {
      expect(deletion).toContain(section.heading);
    }
  });

  test('deletion removes every collection the account owns', () => {
    const account = readFileSync(resolve(ROOT, 'lib/firestore/account.ts'), 'utf8');
    for (const path of ['sightings', 'friendships', 'leagueMemberships', 'pushTokens', 'users']) {
      expect(account).toContain(`'${path}'`);
    }
    // Uploaded media is not reachable by listAll() under the storage rules, so
    // it has to be deleted by the URL recorded on each sighting.
    expect(account).toMatch(/deleteObject/);
    expect(account).toMatch(/photoURL/);
    expect(account).toMatch(/audioURL/);
  });
});

describe('dev/prod Firebase project separation', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { execSync } = require('child_process');

  function parseEnvFile(path: string): Record<string, string> {
    const out: Record<string, string> = {};
    // Lines are trimmed before matching because git rewrites these files with
    // CRLF on checkout under core.autocrlf. A trailing \r is unmatchable by
    // /(.*)$/ in JS — `.` excludes \r and `$` wants true end-of-string — so
    // matching the raw line parsed zero keys and failed the assertions below
    // as though the config were missing.
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.trim().match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    }
    return out;
  }

  test('lib/firebase.ts reads its config from env vars, not hardcoded literals', () => {
    // REGRESSION: this file used to hardcode the prod project's config directly,
    // which is what made it impossible to point local dev anywhere else.
    const src = readFileSync(resolve(ROOT, 'lib/firebase.ts'), 'utf8');
    expect(src).toMatch(/process\.env\.EXPO_PUBLIC_FIREBASE_PROJECT_ID/);
    expect(src).not.toMatch(/projectId:\s*["']birding-app-1a446["']/);
    expect(src).not.toMatch(/apiKey:\s*["']AIza/);
  });

  test('.env.development and .env.production point at different Firebase projects', () => {
    const dev = parseEnvFile(resolve(ROOT, '.env.development'));
    const prod = parseEnvFile(resolve(ROOT, '.env.production'));
    expect(dev.EXPO_PUBLIC_FIREBASE_PROJECT_ID).toBeTruthy();
    expect(prod.EXPO_PUBLIC_FIREBASE_PROJECT_ID).toBeTruthy();
    expect(dev.EXPO_PUBLIC_FIREBASE_PROJECT_ID).not.toBe(prod.EXPO_PUBLIC_FIREBASE_PROJECT_ID);
  });

  test('.firebaserc has explicit dev and prod aliases, and default stays prod', () => {
    const rc = JSON.parse(readFileSync(resolve(ROOT, '.firebaserc'), 'utf8'));
    expect(rc.projects.dev).toBeTruthy();
    expect(rc.projects.prod).toBeTruthy();
    expect(rc.projects.dev).not.toBe(rc.projects.prod);
    // A bare `firebase deploy` (no --project flag) must keep hitting the same
    // project it always has — changing this silently would be a production
    // rules deploy landing on the wrong project.
    expect(rc.projects.default).toBe(rc.projects.prod);
  });

  test('seed scripts refuse to run against the production project', () => {
    const guard = readFileSync(resolve(ROOT, 'scripts/lib/adminApp.mjs'), 'utf8');
    expect(guard).toMatch(/birding-app-1a446/);
    expect(guard).toMatch(/process\.exit\(1\)/);

    // Every script that writes with firebase-admin (full-access, rules bypassed)
    // must route through the guard rather than calling initializeApp() directly.
    const seedScripts = [
      'scripts/seed-birds.mjs',
      'scripts/seed-users.mjs',
      'scripts/seed-my-sightings.mjs',
      'scripts/seed-test.mjs',
      'scripts/test-seed.mjs',
    ];
    for (const script of seedScripts) {
      const src = readFileSync(resolve(ROOT, script), 'utf8');
      expect(src).toMatch(/initAdminApp\(\)/);
      expect(src).not.toMatch(/^\s*initializeApp\(\);/m);
    }
  });

  test('no Firebase service account key is committed to the repo', () => {
    const tracked = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }).split('\n');
    const keys = tracked.filter((f: string) => /adminsdk.*\.json$|serviceAccountKey.*\.json$/i.test(f));
    expect(keys).toEqual([]);
  });
});
