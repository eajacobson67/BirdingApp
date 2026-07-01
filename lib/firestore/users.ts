import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  GeoPoint,
  collection,
  query,
  orderBy,
  where,
  limit,
  getDocs,
  startAfter,
  getCountFromServer,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import { getBirdIdForSpecies, DEFAULT_BIRD_ID } from '../birdStyles';

export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  photoURL: string;
  birdStyleId?: string;
  isAdmin?: boolean;
  unlockedBirds?: string[];
  bio: string;
  totalSightings: number;
  totalSpecies: number;
  yearSpecies: Record<string, string[]>;
  statesVisited: string[];
  lastSightingDate: Date | null;
  joinedAt: Date;
  location: { lat: number; lng: number } | null;
  geohash: string | null;
}

export async function createUserProfile(uid: string, username: string, displayName: string) {
  await setDoc(doc(db, 'users', uid), {
    uid,
    username,
    displayName,
    photoURL: '',
    bio: '',
    totalSightings: 0,
    totalSpecies: 0,
    yearSpecies: {},
    statesVisited: [],
    lastSightingDate: null,
    joinedAt: serverTimestamp(),
    location: null,
    geohash: null,
  });
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
}

export async function updateUserStats(
  uid: string,
  species: string,
  year: string,
  state: string | null,
  lat: number,
  lng: number,
  geohash: string,
) {
  const profile = await getUserProfile(uid);
  const isNewSpecies = !profile?.yearSpecies?.[year]?.includes(species);
  const isNewLifeListSpecies = !Object.values(profile?.yearSpecies ?? {})
    .flat()
    .includes(species);

  const update: Record<string, unknown> = {
    totalSightings: (profile?.totalSightings ?? 0) + 1,
    lastSightingDate: serverTimestamp(),
    location: new GeoPoint(lat, lng),
    geohash,
    [`yearSpecies.${year}`]: arrayUnion(species),
  };

  if (isNewLifeListSpecies) {
    update.totalSpecies = (profile?.totalSpecies ?? 0) + 1;
  }
  if (state && !profile?.statesVisited?.includes(state)) {
    update.statesVisited = arrayUnion(state);
  }

  await updateDoc(doc(db, 'users', uid), update);
}

export async function searchUsersByUsername(term: string): Promise<UserProfile[]> {
  if (!term) return [];
  const lower = term.toLowerCase();
  const q = query(
    collection(db, 'users'),
    where('username', '>=', lower),
    where('username', '<=', lower + ''),
    limit(15),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as UserProfile);
}

export function getDefaultUnlockedBirds(): string[] {
  return [DEFAULT_BIRD_ID];
}

export async function checkAndUnlockBird(uid: string, commonName: string): Promise<string | null> {
  const birdId = getBirdIdForSpecies(commonName);
  if (!birdId || birdId === DEFAULT_BIRD_ID) return null;

  const profile = await getUserProfile(uid);
  const already = profile?.unlockedBirds ?? [];
  if (already.includes(birdId)) return null;

  await updateDoc(doc(db, 'users', uid), { unlockedBirds: arrayUnion(birdId) });
  return birdId;
}

export async function adminUnlockAllBirds(uid: string): Promise<void> {
  const { BIRD_STYLES } = await import('../birdStyles');
  const allIds = BIRD_STYLES.map((b) => b.id);
  await updateDoc(doc(db, 'users', uid), { unlockedBirds: allIds });
}

export async function adminRelockAllBirds(uid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { unlockedBirds: [] });
}

export async function promoteToAdmin(uid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { isAdmin: true });
}

export async function adminSetStats(
  uid: string,
  updates: Partial<Pick<UserProfile, 'totalSightings' | 'totalSpecies'>>,
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), updates as Record<string, unknown>);
}

export async function adminClearLifeList(uid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { yearSpecies: {}, totalSpecies: 0 });
}

export async function adminRemoveSpeciesFromLifeList(uid: string, species: string): Promise<void> {
  const profile = await getUserProfile(uid);
  if (!profile) return;
  const yearSpecies = { ...profile.yearSpecies };
  for (const year of Object.keys(yearSpecies)) {
    yearSpecies[year] = yearSpecies[year].filter((s) => s !== species);
    if (yearSpecies[year].length === 0) delete yearSpecies[year];
  }
  const totalSpecies = new Set(Object.values(yearSpecies).flat()).size;
  await updateDoc(doc(db, 'users', uid), { yearSpecies, totalSpecies });
}

export async function getMyGlobalRank(totalSpecies: number): Promise<number> {
  const snap = await getCountFromServer(
    query(collection(db, 'users'), where('totalSpecies', '>', totalSpecies)),
  );
  return snap.data().count + 1;
}

export async function getGlobalLeaderboard(
  count = 20,
  after?: QueryDocumentSnapshot,
): Promise<{ users: UserProfile[]; lastDoc: QueryDocumentSnapshot | null }> {
  const constraints = after
    ? [orderBy('totalSpecies', 'desc'), startAfter(after), limit(count)]
    : [orderBy('totalSpecies', 'desc'), limit(count)];
  const q = query(collection(db, 'users'), ...constraints);
  const snap = await getDocs(q);
  return {
    users: snap.docs.map((d) => d.data() as UserProfile),
    lastDoc: snap.docs[snap.docs.length - 1] ?? null,
  };
}
