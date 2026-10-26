import { Coordinates, RoundLocation } from '../../shared/types';

const EARTH_RADIUS_KM = 6371;

const toRadians = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Calculates great-circle distance between two points on Earth in kilometers
 */
export function calculateHaversineDistance(coord1: Coordinates, coord2: Coordinates): number {
  const dLat = toRadians(coord2.lat - coord1.lat);
  const dLon = toRadians(coord2.lng - coord1.lng);

  const lat1 = toRadians(coord1.lat);
  const lat2 = toRadians(coord2.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((EARTH_RADIUS_KM * c).toFixed(2));
}

/**
 * GeoGuessr-style exponential decay scoring (Max 5000 pts per round)
 */
export function calculateScore(distanceKm: number): number {
  if (distanceKm <= 0.05) return 5000; // Within 50 meters = perfect 5000
  const score = 5000 * Math.exp(-distanceKm / 2000);
  return Math.max(0, Math.round(score));
}

/**
 *Generates a short 6-character uppercase room code (e.g., "K9X2M4")
 */
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Initial starter pool of verified 360° locations (we will expand this with Mapillary API in Phase 2)
 */
export const STARTER_LOCATIONS: RoundLocation[] = [
  { imageId: '498763468214164', actualCoords: { lat: 48.8584, lng: 2.2945 } },   // Paris, France
  { imageId: '1491366974580067', actualCoords: { lat: 35.6586, lng: 139.7454 } }, // Tokyo, Japan
  { imageId: '2918842595003944', actualCoords: { lat: 40.7580, lng: -73.9855 } }, // New York, USA
  { imageId: '551029384920112', actualCoords: { lat: -33.8568, lng: 151.2153 } }, // Sydney, Australia
  { imageId: '882910495823190', actualCoords: { lat: 51.5007, lng: -0.1246 } },   // London, UK
];