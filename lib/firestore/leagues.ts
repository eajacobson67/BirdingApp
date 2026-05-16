import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
  runTransaction,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import { type Rarity, RARITY_MULTIPLIERS } from '../birdRarity';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface LeagueConfig {
  requirePhotos: boolean;
  rarityScoring: boolean;
  targetBirds: boolean;
}

export interface League {
  id: string;
  name: string;
  createdBy: string;
  startDate: Date;
  endDate: Date;
  status: 'lobby' | 'upcoming' | 'active' | 'completed';
  isPublic: boolean;
  memberCount: number;
  config: LeagueConfig;
}

export interface LeagueMember {
  userId: string;
  displayName: string;
  birdStyleId: string;
  points: number;
  sightingCount: number;
  joinedAt: Date;
  role: 'owner' | 'member';
}

export interface LeagueInvite {
  leagueId: string;
  leagueName: string;
  invitedBy: string;
  invitedByName: string;
  invitedAt: Date;
  status: 'pending' | 'accepted' | 'declined';
}

export interface LeagueSighting {
  id: string;
  sightingId: string;
  userId: string;
  species: string;
  rarity: Rarity;
  points: number;
  isTargetBird: boolean;
  timestamp: Date;
  photoURL: string | null;
}

// ── Points ────────────────────────────────────────────────────────────────────

export function calculatePoints(
  rarity: Rarity,
  isTarget: boolean,
  config: LeagueConfig,
): number {
  const rarityMult = config.rarityScoring ? RARITY_MULTIPLIERS[rarity] : 1;
  const targetBonus = config.targetBirds && isTarget ? 3 : 0;
  return 1 * rarityMult + targetBonus;
}

// ── League CRUD ───────────────────────────────────────────────────────────────

export async function createLeague(data: {
  name: string;
  createdBy: string;
  startDate: Date;
  endDate: Date;
  isPublic: boolean;
  config: LeagueConfig;
  creatorDisplayName: string;
  creatorBirdStyleId: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, 'leagues'), {
    name: data.name,
    createdBy: data.createdBy,
    startDate: Timestamp.fromDate(data.startDate),
    endDate: Timestamp.fromDate(data.endDate),
    status: 'lobby',
    isPublic: data.isPublic,
    memberCount: 1,
    config: data.config,
    createdAt: serverTimestamp(),
  });

  // Add creator as owner-member
  await setDoc(doc(db, 'leagues', ref.id, 'members', data.createdBy), {
    userId: data.createdBy,
    displayName: data.creatorDisplayName,
    birdStyleId: data.creatorBirdStyleId,
    points: 0,
    sightingCount: 0,
    joinedAt: serverTimestamp(),
    role: 'owner',
  });

  return ref.id;
}

export async function getLeague(id: string): Promise<League | null> {
  const snap = await getDoc(doc(db, 'leagues', id));
  if (!snap.exists()) return null;
  return firestoreToLeague(snap.id, snap.data());
}

export async function getUserLeagues(uid: string): Promise<League[]> {
  // Find leagues where the user is a member
  const memberSnaps = await getDocs(
    query(collection(db, 'leagues'), where('createdBy', '==', uid)),
  );
  // Also query leagues/{id}/members/{uid} — requires a collection-group query
  // For simplicity, cache league IDs in a user subcollection on join
  const ids = new Set(memberSnaps.docs.map((d) => d.id));

  const userMemberships = await getDocs(
    collection(db, 'users', uid, 'leagueMemberships'),
  );
  userMemberships.docs.forEach((d) => ids.add(d.id));

  const leagues = await Promise.all(
    [...ids].map((id) => getLeague(id)),
  );
  return leagues.filter((l): l is League => l !== null);
}

export async function getPublicLeagues(count = 30): Promise<League[]> {
  const q = query(
    collection(db, 'leagues'),
    where('isPublic', '==', true),
    where('status', 'in', ['lobby', 'active', 'upcoming']),
    limit(count),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => firestoreToLeague(d.id, d.data()))
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
}

// ── Membership ────────────────────────────────────────────────────────────────

export async function joinLeague(
  leagueId: string,
  uid: string,
  displayName: string,
  birdStyleId: string,
): Promise<void> {
  await runTransaction(db, async (tx) => {
    const leagueRef = doc(db, 'leagues', leagueId);
    const memberRef = doc(db, 'leagues', leagueId, 'members', uid);
    const existing = await tx.get(memberRef);
    if (existing.exists()) return;

    tx.set(memberRef, {
      userId: uid,
      displayName,
      birdStyleId,
      points: 0,
      sightingCount: 0,
      joinedAt: serverTimestamp(),
      role: 'member',
    });
    tx.update(leagueRef, { memberCount: increment(1) });
    tx.set(doc(db, 'users', uid, 'leagueMemberships', leagueId), { joinedAt: serverTimestamp() });
  });
}

export async function startLeague(leagueId: string): Promise<void> {
  const snap = await getDoc(doc(db, 'leagues', leagueId));
  if (!snap.exists()) return;
  const data = snap.data();
  const originalStart = (data.startDate as Timestamp).toDate();
  const originalEnd = (data.endDate as Timestamp).toDate();
  const durationMs = originalEnd.getTime() - originalStart.getTime();
  const now = new Date();
  await updateDoc(doc(db, 'leagues', leagueId), {
    status: 'active',
    startDate: Timestamp.fromDate(now),
    endDate: Timestamp.fromDate(new Date(now.getTime() + durationMs)),
  });
}

export async function setLeagueEndTime(leagueId: string, secondsFromNow: number): Promise<void> {
  await updateDoc(doc(db, 'leagues', leagueId), {
    endDate: Timestamp.fromDate(new Date(Date.now() + secondsFromNow * 1000)),
  });
}

export async function inviteToLeague(
  leagueId: string,
  leagueName: string,
  inviterUid: string,
  inviterName: string,
  inviteeUid: string,
): Promise<void> {
  await setDoc(doc(db, 'leagues', leagueId, 'invites', inviteeUid), {
    leagueId,
    leagueName,
    invitedBy: inviterUid,
    invitedByName: inviterName,
    invitedAt: serverTimestamp(),
    status: 'pending',
  });
  // Mirror on the invitee's user doc for easy querying
  await setDoc(doc(db, 'users', inviteeUid, 'pendingInvites', leagueId), {
    leagueId,
    leagueName,
    invitedBy: inviterUid,
    invitedByName: inviterName,
    invitedAt: serverTimestamp(),
    status: 'pending',
  });
}

export async function respondToInvite(
  leagueId: string,
  uid: string,
  accept: boolean,
  displayName: string,
  birdStyleId: string,
): Promise<void> {
  const status = accept ? 'accepted' : 'declined';
  await updateDoc(doc(db, 'leagues', leagueId, 'invites', uid), { status });
  await updateDoc(doc(db, 'users', uid, 'pendingInvites', leagueId), { status });
  if (accept) {
    await joinLeague(leagueId, uid, displayName, birdStyleId);
  }
}

export async function getPendingInvites(uid: string): Promise<LeagueInvite[]> {
  const snap = await getDocs(
    query(collection(db, 'users', uid, 'pendingInvites'), where('status', '==', 'pending')),
  );
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      leagueId: d.id,
      leagueName: data.leagueName,
      invitedBy: data.invitedBy,
      invitedByName: data.invitedByName,
      invitedAt: (data.invitedAt as Timestamp).toDate(),
      status: data.status,
    } as LeagueInvite;
  });
}

// ── Sightings & Points ────────────────────────────────────────────────────────

export async function logLeagueSighting(
  leagueId: string,
  data: {
    sightingId: string;
    userId: string;
    species: string;
    rarity: Rarity;
    photoURL: string | null;
    config: LeagueConfig;
  },
): Promise<void> {
  const todayStr = new Date().toISOString().slice(0, 10);
  let isTargetBird = false;

  if (data.config.targetBirds) {
    const targetSnap = await getDoc(
      doc(db, 'leagues', leagueId, 'targetBirds', todayStr),
    );
    if (targetSnap.exists()) {
      const species: string[] = targetSnap.data().species ?? [];
      isTargetBird = species.map((s) => s.toLowerCase()).includes(data.species.toLowerCase());
    }
  }

  const points = calculatePoints(data.rarity, isTargetBird, data.config);

  await runTransaction(db, async (tx) => {
    const sightingRef = doc(collection(db, 'leagues', leagueId, 'sightings'));
    const memberRef = doc(db, 'leagues', leagueId, 'members', data.userId);

    tx.set(sightingRef, {
      sightingId: data.sightingId,
      userId: data.userId,
      species: data.species,
      rarity: data.rarity,
      points,
      isTargetBird,
      photoURL: data.photoURL,
      timestamp: serverTimestamp(),
    });
    tx.update(memberRef, {
      points: increment(points),
      sightingCount: increment(1),
    });
  });
}

export async function getLeagueLeaderboard(leagueId: string): Promise<LeagueMember[]> {
  const snap = await getDocs(
    query(
      collection(db, 'leagues', leagueId, 'members'),
      orderBy('points', 'desc'),
    ),
  );
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      ...data,
      joinedAt: (data.joinedAt as Timestamp)?.toDate?.() ?? new Date(),
    } as LeagueMember;
  });
}

export function subscribeLeaderboard(
  leagueId: string,
  cb: (members: LeagueMember[]) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'leagues', leagueId, 'members'), orderBy('points', 'desc')),
    (snap) => {
      cb(snap.docs.map((d) => {
        const data = d.data();
        return {
          ...data,
          joinedAt: (data.joinedAt as Timestamp)?.toDate?.() ?? new Date(),
        } as LeagueMember;
      }));
    },
  );
}

export function subscribeLeagueUpdates(
  leagueId: string,
  cb: (league: League) => void,
): Unsubscribe {
  return onSnapshot(doc(db, 'leagues', leagueId), (snap) => {
    if (snap.exists()) cb(firestoreToLeague(snap.id, snap.data()));
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function firestoreToLeague(id: string, data: Record<string, unknown>): League {
  return {
    id,
    name: data.name as string,
    createdBy: data.createdBy as string,
    startDate: (data.startDate as Timestamp).toDate(),
    endDate: (data.endDate as Timestamp).toDate(),
    status: data.status as League['status'],
    isPublic: data.isPublic as boolean,
    memberCount: data.memberCount as number,
    config: data.config as LeagueConfig,
  };
}
