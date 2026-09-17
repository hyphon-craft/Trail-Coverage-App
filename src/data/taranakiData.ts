import { Region, TrailNode, TrailSegment, SavedRoute } from '../types';
import defaultData from './default_trail_data.json';

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
    description: 'Stratovolcano in Taranaki, New Zealand. View the comprehensive network of mapped trails and your completed routes.',
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

// Load synced data as defaults
export const INITIAL_NODES: TrailNode[] = (defaultData as any).nodes || [];
export const INITIAL_SEGMENTS: TrailSegment[] = (defaultData as any).segments || [];
export const INITIAL_SAVED_ROUTES: SavedRoute[] = (defaultData as any).savedRoutes || [];
