import { useEffect, useState } from 'react';
import { getFriendIds, getPendingRequests } from '../firestore/friends';

export function useFriends(uid: string | null) {
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    Promise.all([getFriendIds(uid), getPendingRequests(uid)])
      .then(([friends, pending]) => {
        setFriendIds(friends);
        setPendingIds(pending);
      })
      .finally(() => setLoading(false));
  }, [uid]);

  return { friendIds, pendingIds, loading };
}
