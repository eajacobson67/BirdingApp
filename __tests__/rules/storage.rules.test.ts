/**
 * Permission matrix for storage.rules, executed against the Storage emulator.
 *
 * The app writes exactly two prefixes:
 *   photos/{uid}/{ts}.jpg   — app/log/camera.tsx, app/log/confirm.tsx
 *   audio/{uid}/{ts}.m4a    — app/log/audio.tsx
 *
 * Anything outside those must be denied.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes, deleteObject, type FirebaseStorage } from 'firebase/storage';

const ALICE = 'alice_uid';
const BOB = 'bob_uid';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const M4A = new Uint8Array([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]);

let testEnv: RulesTestEnvironment;

const asAlice = () => testEnv.authenticatedContext(ALICE).storage() as unknown as FirebaseStorage;
const asBob = () => testEnv.authenticatedContext(BOB).storage() as unknown as FirebaseStorage;
const asAnon = () => testEnv.unauthenticatedContext().storage() as unknown as FirebaseStorage;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'birdapp-rules-test',
    storage: {
      rules: readFileSync(resolve(__dirname, '../../storage.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 9199,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearStorage();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const s = ctx.storage() as unknown as FirebaseStorage;
    await uploadBytes(ref(s, `photos/${ALICE}/existing.jpg`), JPEG, { contentType: 'image/jpeg' });
  });
});

describe('storage: photo uploads', () => {
  /**
   * REGRESSION: this is the storage/unauthorized failure seen on the log-photo
   * flow. If storage.rules is missing or still default-deny, this fails.
   */
  test('a user can upload into their own photos folder', async () => {
    await assertSucceeds(
      uploadBytes(ref(asAlice(), `photos/${ALICE}/${Date.now()}.jpg`), JPEG, {
        contentType: 'image/jpeg',
      }),
    );
  });

  test('a user CANNOT upload into another user\'s photos folder', async () => {
    await assertFails(
      uploadBytes(ref(asBob(), `photos/${ALICE}/evil.jpg`), JPEG, { contentType: 'image/jpeg' }),
    );
  });

  test('anonymous users cannot upload', async () => {
    await assertFails(
      uploadBytes(ref(asAnon(), `photos/${ALICE}/anon.jpg`), JPEG, { contentType: 'image/jpeg' }),
    );
  });

  test('non-image content types are rejected', async () => {
    await assertFails(
      uploadBytes(ref(asAlice(), `photos/${ALICE}/payload.exe`), JPEG, {
        contentType: 'application/x-msdownload',
      }),
    );
  });
});

describe('storage: photo reads', () => {
  test('any signed-in user can read a photo (feed and map pins)', async () => {
    await assertSucceeds(getBytes(ref(asBob(), `photos/${ALICE}/existing.jpg`)));
  });

  test('anonymous users cannot read photos', async () => {
    await assertFails(getBytes(ref(asAnon(), `photos/${ALICE}/existing.jpg`)));
  });
});

describe('storage: photo deletes', () => {
  test('owner can delete their own photo', async () => {
    await assertSucceeds(deleteObject(ref(asAlice(), `photos/${ALICE}/existing.jpg`)));
  });

  test('another user cannot delete it', async () => {
    await assertFails(deleteObject(ref(asBob(), `photos/${ALICE}/existing.jpg`)));
  });
});

describe('storage: audio uploads', () => {
  test('a user can upload their own recording', async () => {
    await assertSucceeds(
      uploadBytes(ref(asAlice(), `audio/${ALICE}/${Date.now()}.m4a`), M4A, {
        contentType: 'audio/m4a',
      }),
    );
  });

  test('a user CANNOT upload into another user\'s audio folder', async () => {
    await assertFails(
      uploadBytes(ref(asBob(), `audio/${ALICE}/evil.m4a`), M4A, { contentType: 'audio/m4a' }),
    );
  });

  test('non-audio content types are rejected', async () => {
    await assertFails(
      uploadBytes(ref(asAlice(), `audio/${ALICE}/x.m4a`), M4A, { contentType: 'image/jpeg' }),
    );
  });
});

describe('storage: everything else is denied', () => {
  test('an unrecognised prefix cannot be written', async () => {
    await assertFails(
      uploadBytes(ref(asAlice(), `arbitrary/${ALICE}/file.bin`), JPEG, {
        contentType: 'image/jpeg',
      }),
    );
  });

  test('the bucket root cannot be written', async () => {
    await assertFails(
      uploadBytes(ref(asAlice(), 'root.jpg'), JPEG, { contentType: 'image/jpeg' }),
    );
  });
});
