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
