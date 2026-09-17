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
 * Uses a median filter and an accumulated threshold to filter noise.
 */
export function calculateElevationStats(segments: { ele: number }[][]): {
  gain: number;
  loss: number;
  rawGain: number;
  smoothedGain: number;
  minEle: number;
  maxEle: number;
  validCount: number;
  totalCount: number;
} {
  let totalGain = 0;
  let totalLoss = 0;
  let totalRawGain = 0;
  let minEle = Infinity;
  let maxEle = -Infinity;
  let validCount = 0;
  let totalCount = 0;

  const threshold = 1; // 1m accumulated threshold (more sensitive to small gains)

  for (const segment of segments) {
    if (segment.length === 0) continue;
    
    const elevations = segment.map(p => p.ele);
    const smoothedElevations = medianFilter(elevations, 5);

    // Raw Gain (on unfiltered data)
    for (let i = 1; i < elevations.length; i++) {
      totalCount++;
      if (!isNaN(elevations[i])) {
        validCount++;
        if (elevations[i] < minEle) minEle = elevations[i];
        if (elevations[i] > maxEle) maxEle = elevations[i];
      }
      
      const diff = elevations[i] - elevations[i - 1];
      if (diff > 0 && !isNaN(diff)) totalRawGain += diff;
    }
    
    // Add the first point of segment to counts if not handled
    if (elevations.length > 0) {
      if (totalCount === 0 || elevations.length === segment.length) {
         // This is a bit messy because of the loop above. 
         // Let's refine.
      }
    }

    // Accumulate stats properly
    let anchorEle = smoothedElevations[0];
    for (let i = 1; i < smoothedElevations.length; i++) {
      const current = smoothedElevations[i];
      const diff = current - anchorEle;

      if (Math.abs(diff) >= threshold) {
        if (diff > 0) totalGain += diff;
        else totalLoss += Math.abs(diff);
        anchorEle = current;
      }
    }
  }

  // Fix counts
  validCount = 0;
  totalCount = 0;
  for (const seg of segments) {
    for (const p of seg) {
      totalCount++;
      if (!isNaN(p.ele) && p.ele !== 0) { // Assuming 0 might be missing in some contexts, but GPX usually has it.
        validCount++;
        if (p.ele < minEle) minEle = p.ele;
        if (p.ele > maxEle) maxEle = p.ele;
      }
    }
  }

  return {
    gain: Math.round(totalGain),
    loss: Math.round(totalLoss),
    rawGain: Math.round(totalRawGain),
    smoothedGain: Math.round(totalGain),
    minEle: minEle === Infinity ? 0 : Math.round(minEle),
    maxEle: maxEle === -Infinity ? 0 : Math.round(maxEle),
    validCount,
    totalCount,
  };
}

function medianFilter(data: number[], windowSize: number = 5): number[] {
  if (data.length === 0) return [];
  const result = new Array(data.length);
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(data.length - 1, i + halfWindow);
    const window = data.slice(start, end + 1).sort((a, b) => a - b);
    const mid = Math.floor(window.length / 2);
    if (window.length % 2 === 0) {
      result[i] = (window[mid - 1] + window[mid]) / 2;
    } else {
      result[i] = window[mid];
    }
  }
  return result;
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

  // Handle namespaces
  const ns = 'http://www.topografix.com/GPX/1/1';
  const getElements = (name: string, parent: Element | Document = xmlDoc) => {
    let elms = Array.from(parent.getElementsByTagNameNS(ns, name));
    if (elms.length === 0) {
      elms = Array.from(parent.getElementsByTagName(name));
    }
    return elms;
  };

  const trks = getElements('trk');
  let name = 'Imported GPX Track';
  if (trks.length > 0) {
    const nameEl = getElements('name', trks[0])[0];
    if (nameEl && nameEl.textContent) name = nameEl.textContent.trim();
  }

  const allPoints: { lat: number; lng: number; ele: number; time?: string }[] = [];
  const segments: { lat: number; lng: number; ele: number; time?: string }[][] = [];

  for (const trk of trks) {
    const trksegs = getElements('trkseg', trk);
    for (const trkseg of trksegs) {
      const currentSegment: { lat: number; lng: number; ele: number; time?: string }[] = [];
      const trkpts = getElements('trkpt', trkseg);
      
      for (const pt of trkpts) {
        const lat = parseFloat(pt.getAttribute('lat') || '0');
        const lng = parseFloat(pt.getAttribute('lon') || '0');
        
        let ele = NaN;
        const eleNode = getElements('ele', pt)[0];
        if (eleNode && eleNode.textContent) {
          ele = parseFloat(eleNode.textContent);
        }

        const point = { 
          lat, 
          lng, 
          ele: isNaN(ele) ? 0 : ele, 
          time: getElements('time', pt)[0]?.textContent || undefined 
        };
        currentSegment.push(point);
        allPoints.push(point);
      }
      if (currentSegment.length > 0) {
        segments.push(currentSegment);
      }
    }
  }

  if (allPoints.length === 0) {
    throw new Error('No track points (<trkpt>) found in GPX file.');
  }

  // Elevation Stats
  const stats = calculateElevationStats(segments);

  const distanceKm = segments.reduce((total, seg) => {
    const coords: [number, number, number?][] = seg.map(p => [p.lng, p.lat, p.ele]);
    return total + calculateCoordinatesDistanceKm(coords);
  }, 0);

  return {
    name,
    points: allPoints,
    segments,
    distanceKm: Math.round(distanceKm * 100) / 100,
    elevationGainM: stats.gain,
    elevationLossM: stats.loss,
    rawElevationGainM: stats.rawGain,
    smoothedElevationGainM: stats.smoothedGain,
    minElevationM: stats.minEle,
    maxElevationM: stats.maxEle,
    pointCount: stats.totalCount,
    validElevationCount: stats.validCount,
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
 * Finds nodes that are near the given track points and orders them by their position on the track.
 */
export function findNodesAlongTrack(
  points: { lat: number; lng: number }[],
  nodes: TrailNode[],
  thresholdMeters = 20
): { node: TrailNode; index: number; distanceM: number }[] {
  const matched: { node: TrailNode; index: number; distanceM: number }[] = [];

  for (const node of nodes) {
    let minDistance = Infinity;
    let closestIndex = -1;

    for (let i = 0; i < points.length; i++) {
      const dist = calculateDistanceKm(node.lat, node.lng, points[i].lat, points[i].lng) * 1000;
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = i;
      }
    }

    if (minDistance <= thresholdMeters) {
      matched.push({ node, index: closestIndex, distanceM: minDistance });
    }
  }

  // Sort by index along the track
  return matched.sort((a, b) => a.index - b.index);
}

/**
 * Slices a track between two indices and calculates metrics.
 */
export function getTrackSegmentSlice(
  points: { lat: number; lng: number; ele: number }[],
  startIndex: number,
  endIndex: number
): {
  coordinates: [number, number, number?][];
  distanceKm: number;
  gainM: number;
  lossM: number;
} {
  const slice = points.slice(startIndex, endIndex + 1);
  const coords: [number, number, number?][] = slice.map(p => [p.lng, p.lat, p.ele]);
  
  const distanceKm = calculateCoordinatesDistanceKm(coords);
  const stats = calculateElevationStats([slice]);

  return {
    coordinates: coords,
    distanceKm,
    gainM: stats.gain,
    lossM: stats.loss,
  };
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
export function getNodeDisplayName(node?: { name?: string; type?: string; elevation?: number; nodeNumber?: number } | null): string {
  if (!node) return 'Waypoint';
  
  // 1. For non-junctions (landmarks), prioritize the actual name
  if (node.type !== 'junction' && node.name && node.name.trim()) {
    return node.name.trim();
  }

  // 2. Prioritize node number for junctions or if no name exists
  if (node.nodeNumber) {
    return node.nodeNumber.toString();
  }

  // 3. Fallback to name if it exists (for junctions with names)
  if (node.name && node.name.trim()) {
    return node.name.trim();
  }
  
  // 4. Other types get their type name
  if (node.type) {
    const typeLabel = node.type.replace(/_/g, ' ');
    if ((typeLabel === 'summit' || typeLabel === 'lookout') && node.elevation) {
      return `Spot Height ${node.elevation}m`;
    }
    return typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1);
  }

  return 'Waypoint';
}

/**
 * Returns a human-friendly display label for a segment.
 * Strictly "Number to Number" format based on node numbers.
 */
export function getSegmentDisplayName(
  segment: TrailSegment,
  nodes: TrailNode[]
): string {
  const startNode = nodes.find(n => n.id === segment.startNodeId);
  const endNode = nodes.find(n => n.id === segment.endNodeId);

  const startName = startNode?.nodeNumber ? startNode.nodeNumber.toString() : 'Start';
  const endName = endNode?.nodeNumber ? endNode.nodeNumber.toString() : 'End';

  return `${startName} to ${endName}`;
}
