import { auth } from './firebase';

const BIRDNET_ENDPOINT = 'https://birdnet-132532463413.us-central1.run.app/analyze';

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
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(BIRDNET_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ url: audioUrl, lat, lon: lng, date, min_confidence: 0.1 }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`BirdNET ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = await response.json() as { results: Array<Record<string, unknown>> };
  return data.results.map(r => ({
    commonName:     String(r.common_name     ?? 'Unknown'),
    scientificName: String(r.scientific_name ?? ''),
    confidence:     Number(r.confidence      ?? 0),
  }));
}

export async function identifyFromLocalUri(
  localUri: string,
  lat: number,
  lng: number,
  date: string,
): Promise<BirdNetResult[]> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');

  const form = new FormData();
  form.append('file', { uri: localUri, name: 'chunk.m4a', type: 'audio/m4a' } as unknown as Blob);
  form.append('lat', String(lat));
  form.append('lon', String(lng));
  form.append('date', date);
  form.append('min_confidence', '0.1');

  const response = await fetch(BIRDNET_ENDPOINT, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: form,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`BirdNET ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = await response.json() as { results: Array<Record<string, unknown>> };
  return data.results.map(r => ({
    commonName:     String(r.common_name     ?? 'Unknown'),
    scientificName: String(r.scientific_name ?? ''),
    confidence:     Number(r.confidence      ?? 0),
  }));
}
