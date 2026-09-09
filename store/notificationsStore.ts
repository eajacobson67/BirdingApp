import { create } from 'zustand';
import { getPendingRequests } from '../lib/firestore/friends';
import { getPendingInvites } from '../lib/firestore/leagues';

// Shared so the tab bar badge and the profile screen read the same counts
// rather than each fetching independently and drifting out of sync.
interface NotificationsState {
  friendRequestIds: string[];
  leagueInviteCount: number;
  refresh: (uid: string) => Promise<void>;
  removeFriendRequest: (uid: string) => void;
  clear: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  friendRequestIds: [],
  leagueInviteCount: 0,

  refresh: async (uid) => {
    const [requests, invites] = await Promise.all([
      getPendingRequests(uid).catch(() => []),
      getPendingInvites(uid).catch(() => []),
    ]);
    set({ friendRequestIds: requests, leagueInviteCount: invites.length });
  },

  removeFriendRequest: (uid) =>
    set((s) => ({ friendRequestIds: s.friendRequestIds.filter((id) => id !== uid) })),

  clear: () => set({ friendRequestIds: [], leagueInviteCount: 0 }),
}));
