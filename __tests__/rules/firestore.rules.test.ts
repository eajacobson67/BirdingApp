/**
 * Permission matrix for firestore.rules, executed against the Firestore emulator.
 *
 * These run the REAL rules against REAL queries. Mocked Firestore tests cannot
 * catch rule violations, because a mock returns whatever it is told to return —
 * the rules never execute. Every permission bug this app has hit is only
 * reachable from here.
 *
 * Run with: npm run test:rules   (starts the emulator for you)
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  type Firestore,
} from 'firebase/firestore';

const ALICE = 'alice_uid';
const BOB = 'bob_uid';
const CAROL = 'carol_uid';

let testEnv: RulesTestEnvironment;

const asAlice = () => testEnv.authenticatedContext(ALICE).firestore() as unknown as Firestore;
const asBob = () => testEnv.authenticatedContext(BOB).firestore() as unknown as Firestore;
const asAnon = () => testEnv.unauthenticatedContext().firestore() as unknown as Firestore;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'birdapp-rules-test',
    firestore: {
      rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    await setDoc(doc(db, 'sightings/pub1'), {
      userId: ALICE,
      commonName: 'Cedar Waxwing',
      isPublic: true,
      timestamp: new Date('2026-01-01'),
    });
    await setDoc(doc(db, 'sightings/pub2'), {
      userId: ALICE,
      commonName: 'Blue Jay',
      isPublic: true,
      timestamp: new Date('2026-01-02'),
    });
    await setDoc(doc(db, 'sightings/priv1'), {
      userId: ALICE,
      commonName: 'Inca Tern',
      isPublic: false,
      timestamp: new Date('2026-01-03'),
    });

    await setDoc(doc(db, 'users', ALICE), { username: 'alice', totalSpecies: 3 });
    await setDoc(doc(db, 'users', BOB), { username: 'bob', totalSpecies: 1 });
    await setDoc(doc(db, 'users', ALICE, 'pushTokens', 't1'), { token: 'abc' });
    await setDoc(doc(db, 'users', ALICE, 'pendingInvites', 'lg1'), { status: 'pending' });

    await setDoc(doc(db, 'friendships', ALICE, 'connections', BOB), {
      status: 'accepted',
      direction: 'sent',
    });

    await setDoc(doc(db, 'leagues/lg1'), {
      name: 'Spring Sprint',
      createdBy: ALICE,
      isPublic: true,
      status: 'lobby',
    });
    await setDoc(doc(db, 'leagues/lg1/members', ALICE), { points: 10 });
  });
});

// ── sightings ────────────────────────────────────────────────────────────────
describe('sightings: document reads', () => {
  test('owner can read their own private sighting', async () => {
    await assertSucceeds(getDoc(doc(asAlice(), 'sightings/priv1')));
  });

  test('another user CANNOT read a private sighting', async () => {
    await assertFails(getDoc(doc(asBob(), 'sightings/priv1')));
  });

  test('another user can read a public sighting', async () => {
    await assertSucceeds(getDoc(doc(asBob(), 'sightings/pub1')));
  });

  test('anonymous users are denied entirely', async () => {
    await assertFails(getDoc(doc(asAnon(), 'sightings/pub1')));
  });
});

describe('sightings: queries (rules are not filters)', () => {
  /**
   * REGRESSION: this is the exact bug that shipped. A query is permitted only if
   * its constraints PROVE every possible match is readable. Filtering by userId
   * alone does not prove isPublic, so Firestore rejects the whole query rather
   * than dropping unreadable documents.
   */
  test('querying another user without an isPublic filter is DENIED', async () => {
    const q = query(
      collection(asBob(), 'sightings'),
      where('userId', '==', ALICE),
      orderBy('timestamp', 'desc'),
      limit(20),
    );
    await assertFails(getDocs(q));
  });

  test('querying another user WITH an isPublic filter is allowed', async () => {
    const q = query(
      collection(asBob(), 'sightings'),
      where('userId', '==', ALICE),
      where('isPublic', '==', true),
      orderBy('timestamp', 'desc'),
      limit(20),
    );
    const snap = await assertSucceeds(getDocs(q));
    expect(snap.docs).toHaveLength(2);
    expect(snap.docs.map((d) => d.id).sort()).toEqual(['pub1', 'pub2']);
  });

  test('owner querying their own sightings needs no isPublic filter', async () => {
    const q = query(
      collection(asAlice(), 'sightings'),
      where('userId', '==', ALICE),
      orderBy('timestamp', 'desc'),
      limit(20),
    );
    const snap = await assertSucceeds(getDocs(q));
    expect(snap.docs).toHaveLength(3); // includes the private one
  });

  test('public feed query is allowed and excludes private sightings', async () => {
    const q = query(
      collection(asBob(), 'sightings'),
      where('isPublic', '==', true),
      orderBy('timestamp', 'desc'),
      limit(200),
    );
    const snap = await assertSucceeds(getDocs(q));
    expect(snap.docs.every((d) => d.data().isPublic === true)).toBe(true);
  });

  test('friend-feed "in" query without isPublic is DENIED', async () => {
    const q = query(
      collection(asBob(), 'sightings'),
      where('userId', 'in', [ALICE]),
      orderBy('timestamp', 'desc'),
      limit(50),
    );
    await assertFails(getDocs(q));
  });

  test('friend-feed "in" query WITH isPublic is allowed', async () => {
    const q = query(
      collection(asBob(), 'sightings'),
      where('userId', 'in', [ALICE]),
      where('isPublic', '==', true),
      orderBy('timestamp', 'desc'),
      limit(50),
    );
    await assertSucceeds(getDocs(q));
  });

  test('an unbounded collection scan is DENIED', async () => {
    await assertFails(getDocs(collection(asBob(), 'sightings')));
  });
});

describe('sightings: writes', () => {
  test('a user can create a sighting owned by themselves', async () => {
    await assertSucceeds(
      setDoc(doc(asBob(), 'sightings/new1'), {
        userId: BOB,
        commonName: 'American Robin',
        isPublic: true,
        timestamp: new Date(),
      }),
    );
  });

  test('a user CANNOT create a sighting attributed to someone else', async () => {
    await assertFails(
      setDoc(doc(asBob(), 'sightings/forged'), {
        userId: ALICE,
        commonName: 'Forged',
        isPublic: true,
        timestamp: new Date(),
      }),
    );
  });

  test('a user CANNOT update another user\'s sighting', async () => {
    await assertFails(setDoc(doc(asBob(), 'sightings/pub1'), { commonName: 'Hacked' }));
  });

  test('a user CANNOT delete another user\'s sighting', async () => {
    await assertFails(deleteDoc(doc(asBob(), 'sightings/pub1')));
  });

  test('owner can delete their own sighting', async () => {
    await assertSucceeds(deleteDoc(doc(asAlice(), 'sightings/pub1')));
  });
});

// ── users ────────────────────────────────────────────────────────────────────
describe('users', () => {
  test('any signed-in user can read any profile', async () => {
    await assertSucceeds(getDoc(doc(asBob(), 'users', ALICE)));
  });

  test('anonymous cannot read profiles', async () => {
    await assertFails(getDoc(doc(asAnon(), 'users', ALICE)));
  });

  test('a user CANNOT write another user\'s profile', async () => {
    await assertFails(setDoc(doc(asBob(), 'users', ALICE), { username: 'stolen' }));
  });

  test('a user can write their own profile', async () => {
    await assertSucceeds(setDoc(doc(asBob(), 'users', BOB), { username: 'bob2', totalSpecies: 2 }));
  });

  test('push tokens are private to their owner', async () => {
    await assertFails(getDoc(doc(asBob(), 'users', ALICE, 'pushTokens', 't1')));
    await assertSucceeds(getDoc(doc(asAlice(), 'users', ALICE, 'pushTokens', 't1')));
  });

  test('pendingInvites readable only by owner, writable by anyone (invite flow)', async () => {
    await assertFails(getDoc(doc(asBob(), 'users', ALICE, 'pendingInvites', 'lg1')));
    await assertSucceeds(getDoc(doc(asAlice(), 'users', ALICE, 'pendingInvites', 'lg1')));
    // Intentionally permissive: a league owner must be able to push an invite.
    await assertSucceeds(
      setDoc(doc(asBob(), 'users', ALICE, 'pendingInvites', 'lg2'), { status: 'pending' }),
    );
  });
});

// ── friendships ──────────────────────────────────────────────────────────────
describe('friendships', () => {
  test('a user can read their own connections', async () => {
    await assertSucceeds(getDoc(doc(asAlice(), 'friendships', ALICE, 'connections', BOB)));
  });

  test('a user CANNOT read another user\'s connections', async () => {
    await assertFails(getDoc(doc(asBob(), 'friendships', ALICE, 'connections', BOB)));
  });

  test('getConnectionStatus reads the caller\'s own subtree (allowed)', async () => {
    await assertSucceeds(getDoc(doc(asBob(), 'friendships', BOB, 'connections', ALICE)));
  });

  /**
   * REGRESSION: sendFriendRequest writes BOTH sides. The mirror write must be
   * permitted or the recipient never sees the request — and because the writes
   * were not batched, the sender's side landed while the mirror was denied,
   * leaving a one-sided friendship.
   */
  test('a user CAN write the document representing themselves in another user\'s list', async () => {
    await assertSucceeds(
      setDoc(doc(asBob(), 'friendships', ALICE, 'connections', BOB), {
        status: 'pending',
        direction: 'received',
      }),
    );
  });

  test('a user CANNOT write a document representing someone else', async () => {
    await assertFails(
      setDoc(doc(asBob(), 'friendships', ALICE, 'connections', CAROL), {
        status: 'accepted',
      }),
    );
  });

  test('a user CANNOT forge an arbitrary status on the mirror side', async () => {
    await assertFails(
      setDoc(doc(asBob(), 'friendships', ALICE, 'connections', BOB), { status: 'blocked' }),
    );
  });

  test('a user can delete themselves from another user\'s list (unfriend mirror)', async () => {
    await assertSucceeds(deleteDoc(doc(asBob(), 'friendships', ALICE, 'connections', BOB)));
  });

  test('a user CANNOT delete a third party from someone else\'s list', async () => {
    await assertFails(deleteDoc(doc(asBob(), 'friendships', ALICE, 'connections', CAROL)));
  });

  test('accepted-friends query is allowed within own subtree', async () => {
    const q = query(
      collection(asAlice(), 'friendships', ALICE, 'connections'),
      where('status', '==', 'accepted'),
    );
    await assertSucceeds(getDocs(q));
  });

  test('pending-received query is allowed within own subtree', async () => {
    const q = query(
      collection(asAlice(), 'friendships', ALICE, 'connections'),
      where('status', '==', 'pending'),
      where('direction', '==', 'received'),
    );
    await assertSucceeds(getDocs(q));
  });
});

// ── leagues ──────────────────────────────────────────────────────────────────
describe('leagues', () => {
  test('any signed-in user can read a league', async () => {
    await assertSucceeds(getDoc(doc(asBob(), 'leagues/lg1')));
  });

  test('anonymous cannot read leagues', async () => {
    await assertFails(getDoc(doc(asAnon(), 'leagues/lg1')));
  });

  test('public-league discovery query is allowed', async () => {
    const q = query(
      collection(asBob(), 'leagues'),
      where('isPublic', '==', true),
      where('status', 'in', ['lobby', 'upcoming']),
      limit(30),
    );
    await assertSucceeds(getDocs(q));
  });

  test('leaderboard ordering query is allowed', async () => {
    const q = query(collection(asBob(), 'leagues/lg1/members'), orderBy('points', 'desc'));
    await assertSucceeds(getDocs(q));
  });

  test('a non-owner CANNOT change league settings', async () => {
    await assertFails(updateDoc(doc(asBob(), 'leagues/lg1'), { name: 'Renamed by Bob' }));
  });

  test('a non-owner CANNOT start a league', async () => {
    await assertFails(updateDoc(doc(asBob(), 'leagues/lg1'), { status: 'active' }));
  });

  test('the owner can change league settings', async () => {
    await assertSucceeds(updateDoc(doc(asAlice(), 'leagues/lg1'), { name: 'Renamed by Alice' }));
  });

  test('a joining user may bump memberCount and nothing else', async () => {
    await assertSucceeds(updateDoc(doc(asBob(), 'leagues/lg1'), { memberCount: 2 }));
    await assertFails(
      updateDoc(doc(asBob(), 'leagues/lg1'), { memberCount: 2, name: 'sneaky' }),
    );
  });

  test('a league must be created under the creator\'s own uid', async () => {
    await assertFails(
      setDoc(doc(asBob(), 'leagues/forged'), { name: 'x', createdBy: ALICE, status: 'lobby' }),
    );
    await assertSucceeds(
      setDoc(doc(asBob(), 'leagues/mine'), { name: 'x', createdBy: BOB, status: 'lobby' }),
    );
  });

  test('a user CANNOT overwrite another member\'s score', async () => {
    await assertFails(setDoc(doc(asBob(), 'leagues/lg1/members', ALICE), { points: 9999 }));
  });

  test('a user can write their own member row (join and scoring)', async () => {
    await assertSucceeds(
      setDoc(doc(asBob(), 'leagues/lg1/members', BOB), { userId: BOB, points: 0 }),
    );
  });

  test('the league scoring log is append-only', async () => {
    await assertSucceeds(
      setDoc(doc(asBob(), 'leagues/lg1/sightings/s1'), { userId: BOB, points: 5 }),
    );
    await assertFails(
      setDoc(doc(asBob(), 'leagues/lg1/sightings/s1'), { userId: BOB, points: 500 }),
    );
    await assertFails(deleteDoc(doc(asBob(), 'leagues/lg1/sightings/s1')));
  });

  test('a scoring log entry cannot be attributed to someone else', async () => {
    await assertFails(
      setDoc(doc(asBob(), 'leagues/lg1/sightings/s2'), { userId: ALICE, points: 5 }),
    );
  });

  test('clients cannot write the daily target list', async () => {
    await assertFails(
      setDoc(doc(asBob(), 'leagues/lg1/targetBirds/2026-01-01'), { species: ['Blue Jay'] }),
    );
  });

  test('a non-member CANNOT send league invites', async () => {
    await assertFails(
      setDoc(doc(asBob(), 'leagues/lg1/invites', CAROL), { status: 'pending' }),
    );
  });

  test('a member CAN send league invites', async () => {
    await assertSucceeds(
      setDoc(doc(asAlice(), 'leagues/lg1/invites', CAROL), { status: 'pending' }),
    );
  });
});

describe('admin escalation', () => {
  /**
   * promoteToAdmin() writes users/{uid}.isAdmin. The users rule lets a user
   * update their own document, so without an explicit field guard any user
   * could grant themselves admin and then edit every league.
   */
  test('a user CANNOT grant themselves admin', async () => {
    await assertFails(updateDoc(doc(asBob(), 'users', BOB), { isAdmin: true }));
  });

  test('a user CANNOT create their profile with admin already set', async () => {
    await assertFails(
      setDoc(doc(testEnv.authenticatedContext(CAROL).firestore() as unknown as Firestore, 'users', CAROL), {
        username: 'carol',
        isAdmin: true,
      }),
    );
  });

  test('ordinary profile updates still work', async () => {
    await assertSucceeds(updateDoc(doc(asBob(), 'users', BOB), { totalSpecies: 5 }));
  });
});
