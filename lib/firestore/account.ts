import {
  collection,
  doc,
  deleteDoc,
  getDocs,
  query,
  where,
  writeBatch,
  increment,
  updateDoc,
} from 'firebase/firestore';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
  type User,
} from 'firebase/auth';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';

/**
 * Account deletion.
 *
 * Play requires an in-app path that removes the account and its data, so this
 * runs entirely client-side under the caller's own credentials — every write
 * below is one the security rules already permit the owner to make.
 *
 * Ordering matters: the user document and the auth user are destroyed last.
 * Several rules resolve the caller's identity through `users/{uid}` (isAdmin),
 * and once the auth user is gone no further write can be authorised at all, so
 * an early failure leaves a still-usable account rather than an orphan.
 */

const BATCH_LIMIT = 450; // Firestore's cap is 500; leave headroom.

async function commitInChunks(refs: ReturnType<typeof doc>[]) {
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const r of refs.slice(i, i + BATCH_LIMIT)) batch.delete(r);
    await batch.commit();
  }
}

/**
 * Storage objects are addressed by their download URL because the rules do not
 * grant `list` on `photos/{uid}` — only per-object access — so listAll() is
 * denied. The URLs recorded on each sighting are the only handle we have.
 */
async function deleteStoredFile(url: string | null) {
  if (!url) return;
  try {
    await deleteObject(ref(storage, url));
  } catch {
    // Already gone, or written by an older build under a path the rules no
    // longer cover. Neither should strand the rest of the deletion.
  }
}

async function deleteSightings(uid: string) {
  const snap = await getDocs(query(collection(db, 'sightings'), where('userId', '==', uid)));

  await Promise.all(
    snap.docs.flatMap((d) => {
      const data = d.data();
      return [deleteStoredFile(data.photoURL ?? null), deleteStoredFile(data.audioURL ?? null)];
    }),
  );

  await commitInChunks(snap.docs.map((d) => d.ref));
}

/**
 * Friendships are stored twice — once in each user's list. The mirror row is
 * the deleted user's own entry in someone else's subtree, which the rules allow
 * them to remove; leaving it behind would show a friend a profile that no
 * longer exists.
 */
async function deleteFriendships(uid: string) {
  const snap = await getDocs(collection(db, 'friendships', uid, 'connections'));
  const refs = snap.docs.flatMap((d) => [
    d.ref,
    doc(db, 'friendships', d.id, 'connections', uid),
  ]);
  await commitInChunks(refs);
}

/**
 * Leagues themselves are left standing: they hold other players' scores and are
 * not this user's data to destroy. What goes is the member row (which removes
 * them from every leaderboard) and their own rows in the scoring log.
 */
async function deleteLeagueParticipation(uid: string) {
  const memberships = await getDocs(collection(db, 'users', uid, 'leagueMemberships'));

  for (const m of memberships.docs) {
    const leagueId = m.id;

    const logged = await getDocs(
      query(collection(db, 'leagues', leagueId, 'sightings'), where('userId', '==', uid)),
    );
    await commitInChunks(logged.docs.map((d) => d.ref));

    await deleteDoc(doc(db, 'leagues', leagueId, 'members', uid));

    // memberCount is the one field a non-owner may touch, by rule.
    try {
      await updateDoc(doc(db, 'leagues', leagueId), { memberCount: increment(-1) });
    } catch {
      // League already deleted by its owner.
    }
  }

  await commitInChunks(memberships.docs.map((d) => d.ref));

  const invites = await getDocs(collection(db, 'users', uid, 'pendingInvites'));
  await commitInChunks([
    ...invites.docs.map((d) => d.ref),
    ...invites.docs.map((d) => doc(db, 'leagues', d.id, 'invites', uid)),
  ]);
}

// The path is spelled out rather than parameterised so
// scripts/extract-firebase-usage.js can still see it — the coverage guard only
// matches string literals, and a collection it cannot see is one it cannot
// prove has a rule.
async function deletePushTokens(uid: string) {
  const snap = await getDocs(collection(db, 'users', uid, 'pushTokens'));
  await commitInChunks(snap.docs.map((d) => d.ref));
}

/** Everything except the auth user itself. Exported for the rules tests. */
export async function deleteAccountData(uid: string): Promise<void> {
  await deleteSightings(uid);
  await deleteFriendships(uid);
  await deleteLeagueParticipation(uid);
  await deletePushTokens(uid);
  await deleteDoc(doc(db, 'users', uid));
}

/**
 * Firebase refuses deleteUser() on a session older than roughly five minutes,
 * so the password is collected up front and used to re-authenticate rather than
 * letting the user hit `auth/requires-recent-login` after the data is gone.
 */
export async function deleteAccount(user: User, password: string): Promise<void> {
  if (!user.email) throw new Error('This account has no email address to re-authenticate with.');

  await reauthenticateWithCredential(
    user,
    EmailAuthProvider.credential(user.email, password),
  );

  await deleteAccountData(user.uid);
  await deleteUser(user);
}
