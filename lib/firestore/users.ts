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
  limit,
  getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';

export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  photoURL: string;
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

export async function getGlobalLeaderboard(count = 50): Promise<UserProfile[]> {
  const q = query(collection(db, 'users'), orderBy('totalSpecies', 'desc'), limit(count));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as UserProfile);
}
