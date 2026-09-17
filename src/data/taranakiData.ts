import { Region, TrailNode, TrailSegment, SavedRoute } from '../types';

export const INITIAL_REGIONS: Region[] = [
  {
    id: 'taranaki',
    name: 'Mt Taranaki / Egmont National Park',
    center: [174.0640, -39.2963],
    zoom: 12.2,
    bounds: [
      [173.92, -39.38],
      [174.20, -39.20],
    ],
    description: 'Stratovolcano in Taranaki, New Zealand. Upload your own GPS tracks and place field waypoints to map your personal network coverage.',
  },
  {
    id: 'tongariro',
    name: 'Tongariro National Park',
    center: [175.5645, -39.2804],
    zoom: 11.5,
    description: 'Central Plateau volcanic landscape and alpine crossings.',
  },
  {
    id: 'arthurs_pass',
    name: "Arthur's Pass National Park",
    center: [171.5583, -42.9427],
    zoom: 11.0,
    description: 'Southern Alps mountain passes, river valleys, and alpine routes.',
  },
];

// Completely empty initial registries for user to upload and build manually
export const INITIAL_NODES: TrailNode[] = [];
export const INITIAL_SEGMENTS: TrailSegment[] = [];
export const INITIAL_SAVED_ROUTES: SavedRoute[] = [];
