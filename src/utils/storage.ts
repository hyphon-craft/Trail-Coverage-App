import { AppSettings, Region, SavedRoute, TrailNode, TrailSegment } from '../types';
import { INITIAL_NODES, INITIAL_REGIONS, INITIAL_SAVED_ROUTES, INITIAL_SEGMENTS } from '../data/taranakiData';

const STORAGE_KEYS = {
  REGIONS: 'taranaki_trail_regions_v2',
  ACTIVE_REGION: 'taranaki_trail_active_region_v2',
  NODES: 'taranaki_trail_nodes_v2',
  SEGMENTS: 'taranaki_trail_segments_v2',
  ROUTES: 'taranaki_trail_routes_v2',
  SETTINGS: 'taranaki_trail_settings_v2',
};

// Ensure any previously seeded sample data is wiped for a clean slate
if (typeof window !== 'undefined') {
  try {
    const cleared = localStorage.getItem('taranaki_trail_wiped_seed_v2');
    if (!cleared) {
      localStorage.removeItem('taranaki_trail_nodes_v1');
      localStorage.removeItem('taranaki_trail_segments_v1');
      localStorage.removeItem('taranaki_trail_routes_v1');
      localStorage.removeItem(STORAGE_KEYS.NODES);
      localStorage.removeItem(STORAGE_KEYS.SEGMENTS);
      localStorage.removeItem(STORAGE_KEYS.ROUTES);
      localStorage.setItem('taranaki_trail_wiped_seed_v2', 'true');
    }
  } catch (e) {
    console.error('Storage wipe check error', e);
  }
}

export const DEFAULT_SETTINGS: AppSettings = {
  mapboxToken: '',
  mapStyle: 'topo',
  fogOfWarEnabled: false,
  supabaseUrl: '',
  supabaseKey: '',
  elevationUnit: 'm',
  distanceUnit: 'km',
};

export function loadStoredRegions(): Region[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.REGIONS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load regions from storage', e);
  }
  return INITIAL_REGIONS;
}

export function saveStoredRegions(regions: Region[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.REGIONS, JSON.stringify(regions));
  } catch (e) {
    console.error('Failed to save regions', e);
  }
}

export function loadStoredNodes(): TrailNode[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.NODES);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load nodes from storage', e);
  }
  return INITIAL_NODES;
}

export function saveStoredNodes(nodes: TrailNode[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.NODES, JSON.stringify(nodes));
  } catch (e) {
    console.error('Failed to save nodes', e);
  }
}

export function loadStoredSegments(): TrailSegment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SEGMENTS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load segments from storage', e);
  }
  return INITIAL_SEGMENTS;
}

export function saveStoredSegments(segments: TrailSegment[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SEGMENTS, JSON.stringify(segments));
  } catch (e) {
    console.error('Failed to save segments', e);
  }
}

export function loadStoredRoutes(): SavedRoute[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ROUTES);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load routes from storage', e);
  }
  return INITIAL_SAVED_ROUTES;
}

export function saveStoredRoutes(routes: SavedRoute[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ROUTES, JSON.stringify(routes));
  } catch (e) {
    console.error('Failed to save routes', e);
  }
}

export function loadStoredSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.mapStyle === 'opentopo') {
        parsed.mapStyle = 'topo';
      }
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.error('Failed to load settings', e);
  }
  return DEFAULT_SETTINGS;
}

export function saveStoredSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings', e);
  }
}

export function exportBackupData(): string {
  const data = {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    regions: loadStoredRegions(),
    nodes: loadStoredNodes(),
    segments: loadStoredSegments(),
    routes: loadStoredRoutes(),
    settings: loadStoredSettings(),
  };
  return JSON.stringify(data, null, 2);
}

export function resetToDefaults(): {
  nodes: TrailNode[];
  segments: TrailSegment[];
  routes: SavedRoute[];
  regions: Region[];
} {
  saveStoredNodes(INITIAL_NODES);
  saveStoredSegments(INITIAL_SEGMENTS);
  saveStoredRoutes(INITIAL_SAVED_ROUTES);
  saveStoredRegions(INITIAL_REGIONS);
  return {
    nodes: INITIAL_NODES,
    segments: INITIAL_SEGMENTS,
    routes: INITIAL_SAVED_ROUTES,
    regions: INITIAL_REGIONS,
  };
}

export function clearAllData(): {
  nodes: TrailNode[];
  segments: TrailSegment[];
  routes: SavedRoute[];
} {
  saveStoredNodes([]);
  saveStoredSegments([]);
  saveStoredRoutes([]);
  return {
    nodes: [],
    segments: [],
    routes: [],
  };
}
