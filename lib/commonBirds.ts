import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

const EBIRD_API_KEY = '59vakk8sprlj';

export interface CommonBird {
  commonName: string;
  scientificName: string;
  speciesCode: string;
  photoUrl?: string;
  observationCount?: number; // iNaturalist count (live fallback)
  abundance?: number;        // eBird S&T abundance_mean (Firestore primary)
}

// Accepts both full state names ("Wisconsin") and abbreviations ("WI") —
// Expo Location returns full names on iOS and abbreviations on Android.
export const STATE_TO_CODE: Record<string, string> = {
  'Alabama': 'USA-AL', 'Alaska': 'USA-AK', 'Arizona': 'USA-AZ',
  'Arkansas': 'USA-AR', 'California': 'USA-CA', 'Colorado': 'USA-CO',
  'Connecticut': 'USA-CT', 'Delaware': 'USA-DE', 'Florida': 'USA-FL',
  'Georgia': 'USA-GA', 'Hawaii': 'USA-HI', 'Idaho': 'USA-ID',
  'Illinois': 'USA-IL', 'Indiana': 'USA-IN', 'Iowa': 'USA-IA',
  'Kansas': 'USA-KS', 'Kentucky': 'USA-KY', 'Louisiana': 'USA-LA',
  'Maine': 'USA-ME', 'Maryland': 'USA-MD', 'Massachusetts': 'USA-MA',
  'Michigan': 'USA-MI', 'Minnesota': 'USA-MN', 'Mississippi': 'USA-MS',
  'Missouri': 'USA-MO', 'Montana': 'USA-MT', 'Nebraska': 'USA-NE',
  'Nevada': 'USA-NV', 'New Hampshire': 'USA-NH', 'New Jersey': 'USA-NJ',
  'New Mexico': 'USA-NM', 'New York': 'USA-NY', 'North Carolina': 'USA-NC',
  'North Dakota': 'USA-ND', 'Ohio': 'USA-OH', 'Oklahoma': 'USA-OK',
  'Oregon': 'USA-OR', 'Pennsylvania': 'USA-PA', 'Rhode Island': 'USA-RI',
  'South Carolina': 'USA-SC', 'South Dakota': 'USA-SD', 'Tennessee': 'USA-TN',
  'Texas': 'USA-TX', 'Utah': 'USA-UT', 'Vermont': 'USA-VT',
  'Virginia': 'USA-VA', 'Washington': 'USA-WA', 'West Virginia': 'USA-WV',
  'Wisconsin': 'USA-WI', 'Wyoming': 'USA-WY', 'District of Columbia': 'USA-DC',
  // Abbreviations (Android)
  'AL': 'USA-AL', 'AK': 'USA-AK', 'AZ': 'USA-AZ', 'AR': 'USA-AR',
  'CA': 'USA-CA', 'CO': 'USA-CO', 'CT': 'USA-CT', 'DE': 'USA-DE',
  'FL': 'USA-FL', 'GA': 'USA-GA', 'HI': 'USA-HI', 'ID': 'USA-ID',
  'IL': 'USA-IL', 'IN': 'USA-IN', 'IA': 'USA-IA', 'KS': 'USA-KS',
  'KY': 'USA-KY', 'LA': 'USA-LA', 'ME': 'USA-ME', 'MD': 'USA-MD',
  'MA': 'USA-MA', 'MI': 'USA-MI', 'MN': 'USA-MN', 'MS': 'USA-MS',
  'MO': 'USA-MO', 'MT': 'USA-MT', 'NE': 'USA-NE', 'NV': 'USA-NV',
  'NH': 'USA-NH', 'NJ': 'USA-NJ', 'NM': 'USA-NM', 'NY': 'USA-NY',
  'NC': 'USA-NC', 'ND': 'USA-ND', 'OH': 'USA-OH', 'OK': 'USA-OK',
  'OR': 'USA-OR', 'PA': 'USA-PA', 'RI': 'USA-RI', 'SC': 'USA-SC',
  'SD': 'USA-SD', 'TN': 'USA-TN', 'TX': 'USA-TX', 'UT': 'USA-UT',
  'VT': 'USA-VT', 'VA': 'USA-VA', 'WA': 'USA-WA', 'WV': 'USA-WV',
  'WI': 'USA-WI', 'WY': 'USA-WY', 'DC': 'USA-DC',
};

// Cached once per app session — taxonomy doc rarely exceeds 100 KB
let taxonomyCache: Record<string, { commonName: string; scientificName: string }> | null = null;

async function getTaxonomy() {
  if (taxonomyCache) return taxonomyCache;
  const snap = await getDoc(doc(db, 'species', 'taxonomy'));
  taxonomyCache = snap.exists() ? (snap.data() as Record<string, { commonName: string; scientificName: string }>) : {};
  return taxonomyCache!;
}

// Module-level cache for full eBird taxonomy (search-all-species feature)
let fullTaxonomyCache: CommonBird[] | null = null;

export async function getAllSpecies(): Promise<CommonBird[]> {
  if (fullTaxonomyCache) return fullTaxonomyCache;
  const response = await fetch(
    'https://api.ebird.org/v2/ref/taxonomy/ebird?fmt=json&cat=species',
    { headers: { 'X-eBirdApiToken': EBIRD_API_KEY } },
  );
  if (!response.ok) throw new Error('eBird taxonomy request failed');
  const data: Array<{ comName: string; sciName: string; speciesCode: string }> =
    await response.json();
  fullTaxonomyCache = data.map((b) => ({
    commonName: b.comName,
    scientificName: b.sciName,
    speciesCode: b.speciesCode,
  }));
  return fullTaxonomyCache;
}

export async function getNearbyCommonBirdsFromFirestore(stateCode: string): Promise<CommonBird[]> {
  const [stateSnap, taxonomy] = await Promise.all([
    getDoc(doc(db, 'commonBirds', stateCode)),
    getTaxonomy(),
  ]);
  if (!stateSnap.exists()) return [];

  const { species } = stateSnap.data() as {
    species: Array<{ speciesCode: string; abundance: number }>;
  };

  return species
    .filter((s) => taxonomy[s.speciesCode])
    .map((s) => ({
      speciesCode: s.speciesCode,
      abundance: s.abundance,
      commonName: taxonomy[s.speciesCode].commonName,
      scientificName: taxonomy[s.speciesCode].scientificName,
    }));
}

export async function getNearbyCommonBirds(lat: number, lng: number): Promise<CommonBird[]> {
  const response = await fetch(
    `https://api.inaturalist.org/v1/observations/species_counts?taxon_id=3&lat=${lat}&lng=${lng}&radius=20&quality_grade=research&per_page=50`,
  );
  if (!response.ok) throw new Error('iNaturalist request failed');
  const data: {
    results: Array<{
      count: number;
      taxon: {
        name: string;
        preferred_common_name?: string;
        default_photo?: { square_url?: string; medium_url?: string };
      };
    }>;
  } = await response.json();
  return data.results
    .filter((r) => r.taxon.preferred_common_name)
    .map((r) => ({
      commonName: r.taxon.preferred_common_name!,
      scientificName: r.taxon.name,
      speciesCode: '',
      photoUrl: r.taxon.default_photo?.square_url ?? r.taxon.default_photo?.medium_url,
      observationCount: r.count,
    }));
}
