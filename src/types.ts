export type NodeType = 
  | 'hut'
  | 'summit'
  | 'junction'
  | 'lookout'
  | 'carpark'
  | 'bridge'
  | 'water_source';

export interface TrailNode {
  id: string;
  name: string;
  type: NodeType;
  lat: number;
  lng: number;
  elevation: number; // in meters
  notes?: string;
  visited?: boolean;
  visitedAt?: string;
  regionId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompletionRecord {
  id: string;
  segmentId: string;
  date: string;
  durationMinutes?: number;
  notes?: string;
  rating?: number; // 1-5
  weather?: string;
}

export interface TrailSegment {
  id: string;
  name: string;
  startNodeId: string;
  endNodeId: string;
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  // GeoJSON coordinate array: [lng, lat, elevation?]
  coordinates: [number, number, number?][];
  completed: boolean;
  completedAt?: string;
  completionCount: number;
  completions: CompletionRecord[];
  notes?: string;
  difficulty?: 'easy' | 'moderate' | 'challenging' | 'expert';
  surface?: 'track' | 'boardwalk' | 'scree' | 'poled_route' | 'road';
  regionId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SavedRoute {
  id: string;
  name: string;
  description?: string;
  segmentIds: string[];
  totalDistanceKm: number;
  totalGainM: number;
  totalLossM: number;
  estimatedHours: number;
  notes?: string;
  createdAt: string;
  regionId: string;
}

export interface Region {
  id: string;
  name: string;
  center: [number, number]; // [lng, lat]
  zoom: number;
  bounds?: [[number, number], [number, number]]; // [[minLng, minLat], [maxLng, maxLat]]
  description: string;
}

export interface GpxParsedTrack {
  name: string;
  points: {
    lat: number;
    lng: number;
    ele: number;
    time?: string;
  }[];
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  minElevationM: number;
  maxElevationM: number;
}

export type MapLayerStyle = 'topo' | 'cyclosm' | 'osm' | 'satellite';

export interface AppSettings {
  mapboxToken: string;
  mapStyle: MapLayerStyle;
  fogOfWarEnabled: boolean;
  supabaseUrl: string;
  supabaseKey: string;
  elevationUnit: 'm' | 'ft';
  distanceUnit: 'km' | 'mi';
}
