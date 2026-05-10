import {
  collection,
  addDoc,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  serverTimestamp,
  GeoPoint,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

export interface Sighting {
  id: string;
  userId: string;
  commonName: string;
  scientificName: string;
  confidence: number;
  location: { lat: number; lng: number };
  locationName: string;
  state: string;
  country: string;
  photoURL: string | null;
  audioURL: string | null;
  notes: string;
  timestamp: Date;
  isPublic: boolean;
  likes: number;
}

export async function logSighting(data: {
  userId: string;
  commonName: string;
  scientificName: string;
  confidence: number;
  lat: number;
  lng: number;
  locationName: string;
  state: string;
  country: string;
  photoURL: string | null;
  audioURL: string | null;
  notes: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, 'sightings'), {
    ...data,
    location: new GeoPoint(data.lat, data.lng),
    timestamp: serverTimestamp(),
    isPublic: true,
    likes: 0,
  });
  return ref.id;
}

export async function getSighting(id: string): Promise<Sighting | null> {
  const snap = await getDoc(doc(db, 'sightings', id));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    id: snap.id,
    ...d,
    location: { lat: d.location.latitude, lng: d.location.longitude },
    timestamp: (d.timestamp as Timestamp).toDate(),
  } as Sighting;
}

export async function getRecentPublicSightings(count = 200): Promise<Sighting[]> {
  const q = query(
    collection(db, 'sightings'),
    where('isPublic', '==', true),
    orderBy('timestamp', 'desc'),
    limit(count),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      location: { lat: data.location.latitude, lng: data.location.longitude },
      timestamp: (data.timestamp as Timestamp).toDate(),
    } as Sighting;
  });
}

export function subscribeToFriendSightings(
  friendIds: string[],
  callback: (sightings: Sighting[]) => void,
) {
  if (friendIds.length === 0) {
    callback([]);
    return () => {};
  }
  const ids = friendIds.slice(0, 10); // Firestore 'in' limit
  const q = query(
    collection(db, 'sightings'),
    where('userId', 'in', ids),
    orderBy('timestamp', 'desc'),
    limit(50),
  );
  return onSnapshot(q, (snap) => {
    const sightings = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        location: { lat: data.location.latitude, lng: data.location.longitude },
        timestamp: (data.timestamp as Timestamp)?.toDate?.() ?? new Date(),
      } as Sighting;
    });
    callback(sightings);
  });
}

export async function getUserSightings(userId: string, count = 100): Promise<Sighting[]> {
  const q = query(
    collection(db, 'sightings'),
    where('userId', '==', userId),
    orderBy('timestamp', 'desc'),
    limit(count),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      location: { lat: data.location.latitude, lng: data.location.longitude },
      timestamp: (data.timestamp as Timestamp)?.toDate?.() ?? new Date(),
    } as Sighting;
  });
}
