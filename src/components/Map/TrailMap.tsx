import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AppSettings, Region, TrailNode, TrailSegment, GpxParsedTrack } from '../../types';
import { getNodeDisplayName, getSegmentDisplayName } from '../../utils/geo';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  Crosshair,
  Layers,
  Map as MapIcon,
  X
} from 'lucide-react';

interface TrailMapProps {
  settings: AppSettings;
  activeRegion: Region;
  nodes: TrailNode[];
  segments: TrailSegment[];
  selectedSegmentId: string | null;
  onSelectSegment: (segmentId: string | null) => void;
  selectedNodeId: string | null;
  onSelectNode: (node: TrailNode | null) => void;
  onOpenNodeEdit?: (node: TrailNode) => void;
  onDeleteNode?: (nodeId: string) => void;
  onMapClickCoordinates?: (coords: { lat: number; lng: number }) => void;
  isAddingNodeMode: boolean;
  onCancelAddNode?: () => void;
  activeRouteSegmentIds: string[];
  highlightedRouteSegmentIds: string[];
  plannerLastNodeId?: string | null;
  activeTab?: string;
  gpxPreviewTrack: GpxParsedTrack | null;
  completedSegmentIds: string[];
}

// Free, open-source tile layer configurations matching DOC / Topo50 standards
const TILE_PROVIDERS: Record<string, { url: string; options: L.TileLayerOptions }> = {
  topo: {
    // ESRI World Topo: Topographic contours and mountain relief
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    options: {
      maxNativeZoom: 18,
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri &mdash; Topographic mountain relief',
    },
  },
  cyclosm: {
    // CyclOSM: Detailed outdoor & cycling topographic relief
    url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
    options: {
      subdomains: ['a', 'b', 'c'],
      maxNativeZoom: 18,
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.cyclosm.org" target="_blank" rel="noreferrer">CyclOSM</a>, &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    },
  },
  osm: {
    // OpenStreetMap standard street and outdoor cartography
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      maxNativeZoom: 19,
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    },
  },
  satellite: {
    // ESRI World Imagery: High-resolution aerial satellite imagery
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: {
      maxNativeZoom: 18,
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri &mdash; Aerial Imagery',
    },
  },
};

function resolveTileProvider(style: string) {
  if (style === 'cyclosm') return TILE_PROVIDERS.cyclosm;
  if (style === 'osm') return TILE_PROVIDERS.osm;
  if (style === 'satellite') return TILE_PROVIDERS.satellite;
  return TILE_PROVIDERS.topo;
}

export const TrailMap: React.FC<TrailMapProps> = ({
  settings,
  activeRegion,
  nodes,
  segments,
  selectedSegmentId,
  onSelectSegment,
  selectedNodeId,
  onSelectNode,
  onOpenNodeEdit,
  onDeleteNode,
  onMapClickCoordinates,
  isAddingNodeMode,
  onCancelAddNode,
  activeRouteSegmentIds,
  highlightedRouteSegmentIds,
  plannerLastNodeId,
  activeTab,
  gpxPreviewTrack,
  completedSegmentIds,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  
  // Layer Groups for clean atomic updates
  const segmentsLayerRef = useRef<L.LayerGroup | null>(null);
  const routePreviewLayerRef = useRef<L.LayerGroup | null>(null);
  const highlightedRouteLayerRef = useRef<L.LayerGroup | null>(null);
  const gpxLayerRef = useRef<L.LayerGroup | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Live GIS coordinate tracking
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lng: number; zoom: number } | null>(null);

  // Keep latest refs for click handlers to prevent stale closures
  const isAddingNodeModeRef = useRef(isAddingNodeMode);
  isAddingNodeModeRef.current = isAddingNodeMode;

  const onMapClickCoordinatesRef = useRef(onMapClickCoordinates);
  onMapClickCoordinatesRef.current = onMapClickCoordinates;

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Convert GeoJSON [lng, lat] to Leaflet [lat, lng]
    const initialCenter: [number, number] = [activeRegion.center[1], activeRegion.center[0]];

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: activeRegion.zoom,
      maxZoom: 19,
      zoomControl: false, // We provide custom styled compact controls
      attributionControl: true,
      preferCanvas: true, // Maximizes vector rendering performance
    });

    // Custom metric scale control
    L.control.scale({
      metric: true,
      imperial: false,
      maxWidth: 120,
      position: 'bottomleft',
    }).addTo(map);

    // Create Layer Groups
    segmentsLayerRef.current = L.layerGroup().addTo(map);
    routePreviewLayerRef.current = L.layerGroup().addTo(map);
    highlightedRouteLayerRef.current = L.layerGroup().addTo(map);
    gpxLayerRef.current = L.layerGroup().addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);

    // Track live cursor coordinates for GIS status bar
    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      setCursorCoords({
        lat: e.latlng.lat,
        lng: e.latlng.lng,
        zoom: Math.round(map.getZoom() * 10) / 10,
      });
    });

    // Handle map clicks (e.g. for adding new nodes) via ref to prevent stale closures
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (isAddingNodeModeRef.current && onMapClickCoordinatesRef.current) {
        onMapClickCoordinatesRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
      } else {
        // Clear selections when clicking map background
        onSelectSegment(null);
        onSelectNode(null);
      }
    });

    mapRef.current = map;
    setMapInstance(map);

    return () => {
      map.remove();
      mapRef.current = null;
      setMapInstance(null);
    };
  }, [activeRegion.id]);

  // Handle auto resize observer so the map never blanks out or clips
  useEffect(() => {
    if (!mapContainerRef.current || !mapInstance) return;

    const resizeObserver = new ResizeObserver(() => {
      mapInstance.invalidateSize();
    });

    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [mapInstance]);

  // Apply crosshair cursor cleanly to Leaflet container DOM without triggering React class clobbering
  useEffect(() => {
    if (!mapInstance) return;
    const container = mapInstance.getContainer();
    if (isAddingNodeMode) {
      container.classList.add('cursor-crosshair');
    } else {
      container.classList.remove('cursor-crosshair');
    }
    mapInstance.invalidateSize();
  }, [isAddingNodeMode, mapInstance]);

  // Global Escape key handler to cancel adding a node
  useEffect(() => {
    if (!isAddingNodeMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancelAddNode?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAddingNodeMode, onCancelAddNode]);

  // Update Tile Layer when mapInstance or settings.mapStyle changes
  useEffect(() => {
    if (!mapInstance) return;

    // Remove existing tile layer if present
    if (tileLayerRef.current) {
      mapInstance.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    const providerConfig = resolveTileProvider(settings.mapStyle);
    
    // Create new tile layer
    const newTileLayer = L.tileLayer(providerConfig.url, {
      ...providerConfig.options,
    });

    // Per-tile graceful fallback to ESRI Topo without resetting the whole layer
    newTileLayer.on('tileerror', (errorEvent: any) => {
      const tile = errorEvent.tile;
      if (tile && !tile.dataset.fallbackApplied) {
        tile.dataset.fallbackApplied = 'true';
        const coords = errorEvent.coords;
        if (coords) {
          tile.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/${coords.z}/${coords.y}/${coords.x}`;
        }
      }
    });

    newTileLayer.addTo(mapInstance);
    tileLayerRef.current = newTileLayer;

    return () => {
      if (tileLayerRef.current && mapInstance) {
        mapInstance.removeLayer(tileLayerRef.current);
        tileLayerRef.current = null;
      }
    };
  }, [mapInstance, settings.mapStyle]);

  // Render Trail Segments (Casing + Core Polyline + Interactions)
  useEffect(() => {
    if (!segmentsLayerRef.current) return;
    const layerGroup = segmentsLayerRef.current;
    layerGroup.clearLayers();

    let regionSegments = segments.filter((s) => s.regionId === activeRegion.id);

    // Apply completion filter
    if (settings.segmentFilter === 'completed') {
      regionSegments = regionSegments.filter(s => completedSegmentIds.includes(s.id));
    } else if (settings.segmentFilter === 'uncompleted') {
      regionSegments = regionSegments.filter(s => !completedSegmentIds.includes(s.id));
    }

    regionSegments.forEach((seg) => {
      if (!seg.coordinates || seg.coordinates.length < 2) return;

      // Convert GeoJSON [lng, lat] pairs to Leaflet [lat, lng]
      const latLngs: [number, number][] = seg.coordinates.map((coord) => [coord[1], coord[0]]);
      const isSelected = seg.id === selectedSegmentId;
      const isCompleted = completedSegmentIds.includes(seg.id);
      const isCompletedOnce = isCompleted; // We simplified completion to be route-based

      // Outer Casing line for clean contrast on topographic / aerial basemaps
      const casing = L.polyline(latLngs, {
        color: isSelected ? '#1A1A1A' : '#FFFFFF',
        weight: isSelected ? 6.5 : (isCompleted ? 5 : 4),
        opacity: isSelected ? 0.95 : (isCompleted ? 0.85 : (settings.fogOfWarEnabled ? 0.3 : 0.8)),
        lineCap: 'round',
        lineJoin: 'round',
      });

      // Base track line: always dark grey and dotted to represent the physical path
      const baseTrack = L.polyline(latLngs, {
        color: '#1A1A1A', // Much Darker Grey
        weight: 2.5,
        opacity: settings.fogOfWarEnabled && !isCompleted && !isSelected ? 0.25 : 0.8,
        dashArray: '4, 4',
        lineCap: 'round',
        lineJoin: 'round',
      });

      // Completion / Selection Overlay
      let overlayColor: string | null = null;
      if (isCompleted) {
        overlayColor = isCompletedOnce ? '#00FF00' : '#10B981';
      }
      if (isSelected) {
        overlayColor = '#D97706'; // Selection takes priority for color
      }

      const core = L.polyline(latLngs, {
        color: overlayColor || 'transparent',
        weight: isSelected ? 4.5 : 3.5,
        opacity: overlayColor ? 1.0 : 0,
        lineCap: 'round',
        lineJoin: 'round',
      });

      const displayName = getSegmentDisplayName(seg, nodes);

      // Tooltip for track name and distance
      const tooltipContent = `
        <div class="px-2.5 py-1.5 text-xs font-sans">
          <div class="font-bold text-[#1A1A1A] flex items-center gap-1.5">
            <span>${displayName}</span>
            ${isCompleted ? '<span class="text-[10px] text-[#2D6A4F] font-mono">✓</span>' : ''}
          </div>
          <div class="text-[11px] font-mono text-[#2B2B2B] mt-0.5">
            <span>${seg.distanceKm.toFixed(1)} km</span> · 
            <span>+${seg.elevationGainM}m</span> · 
            <span class="${isCompleted ? 'text-[#2D6A4F] font-semibold' : 'text-[#6C757D]'}">${isCompleted ? 'Completed' : 'Unexplored'}</span>
          </div>
        </div>
      `;

      casing.bindTooltip(tooltipContent, {
        sticky: true,
        direction: 'top',
        opacity: 0.98,
      });

      // Interactivity
      const handleClick = (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        onSelectSegment(seg.id);
      };

      const handleMouseOver = () => {
        casing.setStyle({ weight: 8, opacity: 1.0 });
        if (!isSelected) {
          core.setStyle({ weight: 4.5 });
        }
      };

      const handleMouseOut = () => {
        casing.setStyle({ weight: isSelected ? 6.5 : (isCompleted ? 5 : 4), opacity: isSelected ? 0.9 : 0.85 });
        if (!isSelected) {
          core.setStyle({ weight: 3.5 });
          baseTrack.setStyle({ weight: 2.5 });
        }
      };

      casing.on('click', handleClick);
      core.on('click', handleClick);
      baseTrack.on('click', handleClick);
      casing.on('mouseover', handleMouseOver);
      core.on('mouseover', handleMouseOver);
      baseTrack.on('mouseover', handleMouseOver);
      casing.on('mouseout', handleMouseOut);
      core.on('mouseout', handleMouseOut);
      baseTrack.on('mouseout', handleMouseOut);

      layerGroup.addLayer(casing);
      layerGroup.addLayer(baseTrack);
      layerGroup.addLayer(core);
    });
  }, [segments, selectedSegmentId, settings.fogOfWarEnabled, activeRegion.id, completedSegmentIds, settings.segmentFilter]);

  // Render Active Route Builder Preview Polyline (Planned Route: #1971C2)
  useEffect(() => {
    if (!routePreviewLayerRef.current) return;
    const layerGroup = routePreviewLayerRef.current;
    layerGroup.clearLayers();

    if (activeRouteSegmentIds.length === 0) return;

    const routeSegments = segments.filter((s) => activeRouteSegmentIds.includes(s.id));

    routeSegments.forEach((seg) => {
      if (!seg.coordinates || seg.coordinates.length < 2) return;
      const latLngs: [number, number][] = seg.coordinates.map((c) => [c[1], c[0]]);

      const casing = L.polyline(latLngs, {
        color: '#FFFFFF',
        weight: 6.5,
        opacity: 0.95,
        lineCap: 'round',
      });

      const core = L.polyline(latLngs, {
        color: '#0D47A1', // Darker Planned Route Blue
        weight: 4.5,
        opacity: 1.0,
        lineCap: 'round',
      });

      layerGroup.addLayer(casing);
      layerGroup.addLayer(core);
    });
  }, [activeRouteSegmentIds, segments]);

  // Render Highlighted Saved Route (Discovery: #D97706)
  useEffect(() => {
    if (!highlightedRouteLayerRef.current || !mapRef.current) return;
    const layerGroup = highlightedRouteLayerRef.current;
    layerGroup.clearLayers();

    if (highlightedRouteSegmentIds.length === 0) return;

    const routeSegments = segments.filter((s) => highlightedRouteSegmentIds.includes(s.id));
    const allLatLngs: [number, number][] = [];

    routeSegments.forEach((seg) => {
      if (!seg.coordinates || seg.coordinates.length < 2) return;
      const latLngs: [number, number][] = seg.coordinates.map((c) => [c[1], c[0]]);
      allLatLngs.push(...latLngs);

      const casing = L.polyline(latLngs, {
        color: '#1A1A1A',
        weight: 8,
        opacity: 0.9,
        lineCap: 'round',
      });

      const core = L.polyline(latLngs, {
        color: '#D97706', // High-contrast Discovery Orange/Gold
        weight: 5,
        opacity: 1.0,
        lineCap: 'round',
      });

      layerGroup.addLayer(casing);
      layerGroup.addLayer(core);
    });

    // Auto-zoom to highlighted route
    if (allLatLngs.length > 0) {
      const bounds = L.latLngBounds(allLatLngs);
      mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [highlightedRouteSegmentIds, segments]);

  // Render GPX Upload Preview Track (GPX Preview: #E9C46A)
  useEffect(() => {
    if (!gpxLayerRef.current || !mapRef.current) return;
    const layerGroup = gpxLayerRef.current;
    layerGroup.clearLayers();

    if (!gpxPreviewTrack || gpxPreviewTrack.points.length < 2) return;

    const latLngs: [number, number][] = gpxPreviewTrack.points.map((p) => [p.lat, p.lng]);

    const casing = L.polyline(latLngs, {
      color: '#1A1A1A',
      weight: 6,
      opacity: 0.9,
    });

    const core = L.polyline(latLngs, {
      color: '#E9C46A', // GPX Preview Gold
      weight: 4,
      dashArray: '5, 4',
      opacity: 1.0,
    });

    layerGroup.addLayer(casing);
    layerGroup.addLayer(core);

    // Zoom map to fit GPX track bounds
    const bounds = L.latLngBounds(latLngs);
    mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [gpxPreviewTrack]);

  // Render Waypoint Markers with Cartographic Symbology
  useEffect(() => {
    if (!markersLayerRef.current) return;
    const layerGroup = markersLayerRef.current;
    layerGroup.clearLayers();

    if (!settings.showNodes) return;

    let regionNodes = nodes.filter((n) => n.regionId === activeRegion.id);

    // Apply landmark type filters if active
    const activeFilters = settings.landmarkFilters || [];
    if (activeFilters.length > 0) {
      regionNodes = regionNodes.filter(n => activeFilters.includes(n.type));
    }

    regionNodes.forEach((node) => {
      let iconInnerHtml = '';
      const isSelected = node.id === selectedNodeId;
      const isPlannerActive = activeTab === 'planner';
      const isPlannerHead = isPlannerActive && node.id === plannerLastNodeId;
      
      // Find if this node is a neighbor of the planner head
      const isNeighbor = isPlannerActive && plannerLastNodeId && !isPlannerHead && segments.some(s => 
        (s.startNodeId === plannerLastNodeId && s.endNodeId === node.id) ||
        (s.startNodeId === node.id && s.endNodeId === plannerLastNodeId)
      );

      const dimClass = settings.fogOfWarEnabled && !isSelected && !isPlannerHead && !isNeighbor ? 'opacity-40' : 'opacity-100';

      const ringColor = isSelected ? '#F4A261' : (isPlannerHead ? '#1971C2' : (isNeighbor ? '#74C69D' : null));
      const ringClass = ringColor ? `ring-2 ring-[${ringColor}]` : '';
      const pulseClass = isPlannerHead ? 'animate-pulse' : '';

      const markerColor = {
        hut: '#5D4037',
        summit: '#7B241C',
        junction: '#1A1A1A',
        carpark: '#0D47A1',
        lookout: '#936300',
        waterfall: '#2E5A88',
        bridge: '#2E5A88',
      }[node.type] || '#1A1A1A';

      iconInnerHtml = `
        <div class="flex flex-col items-center -translate-x-1/2 -translate-y-1/2 ${pulseClass}">
          <div class="w-4 h-4 rounded-full bg-[#1A1A1A] border border-[#FCFBF7] shadow-[0_1px_3px_rgba(0,0,0,0.15)] flex items-center justify-center text-[9px] font-bold text-white" style="${ringColor ? `box-shadow: 0 0 0 2px ${ringColor}; background-color: ${markerColor}` : `background-color: ${markerColor}`}">
            ${node.nodeNumber || ''}
          </div>
        </div>
      `;

      const iconHtml = `<div class="${dimClass} transition-opacity duration-200">${iconInnerHtml}</div>`;

      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: iconHtml,
        iconSize: [24, 24],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([node.lat, node.lng], { icon: customIcon });

      const displayName = getNodeDisplayName(node);
      const isUnnamed = !node.name || !node.name.trim();

      marker.bindTooltip(`
        <div class="px-2.5 py-1 text-xs font-sans">
          <div class="${isUnnamed ? 'font-semibold italic text-[#2B2B2B]' : 'font-bold text-[#1A1A1A]'}">${displayName}</div>
          <div class="text-[10px] font-mono text-[#2B2B2B] mt-0.5">${node.elevation}m · ${node.type.toUpperCase()}</div>
        </div>
      `, {
        direction: 'top',
        offset: [0, -12],
        opacity: 0.98,
      });

      // Clean, native GIS Leaflet Popup (non-modal, does not blur or block the UI)
      const popupContainer = document.createElement('div');
      popupContainer.className = 'font-sans p-2 text-[#1A1A1A] text-xs min-w-[210px] select-none';

      const typeLabels: Record<string, string> = {
        hut: 'Backcountry Hut (⌂)',
        summit: 'Trig Station / Peak (△)',
        lookout: 'Vantage / Tarn (◉)',
        carpark: 'Roadhead / Carpark (P)',
        bridge: 'Bridge / River (≍)',
        waterfall: 'Waterfall / Stream (💧)',
        junction: 'Track Junction (•)',
      };

      popupContainer.innerHTML = `
        <div class="border-b border-[#C5C1B1] pb-2 mb-2">
          <div class="text-[10px] font-mono uppercase tracking-wider text-[#555555] mb-0.5">
            ${typeLabels[node.type] || node.type}
          </div>
          <div class="${isUnnamed ? 'font-semibold italic text-sm text-[#2B2B2B]' : 'font-bold text-sm text-[#1A1A1A]'} leading-tight">${displayName}</div>
          <div class="text-[11px] font-mono text-[#2B2B2B] mt-1 flex items-center justify-between">
            <span>Elevation: <strong>${node.elevation}m</strong></span>
          </div>
          <div class="text-[10px] font-mono text-[#555555] mt-0.5">
            ${node.lat.toFixed(4)}°, ${node.lng.toFixed(4)}°
          </div>
          ${node.notes ? `<div class="text-[11px] text-[#2B2B2B] mt-1.5 bg-[#F5F3EE] p-1.5 rounded-[3px] border border-[#C5C1B1] font-sans">${node.notes}</div>` : ''}
        </div>
        <div class="flex items-center justify-end gap-1.5 pt-0.5">
          <div class="flex items-center gap-1">
            <button id="popup-edit-btn" class="px-2.5 py-1 bg-[#2D6A4F] hover:bg-[#23533E] text-white rounded-[3px] text-[11px] font-mono font-semibold transition-colors">
              Edit
            </button>
            <button id="popup-delete-btn" class="px-2 py-1 text-[#A44A3F] hover:bg-[#FDF2F2] border border-transparent hover:border-[#F87171] rounded-[3px] text-[11px] font-mono transition-colors font-medium" title="Delete waypoint">
              Delete
            </button>
          </div>
        </div>
      `;

      const editBtn = popupContainer.querySelector('#popup-edit-btn');
      if (editBtn && onOpenNodeEdit) {
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          marker.closePopup();
          onOpenNodeEdit(node);
        });
      }

      const deleteBtn = popupContainer.querySelector('#popup-delete-btn') as HTMLButtonElement | null;
      if (deleteBtn && onDeleteNode) {
        let isConfirming = false;
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!isConfirming) {
            isConfirming = true;
            deleteBtn.textContent = 'Sure?';
            deleteBtn.className = 'px-2 py-1 bg-[#A44A3F] text-white rounded-[3px] text-[11px] font-mono font-bold transition-colors';
            setTimeout(() => {
              isConfirming = false;
              deleteBtn.textContent = 'Delete';
              deleteBtn.className = 'px-2 py-1 text-[#A44A3F] hover:bg-[#FDF2F2] border border-transparent hover:border-[#F87171] rounded-[3px] text-[11px] font-mono transition-colors font-medium';
            }, 3500);
          } else {
            marker.closePopup();
            onDeleteNode(node.id);
          }
        });
      }

      marker.bindPopup(popupContainer, {
        offset: [0, -10],
        closeButton: true,
      });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectNode(node);
      });

      layerGroup.addLayer(marker);
    });
  }, [nodes, activeRegion.id, selectedNodeId, settings.fogOfWarEnabled, onSelectNode, onOpenNodeEdit, onDeleteNode, activeTab, plannerLastNodeId, segments, settings.landmarkFilters]);

  // Recenter map view
  const handleResetView = () => {
    if (!mapRef.current) return;
    mapRef.current.setView([activeRegion.center[1], activeRegion.center[0]], activeRegion.zoom);
  };

  return (
    <div className="relative w-full h-full select-none overflow-hidden">
      {/* Leaflet Map Canvas Container - Static DOM element so React never clobbers Leaflet internal classes */}
      <div
        ref={mapContainerRef}
        className="w-full h-full"
        id="trail-leaflet-container"
      />

      {/* Adding Waypoint Mode Banner with Cancel button */}
      {isAddingNodeMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-[#2D6A4F] text-white px-3.5 py-1.5 rounded-[4px] shadow-md border border-[#40916C] flex items-center gap-3 z-30 text-xs font-mono">
          <div className="flex items-center gap-2">
            <Crosshair className="w-3.5 h-3.5 text-[#E9C46A] animate-pulse" />
            <span>Click map to place waypoint</span>
          </div>
          {onCancelAddNode && (
            <button
              onClick={onCancelAddNode}
              className="flex items-center gap-1 bg-black/25 hover:bg-black/40 text-white px-2 py-0.5 rounded-[3px] text-[11px] transition-colors border border-white/20 font-sans cursor-pointer"
              title="Cancel waypoint placement (Esc)"
            >
              <X className="w-3 h-3" />
              <span>Cancel (Esc)</span>
            </button>
          )}
        </div>
      )}

      {/* Floating Minimal Map Controls (Top-Right) */}
      <div className="absolute top-3 right-3 flex flex-col gap-1 z-20">
        <button
          onClick={handleResetView}
          className="w-7 h-7 rounded-[4px] bg-[#FCFBF7]/90 hover:bg-[#FCFBF7] text-[#1A1A1A] hover:text-[#2D6A4F] flex items-center justify-center transition-colors shadow-xs border border-[#D1CDBC]/60"
          title="Recenter quad"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => mapRef.current?.zoomIn()}
          className="w-7 h-7 rounded-[4px] bg-[#FCFBF7]/90 hover:bg-[#FCFBF7] text-[#1A1A1A] hover:text-[#2D6A4F] flex items-center justify-center transition-colors shadow-xs border border-[#D1CDBC]/60"
          title="Zoom in"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => mapRef.current?.zoomOut()}
          className="w-7 h-7 rounded-[4px] bg-[#FCFBF7]/90 hover:bg-[#FCFBF7] text-[#1A1A1A] hover:text-[#2D6A4F] flex items-center justify-center transition-colors shadow-xs border border-[#D1CDBC]/60"
          title="Zoom out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Discreet Cursor Coordinates (Bottom-Right) */}
      {cursorCoords && (
        <div className="absolute bottom-2 right-2 z-10 text-[10px] font-mono text-[#555555] bg-[#FCFBF7]/80 backdrop-blur-[1px] px-1.5 py-0.5 rounded-[3px] pointer-events-none">
          {cursorCoords.lat.toFixed(4)}°, {cursorCoords.lng.toFixed(4)}°
        </div>
      )}
    </div>
  );
};
