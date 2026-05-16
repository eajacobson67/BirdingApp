import { auth } from './firebase';

const BIRDVISION_ENDPOINT = 'https://birdvision-132532463413.us-central1.run.app/identify';

export interface BirdVisionResult {
  commonName: string;
  scientificName: string;
  confidence: number;
}

export async function identifyFromImage(
  localUri: string,
  lat: number,
  lng: number,
  date: string,
): Promise<BirdVisionResult[]> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');

  const form = new FormData();
  form.append('file', { uri: localUri, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob);
  form.append('lat', String(lat));
  form.append('lng', String(lng));
  form.append('date', date);

  const response = await fetch(BIRDVISION_ENDPOINT, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: form,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`BirdVision ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = await response.json() as { results: Array<Record<string, unknown>> };
  return data.results.map(r => ({
    commonName:     String(r.common_name     ?? 'Unknown'),
    scientificName: String(r.scientific_name ?? ''),
    confidence:     Number(r.confidence      ?? 0),
  }));
}
