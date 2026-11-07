import type { EndpointView } from "./contracts.ts";

export interface SnapResult {
  readonly endpoint: EndpointView;
  readonly distance_m: number;
}

function distanceMetres(longitude: number, latitude: number, endpoint: EndpointView): number {
  const radians = Math.PI / 180;
  const latitude1 = latitude * radians;
  const latitude2 = endpoint.latitude * radians;
  const deltaLatitude = latitude2 - latitude1;
  const deltaLongitude = (endpoint.longitude - longitude) * radians;
  const a = Math.min(1, Math.max(0,
    Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(deltaLongitude / 2) ** 2,
  ));
  return 6_371_008.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function snapToEligibleEndpoint(
  endpoints: readonly EndpointView[],
  longitude: number,
  latitude: number,
  maximumDistanceM = 150,
): SnapResult | null {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || !Number.isFinite(maximumDistanceM) || maximumDistanceM < 0) {
    throw new TypeError("snap coordinates and distance must be finite, with a non-negative distance");
  }
  let best: SnapResult | null = null;
  for (const endpoint of endpoints) {
    const distance = distanceMetres(longitude, latitude, endpoint);
    if (distance > maximumDistanceM) continue;
    if (best === null || distance < best.distance_m || (distance === best.distance_m && endpoint.id < best.endpoint.id)) {
      best = { endpoint, distance_m: distance };
    }
  }
  return best;
}
