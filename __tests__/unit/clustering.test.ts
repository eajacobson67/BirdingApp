import { clusterSightings, type MapRegion } from '../../lib/clustering';
import type { Sighting } from '../../lib/firestore/sightings';

jest.mock('../../lib/firebase', () => ({ db: {}, auth: {}, storage: {} }));

function sighting(id: string, lat: number, lng: number): Sighting {
  return {
    id,
    userId: 'u1',
    commonName: 'Cedar Waxwing',
    location: { lat, lng },
    timestamp: new Date('2026-01-01'),
    isPublic: true,
  } as unknown as Sighting;
}

const WIDE: MapRegion = { latDelta: 1, lngDelta: 1 };       // threshold 0.07
const TIGHT: MapRegion = { latDelta: 0.0001, lngDelta: 0.0001 }; // clamps to 0.0008

describe('clusterSightings', () => {
  test('returns nothing for an empty list', () => {
    expect(clusterSightings([], WIDE)).toEqual([]);
  });

  test('a single sighting yields one cluster of one', () => {
    const clusters = clusterSightings([sighting('a', 40, -74)], WIDE);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].count).toBe(1);
    expect(clusters[0].lead.id).toBe('a');
  });

  test('nearby sightings merge into one cluster', () => {
    const clusters = clusterSightings(
      [sighting('a', 40, -74), sighting('b', 40.01, -74.01), sighting('c', 40.02, -74.02)],
      WIDE,
    );
    expect(clusters).toHaveLength(1);
    expect(clusters[0].count).toBe(3);
  });

  test('distant sightings stay separate', () => {
    const clusters = clusterSightings(
      [sighting('a', 40, -74), sighting('b', 45, -80)],
      WIDE,
    );
    expect(clusters).toHaveLength(2);
    expect(clusters.every((c) => c.count === 1)).toBe(true);
  });

  test('every sighting lands in exactly one cluster', () => {
    const input = [
      sighting('a', 40, -74),
      sighting('b', 40.001, -74.001),
      sighting('c', 45, -80),
      sighting('d', 45.001, -80.001),
      sighting('e', 10, 10),
    ];
    const clusters = clusterSightings(input, WIDE);
    const ids = clusters.flatMap((c) => c.sightings.map((s) => s.id));
    expect(ids.sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(ids).toHaveLength(new Set(ids).size); // no duplicates
  });

  test('count always equals the group length', () => {
    const clusters = clusterSightings(
      [sighting('a', 40, -74), sighting('b', 40.01, -74.01), sighting('c', 45, -80)],
      WIDE,
    );
    for (const c of clusters) expect(c.count).toBe(c.sightings.length);
  });

  test('zooming in splits a cluster apart', () => {
    const input = [sighting('a', 40, -74), sighting('b', 40.01, -74.01)];
    expect(clusterSightings(input, WIDE)).toHaveLength(1);
    expect(clusterSightings(input, TIGHT)).toHaveLength(2);
  });

  test('the threshold floor prevents infinite zoom from separating identical points', () => {
    const clusters = clusterSightings(
      [sighting('a', 40, -74), sighting('b', 40, -74)],
      { latDelta: 0, lngDelta: 0 },
    );
    expect(clusters).toHaveLength(1);
    expect(clusters[0].count).toBe(2);
  });

  test('the lead sighting is the first one encountered in the group', () => {
    const clusters = clusterSightings(
      [sighting('first', 40, -74), sighting('second', 40.001, -74.001)],
      WIDE,
    );
    expect(clusters[0].lead.id).toBe('first');
    expect(clusters[0].lat).toBe(40);
    expect(clusters[0].lng).toBe(-74);
  });

  test('handles negative and cross-hemisphere coordinates', () => {
    const clusters = clusterSightings(
      [sighting('n', 51.5, -0.12), sighting('s', -33.86, 151.2)],
      WIDE,
    );
    expect(clusters).toHaveLength(2);
  });

  test('is stable — same input yields the same clustering', () => {
    const input = [
      sighting('a', 40, -74),
      sighting('b', 40.01, -74.01),
      sighting('c', 45, -80),
    ];
    const a = clusterSightings(input, WIDE);
    const b = clusterSightings(input, WIDE);
    expect(a.map((c) => c.lead.id)).toEqual(b.map((c) => c.lead.id));
  });

  test('does not mutate its input', () => {
    const input = [sighting('a', 40, -74), sighting('b', 40.01, -74.01)];
    const snapshot = JSON.stringify(input);
    clusterSightings(input, WIDE);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
