// eBird API key — register at https://ebird.org/api/keygen
const EBIRD_API_KEY = 'YOUR_EBIRD_API_KEY';

export interface CommonBird {
  commonName: string;
  scientificName: string;
  speciesCode: string;
}

export async function getNearbyCommonBirds(lat: number, lng: number): Promise<CommonBird[]> {
  try {
    const response = await fetch(
      `https://api.ebird.org/v2/data/obs/geo/recent?lat=${lat}&lng=${lng}&maxResults=30&back=7`,
      { headers: { 'X-eBirdApiToken': EBIRD_API_KEY } },
    );
    if (!response.ok) throw new Error('eBird request failed');
    const data: Array<{ comName: string; sciName: string; speciesCode: string }> =
      await response.json();
    return data.map((b) => ({
      commonName: b.comName,
      scientificName: b.sciName,
      speciesCode: b.speciesCode,
    }));
  } catch {
    return FALLBACK_COMMON_BIRDS;
  }
}

// Shown when eBird is unavailable or API key not yet set
const FALLBACK_COMMON_BIRDS: CommonBird[] = [
  { commonName: 'American Robin', scientificName: 'Turdus migratorius', speciesCode: 'amerob' },
  { commonName: 'Northern Cardinal', scientificName: 'Cardinalis cardinalis', speciesCode: 'norcar' },
  { commonName: 'Blue Jay', scientificName: 'Cyanocitta cristata', speciesCode: 'blujay' },
  { commonName: 'Mourning Dove', scientificName: 'Zenaida macroura', speciesCode: 'moudov' },
  { commonName: 'House Sparrow', scientificName: 'Passer domesticus', speciesCode: 'houspa' },
  { commonName: 'European Starling', scientificName: 'Sturnus vulgaris', speciesCode: 'eursta' },
  { commonName: 'Cedar Waxwing', scientificName: 'Bombycilla cedrorum', speciesCode: 'cedwax' },
  { commonName: 'American Goldfinch', scientificName: 'Spinus tristis', speciesCode: 'amegfi' },
  { commonName: 'Downy Woodpecker', scientificName: 'Dryobates pubescens', speciesCode: 'dowwoo' },
  { commonName: 'Black-capped Chickadee', scientificName: 'Poecile atricapillus', speciesCode: 'blcchi' },
  { commonName: 'White-breasted Nuthatch', scientificName: 'Sitta carolinensis', speciesCode: 'wbrnub' },
  { commonName: 'Song Sparrow', scientificName: 'Melospiza melodia', speciesCode: 'sonspa' },
  { commonName: 'Red-winged Blackbird', scientificName: 'Agelaius phoeniceus', speciesCode: 'rewbla' },
  { commonName: 'Canada Goose', scientificName: 'Branta canadensis', speciesCode: 'cangoo' },
  { commonName: 'Mallard', scientificName: 'Anas platyrhynchos', speciesCode: 'mallar' },
];
