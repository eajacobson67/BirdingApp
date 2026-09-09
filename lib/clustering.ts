import type { Sighting } from './firestore/sightings';

export interface MapRegion { latDelta: number; lngDelta: number; }
export interface Cluster { lat: number; lng: number; lead: Sighting; sightings: Sighting[]; count: number; }

export function clusterSightings(sightings: Sighting[], region: MapRegion): Cluster[] {
  const latT = Math.max(region.latDelta * 0.07, 0.0008);
  const lngT = Math.max(region.lngDelta * 0.07, 0.0008);
  const visited = new Set<string>();
  const clusters: Cluster[] = [];
  for (const s of sightings) {
    if (visited.has(s.id)) continue;
    const group = sightings.filter(
      (o) =>
        !visited.has(o.id) &&
        Math.abs(o.location.lat - s.location.lat) < latT &&
        Math.abs(o.location.lng - s.location.lng) < lngT,
    );
    for (const g of group) visited.add(g.id);
    clusters.push({ lat: s.location.lat, lng: s.location.lng, lead: s, sightings: group, count: group.length });
  }
  return clusters;
}
