import { create } from 'zustand';
import {
  CommonBird,
  getNearbyCommonBirds,
  getNearbyCommonBirdsFromFirestore,
  STATE_TO_CODE,
} from '../lib/commonBirds';
import { LocationData, getCurrentLocation, reverseGeocode } from '../lib/location';

interface BirdsState {
  birds: CommonBird[];
  location: LocationData | null;
  loading: boolean;
  fetchBirds: () => Promise<void>;
}

export const useBirdsStore = create<BirdsState>((set, get) => ({
  birds: [],
  location: null,
  loading: false,
  fetchBirds: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const loc = await getCurrentLocation();
      if (!loc) return;
      const geo = await reverseGeocode(loc.lat, loc.lng);
      set({ location: geo });

      const stateCode = geo.state ? STATE_TO_CODE[geo.state] : null;
      if (stateCode) {
        const birds = await getNearbyCommonBirdsFromFirestore(stateCode);
        if (birds.length > 0) { set({ birds }); return; }
      }

      // Fall back to live iNaturalist if Firestore has no data for this state
      set({ birds: await getNearbyCommonBirds(loc.lat, loc.lng) });
    } catch {
      set({ birds: [] });
    } finally {
      set({ loading: false });
    }
  },
}));
