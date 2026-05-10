// TODO: Register for a BirdNET API key at https://birdnet.cornell.edu/api/
const BIRDNET_API_KEY = 'YOUR_BIRDNET_API_KEY';
const BIRDNET_BASE = 'https://birdnet.cornell.edu/api/v2';

export interface BirdNetResult {
  commonName: string;
  scientificName: string;
  confidence: number;
}

export async function identifyFromAudio(
  audioUrl: string,
  lat: number,
  lng: number,
  date: string, // YYYY-MM-DD
): Promise<BirdNetResult[]> {
  const response = await fetch(`${BIRDNET_BASE}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${BIRDNET_API_KEY}`,
    },
    body: JSON.stringify({
      url: audioUrl,
      latitude: lat,
      longitude: lng,
      date,
      min_confidence: 0.1,
      num_results: 5,
    }),
  });

  if (!response.ok) {
    throw new Error(`BirdNET API error: ${response.status}`);
  }

  const data = await response.json();

  // Normalize response — actual field names may differ per BirdNET API version
  return (data.results ?? data.detections ?? []).map((item: Record<string, unknown>) => ({
    commonName: (item.common_name ?? item.commonName ?? 'Unknown') as string,
    scientificName: (item.scientific_name ?? item.scientificName ?? '') as string,
    confidence: (item.confidence ?? item.score ?? 0) as number,
  }));
}
