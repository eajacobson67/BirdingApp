import {
  collection,
  doc,
  writeBatch,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { getUserProfile, UserProfile } from './users';

export interface Connection {
  status: 'pending' | 'accepted';
  since: Date;
  direction?: 'sent' | 'received';
}

// Each of these writes both sides of the friendship. Batched so a failure on
// the mirror side cannot leave a one-sided connection behind — previously the
// second write was denied by rules and the first had already landed.
export async function sendFriendRequest(fromUid: string, toUid: string) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'friendships', fromUid, 'connections', toUid), {
    status: 'pending',
    direction: 'sent',
    since: serverTimestamp(),
  });
  batch.set(doc(db, 'friendships', toUid, 'connections', fromUid), {
    status: 'pending',
    direction: 'received',
    since: serverTimestamp(),
  });
  await batch.commit();
}

export async function acceptFriendRequest(uid: string, fromUid: string) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'friendships', uid, 'connections', fromUid), {
    status: 'accepted',
    since: serverTimestamp(),
  });
  batch.set(doc(db, 'friendships', fromUid, 'connections', uid), {
    status: 'accepted',
    since: serverTimestamp(),
  });
  await batch.commit();
}

export async function removeFriend(uid: string, friendUid: string) {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'friendships', uid, 'connections', friendUid));
  batch.delete(doc(db, 'friendships', friendUid, 'connections', uid));
  await batch.commit();
}

export async function getFriendIds(uid: string): Promise<string[]> {
  const snap = await getDocs(
    query(
      collection(db, 'friendships', uid, 'connections'),
      where('status', '==', 'accepted'),
    ),
  );
  return snap.docs.map((d) => d.id);
}

export async function getPendingRequests(uid: string): Promise<string[]> {
  const snap = await getDocs(
    query(
      collection(db, 'friendships', uid, 'connections'),
      where('status', '==', 'pending'),
      where('direction', '==', 'received'),
    ),
  );
  return snap.docs.map((d) => d.id);
}

export async function getConnectionStatus(
  uid: string,
  otherUid: string,
): Promise<Connection | null> {
  const snap = await getDoc(doc(db, 'friendships', uid, 'connections', otherUid));
  if (!snap.exists()) return null;
  return snap.data() as Connection;
}

export async function getFriendsLeaderboard(uid: string): Promise<UserProfile[]> {
  const ids = await getFriendIds(uid);
  if (ids.length === 0) return [];
  const profiles = await Promise.all(ids.map(id => getUserProfile(id)));
  return (profiles.filter(Boolean) as UserProfile[]).sort((a, b) => b.totalSpecies - a.totalSpecies);
}
