export type NodeType = 
  | 'hut'
  | 'summit'
  | 'junction'
  | 'lookout'
  | 'carpark'
  | 'bridge'
  | 'waterfall';

export interface TrailNode {
  id: string;
  name: string;
  type: NodeType;
  lat: number;
  lng: number;
  elevation: number; // in meters
  nodeNumber?: number; // Unique number for all nodes
  notes?: string;
  regionId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TrailSegment {
  id: string;
  name: string;
  startNodeId: string;
  endNodeId: string;
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  difficulty?: 'easy' | 'moderate' | 'hard' | 'expert';
  surface?: 'gravel' | 'dirt' | 'paved' | 'technical';
  // GeoJSON coordinate array: [lng, lat, elevation?]
  coordinates: [number, number, number?][];
  notes?: string;
  regionId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompletionRecord {
  id: string;
  routeId?: string;
  segmentIds: string[];
  completedAt: string;
  notes?: string;
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
  completed: boolean;
  completedAt?: string;
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
  segments: {
    lat: number;
    lng: number;
    ele: number;
    time?: string;
  }[][];
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  rawElevationGainM: number;
  smoothedElevationGainM: number;
  minElevationM: number;
  maxElevationM: number;
  pointCount: number;
  validElevationCount: number;
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
  showNodes: boolean;
  landmarkFilters: string[];
  segmentFilter: 'all' | 'completed' | 'uncompleted';
}
