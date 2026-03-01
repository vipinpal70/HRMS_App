// Haversine formula to calculate distance between two points on Earth
// Returns distance in meters
export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export function isWithinRadius(
  userCoords: Coordinates,
  targetCoords: Coordinates,
  radiusMeters: number
): boolean {
  const distance = getDistance(
    userCoords.latitude,
    userCoords.longitude,
    targetCoords.latitude,
    targetCoords.longitude
  );
  return distance <= radiusMeters;
}
