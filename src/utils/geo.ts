import { GpxParsedTrack, TrailNode, TrailSegment } from '../types';

/**
 * Calculates Haversine distance between two coordinates in kilometers.
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Calculates total distance of an array of coordinates [lng, lat, ele?] in kilometers.
 */
export function calculateCoordinatesDistanceKm(
  coords: [number, number, number?][]
): number {
  if (coords.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const [lon1, lat1] = coords[i];
    const [lon2, lat2] = coords[i + 1];
    total += calculateDistanceKm(lat1, lon1, lat2, lon2);
  }
  return Math.round(total * 100) / 100;
}

/**
 * Calculates elevation gain and loss from coordinate stream.
 * Smooths small noise (threshold of 2m) typical in GPS / barometric data.
 */
export function calculateElevationStats(coords: [number, number, number?][]): {
  gain: number;
  loss: number;
} {
  let gain = 0;
  let loss = 0;
  if (coords.length < 2) return { gain: 0, loss: 0 };

  for (let i = 1; i < coords.length; i++) {
    const prevEle = coords[i - 1][2] ?? 0;
    const currEle = coords[i][2] ?? 0;
    const diff = currEle - prevEle;

    if (Math.abs(diff) >= 2) {
      if (diff > 0) gain += diff;
      else loss += Math.abs(diff);
    }
  }

  return {
    gain: Math.round(gain),
    loss: Math.round(loss),
  };
}

/**
 * Estimates hiking duration using Naismith's Rule with Langmuir additions:
 * - 4.2 km/h flat walking
 * - + 1 hr per 500m ascent
 * - + 10 mins per 300m steep descent
 */
export function estimateHikingDurationHours(
  distanceKm: number,
  gainM: number,
  lossM: number
): number {
  const baseTime = distanceKm / 4.2;
  const ascentTime = gainM / 500;
  const descentTime = (lossM / 300) * (10 / 60);
  const total = baseTime + ascentTime + descentTime;
  return Math.round(total * 10) / 10;
}

/**
 * Parses raw GPX XML string into structured track with distance, elevation, and bounds.
 */
export function parseGpx(xmlString: string): GpxParsedTrack {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  // Check for parse error
  const parseError = xmlDoc.getElementsByTagName('parsererror');
  if (parseError.length > 0) {
    throw new Error('Invalid GPX XML format.');
  }

  // Extract track name
  let name = 'Imported GPX Track';
  const nameElement = xmlDoc.querySelector('trk > name') || xmlDoc.querySelector('gpx > metadata > name');
  if (nameElement && nameElement.textContent) {
    name = nameElement.textContent.trim();
  }

  // Find all track points
  const trkpts = Array.from(xmlDoc.getElementsByTagName('trkpt'));
  if (trkpts.length === 0) {
    // Check route points or waypoints as fallback
    const rtepts = Array.from(xmlDoc.getElementsByTagName('rtept'));
    if (rtepts.length > 0) {
      trkpts.push(...rtepts);
    }
  }

  if (trkpts.length === 0) {
    throw new Error('No track points (<trkpt>) found in GPX file.');
  }

  const points: { lat: number; lng: number; ele: number; time?: string }[] = [];
  let minElevation = Infinity;
  let maxElevation = -Infinity;

  for (const pt of trkpts) {
    const lat = parseFloat(pt.getAttribute('lat') || '0');
    const lng = parseFloat(pt.getAttribute('lon') || '0');
    
    let ele = 0;
    const eleNode = pt.getElementsByTagName('ele')[0];
    if (eleNode && eleNode.textContent) {
      ele = parseFloat(eleNode.textContent);
    }

    let time: string | undefined;
    const timeNode = pt.getElementsByTagName('time')[0];
    if (timeNode && timeNode.textContent) {
      time = timeNode.textContent;
    }

    if (!isNaN(lat) && !isNaN(lng)) {
      points.push({ lat, lng, ele: isNaN(ele) ? 0 : ele, time });
      if (!isNaN(ele)) {
        if (ele < minElevation) minElevation = ele;
        if (ele > maxElevation) maxElevation = ele;
      }
    }
  }

  if (minElevation === Infinity) minElevation = 0;
  if (maxElevation === -Infinity) maxElevation = 0;

  // Calculate stats
  const coords: [number, number, number?][] = points.map(p => [p.lng, p.lat, p.ele]);
  const distanceKm = calculateCoordinatesDistanceKm(coords);
  const { gain, loss } = calculateElevationStats(coords);

  return {
    name,
    points,
    distanceKm,
    elevationGainM: gain,
    elevationLossM: loss,
    minElevationM: Math.round(minElevation),
    maxElevationM: Math.round(maxElevation),
  };
}

/**
 * Finds the closest node to a given lat/lng within a threshold radius (meters).
 */
export function findClosestNode(
  lat: number,
  lng: number,
  nodes: TrailNode[],
  maxDistanceMeters = 300
): TrailNode | null {
  let closest: TrailNode | null = null;
  let minDistance = Infinity;

  for (const node of nodes) {
    const distMeters = calculateDistanceKm(lat, lng, node.lat, node.lng) * 1000;
    if (distMeters < minDistance && distMeters <= maxDistanceMeters) {
      minDistance = distMeters;
      closest = node;
    }
  }

  return closest;
}

/**
 * Generates a valid GPX file string from a route or segment coordinates.
 */
export function exportToGpx(
  name: string,
  coordinates: [number, number, number?][],
  description?: string
): string {
  const pointsXml = coordinates
    .map(
      ([lng, lat, ele]) =>
        `      <trkpt lat="${lat.toFixed(6)}" lon="${lng.toFixed(6)}">${
          ele !== undefined ? `<ele>${ele.toFixed(1)}</ele>` : ''
        }</trkpt>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Mt Taranaki Trail Coverage - https://ai.studio/build" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(name)}</name>
    <desc>${escapeXml(description || 'Exported from Mt Taranaki Trail Coverage')}</desc>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
${pointsXml}
    </trkseg>
  </trk>
</gpx>`;
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/**
 * Fetches ground elevation in meters for given WGS84 coordinates
 * using the free Open-Meteo Elevation API (90m Copernicus DEM).
 * Falls back to open-elevation if Open-Meteo is unreachable.
 */
export async function fetchElevation(lat: number, lng: number): Promise<number | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4500);

  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/elevation?latitude=${lat.toFixed(6)}&longitude=${lng.toFixed(6)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (
      Array.isArray(data.elevation) &&
      data.elevation.length > 0 &&
      typeof data.elevation[0] === 'number'
    ) {
      return Math.round(data.elevation[0]);
    }
  } catch {
    // Primary failed or timed out, attempt secondary fallback
  }

  try {
    const fbController = new AbortController();
    const fbTimeoutId = setTimeout(() => fbController.abort(), 3500);
    const fbRes = await fetch(
      `https://api.open-elevation.com/api/v1/lookup?locations=${lat.toFixed(6)},${lng.toFixed(6)}`,
      { signal: fbController.signal }
    );
    clearTimeout(fbTimeoutId);
    if (!fbRes.ok) return null;
    const fbData = await fbRes.json();
    if (Array.isArray(fbData.results) && fbData.results.length > 0) {
      return Math.round(fbData.results[0].elevation);
    }
  } catch {
    // Both failed
  }

  return null;
}

/**
 * Returns a human-friendly display label for a node, handling unnamed junctions
 * and unnamed waypoints gracefully.
 */
export function getNodeDisplayName(node?: { name?: string; type?: string; elevation?: number } | null): string {
  if (!node) return 'Waypoint';
  if (node.name && node.name.trim()) {
    return node.name.trim();
  }
  if (node.type === 'junction') {
    return 'Unnamed Junction';
  }
  const typeLabel = node.type ? node.type.replace(/_/g, ' ') : 'waypoint';
  const capitalized = typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1);
  return `Unnamed ${capitalized}`;
}
