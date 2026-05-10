import { useEffect, useState } from 'react';
import { Sighting, subscribeToFriendSightings } from '../firestore/sightings';

export function useFriendSightings(friendIds: string[]) {
  const [sightings, setSightings] = useState<Sighting[]>([]);

  useEffect(() => {
    const unsub = subscribeToFriendSightings(friendIds, setSightings);
    return unsub;
  }, [friendIds.join(',')]);

  return sightings;
}
