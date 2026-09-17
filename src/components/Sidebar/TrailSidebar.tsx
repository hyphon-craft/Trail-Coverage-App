import React, { useState } from 'react';
import { 
  TrailNode, 
  TrailSegment, 
  SavedRoute, 
  AppSettings
} from '../../types';
import { 
  Search, 
  Download, 
  Trash2, 
  Check, 
  ChevronRight,
  Eye,
  Plus,
  X,
  Edit,
  History,
  Clock
} from 'lucide-react';
import { exportToGpx, getNodeDisplayName, getSegmentDisplayName } from '../../utils/geo';

export type SidebarSection = 'coverage' | 'visibility' | 'junctions' | 'landmarks' | 'planner' | 'routes' | 'log' | null;

interface TrailSidebarProps {
  activeTab: SidebarSection;
  onSelectTab: (tab: SidebarSection) => void;
  nodes: TrailNode[];
  segments: TrailSegment[];
  savedRoutes: SavedRoute[];
  activeRegionId: string;
  selectedSegmentId: string | null;
  onSelectSegment: (id: string | null) => void;
  onOpenSegmentDetail: (segment: TrailSegment) => void;
  onOpenNodeEdit: (node: TrailNode) => void;
  onOpenAddNode: () => void;
  isAddingNodeMode?: boolean;
  onCancelAddNode?: () => void;
  onOpenAddSegment: () => void;
  onToggleCompleteRoute: (routeId: string) => void;
  activeRouteSegmentIds: string[];
  onRemoveSegmentFromRoute: (index: number) => void;
  onClearRoute: () => void;
  onSaveRoute: (name: string, description: string, notes: string) => void;
  onDeleteSavedRoute: (routeId: string) => void;
  onHighlightRoute: (segmentIds: string[]) => void;
  highlightedRouteSegmentIds: string[];
  onOpenRouteDetail: (route: SavedRoute) => void;
  onEditRoute: (route: SavedRoute) => void;
  onUpdateRouteTime: (routeId: string, time: string) => void;
  plannerLastNodeId?: string | null;
  isPlanningStarted?: boolean;
  onStartPlanning?: () => void;
  settings: AppSettings;
  onUpdateSettings: (settings: Partial<AppSettings>) => void;
  onOpenGpxUpload?: () => void;
}

export const TrailSidebar: React.FC<TrailSidebarProps> = ({
  activeTab,
  onSelectTab,
  nodes,
  segments,
  savedRoutes,
  activeRegionId,
  selectedSegmentId,
  onSelectSegment,
  onOpenSegmentDetail,
  onOpenNodeEdit,
  onOpenAddNode,
  isAddingNodeMode,
  onCancelAddNode,
  onOpenAddSegment,
  onToggleCompleteRoute,
  activeRouteSegmentIds,
  onRemoveSegmentFromRoute,
  onClearRoute,
  onSaveRoute,
  onDeleteSavedRoute,
  onHighlightRoute,
  highlightedRouteSegmentIds,
  onOpenRouteDetail,
  onEditRoute,
  onUpdateRouteTime,
  plannerLastNodeId,
  isPlanningStarted,
  onStartPlanning,
  settings,
  onUpdateSettings,
  onOpenGpxUpload,
}) => {
  const regionNodes = nodes.filter((n) => n.regionId === activeRegionId);
  const regionRoutes = savedRoutes.filter((r) => r.regionId === activeRegionId);
  const completedRoutes = regionRoutes.filter(r => r.completed);

  // Search & filter states
  const [nodeTypeFilter, setNodeTypeFilter] = useState<string>('all');
  const [nodeSearch, setNodeSearch] = useState('');

  // Route Builder inputs
  const [routeNameInput, setRouteNameInput] = useState('');

  // Coverage metric calculations
  const regionSegments = segments.filter((s) => s.regionId === activeRegionId);
  const totalDistance = regionSegments.reduce((acc, s) => acc + s.distanceKm, 0);
  
  // Calculate completed segments based on completed routes
  const completedSegmentIds = new Set<string>();
  regionRoutes.forEach(route => {
    if (route.completed) {
      route.segmentIds.forEach(id => completedSegmentIds.add(id));
    }
  });

  const completedDistance = regionSegments
    .filter(s => completedSegmentIds.has(s.id))
    .reduce((acc, s) => acc + s.distanceKm, 0);
    
  const coveragePercent = totalDistance > 0 ? (completedDistance / totalDistance) * 100 : 0;
  const remainingDistance = Math.max(0, totalDistance - completedDistance);
  const completedSegmentsCount = regionSegments.filter(s => completedSegmentIds.has(s.id)).length;

  // Route builder totals
  const activeRouteSegments = activeRouteSegmentIds
    .map((id) => segments.find((s) => s.id === id))
    .filter((s): s is TrailSegment => !!s);

  const routeTotalDist = activeRouteSegments.reduce((acc, s) => acc + s.distanceKm, 0);
  const routeTotalGain = activeRouteSegments.reduce((acc, s) => acc + s.elevationGainM, 0);
  const routeTotalLoss = activeRouteSegments.reduce((acc, s) => acc + s.elevationLossM, 0);

  // Toggle open accordion section
  const toggleSection = (section: SidebarSection) => {
    if (activeTab === section) {
      onSelectTab(null);
    } else {
      onSelectTab(section);
    }
  };

  const toggleLandmarkFilter = (type: string) => {
    const prev = settings.landmarkFilters || [];
    const updated = prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type];
    onUpdateSettings({ landmarkFilters: updated });
  };

  const handleSaveCurrentRoute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeNameInput.trim()) return;
    onSaveRoute(routeNameInput.trim(), '', '');
    setRouteNameInput('');
    onSelectTab('routes');
  };

  const handleExportRouteGpx = (route: SavedRoute) => {
    const routeSegments = route.segmentIds
      .map((id) => segments.find((s) => s.id === id))
      .filter(Boolean) as TrailSegment[];
    
    const combinedCoords: [number, number, number?][] = [];
    routeSegments.forEach((s) => {
      combinedCoords.push(...s.coordinates);
    });

    const gpxData = exportToGpx(route.name, combinedCoords, route.description);
    const blob = new Blob([gpxData], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${route.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.gpx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'summit': return '△';
      case 'hut': return '⌂';
      case 'lookout': return '◉';
      case 'carpark': return 'P';
      case 'bridge': return '≍';
      case 'waterfall': return '💧';
      default: return '•';
    }
  };

  return (
    <aside className="w-full h-full bg-[#FCFBF7] flex flex-col text-[#1A1A1A] text-xs select-none overflow-y-auto">
      {/* 1. COVERAGE SECTION */}
      <div className="border-b border-[#C5C1B1]">
        <button
          onClick={() => toggleSection('coverage')}
          className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-[#F5F3EE] transition-colors"
        >
          <span className="font-semibold text-[#1A1A1A]">Coverage</span>
          <div className="flex items-center gap-2">
            <span className="font-mono font-medium text-[#2D6A4F]">{coveragePercent.toFixed(0)}%</span>
            <ChevronRight className={`w-3.5 h-3.5 text-[#555555] transition-transform ${activeTab === 'coverage' ? 'rotate-90' : ''}`} />
          </div>
        </button>

        {activeTab === 'coverage' && (
          <div className="px-3.5 pb-3.5 pt-1 space-y-2">
            {/* Single bold number display */}
            <div className="text-3xl font-mono font-bold text-[#1A1A1A]">
              {coveragePercent.toFixed(1)}%
            </div>
            <div className="text-[11px] text-[#555555] font-mono">
              {completedDistance.toFixed(1)} of {totalDistance.toFixed(1)} km surveyed
            </div>
            <div className="w-full bg-[#C5C1B1] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#2D6A4F] h-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, coveragePercent))}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#555555] pt-1">
              <span>{remainingDistance.toFixed(1)} km remaining</span>
              <span>{completedSegmentsCount}/{regionSegments.length} segments</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. VISIBILITY & FILTERS SECTION */}
      <div className="border-b border-[#C5C1B1]">
        <button
          onClick={() => toggleSection('visibility')}
          className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-[#F5F3EE] transition-colors"
        >
          <span className="font-semibold text-[#1A1A1A]">Visibility & Filters</span>
          <ChevronRight className={`w-3.5 h-3.5 text-[#555555] transition-transform ${activeTab === 'visibility' ? 'rotate-90' : ''}`} />
        </button>

        {activeTab === 'visibility' && (
          <div className="px-3.5 pb-3.5 pt-1 space-y-4">
            {/* Toggles */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[#555555]">Show All Nodes</span>
                <button
                  onClick={() => onUpdateSettings({ showNodes: !settings.showNodes })}
                  className={`w-8 h-4 rounded-full transition-colors relative ${settings.showNodes ? 'bg-[#2D6A4F]' : 'bg-[#D1CDBC]'}`}
                >
                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${settings.showNodes ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>

            {/* Segment Filter (Segmented Control) */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#555555]">Track Completion Filter</span>
              <div className="flex bg-[#F5F3EE] rounded-[4px] p-0.5 border border-[#D1CDBC]">
                {(['all', 'completed', 'uncompleted'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => onUpdateSettings({ segmentFilter: filter })}
                    className={`flex-1 py-1 text-[10px] font-mono rounded-[3px] transition-colors ${
                      settings.segmentFilter === filter
                        ? 'bg-white text-[#1A1A1A] shadow-xs border border-[#D1CDBC]'
                        : 'text-[#555555] hover:text-[#1A1A1A]'
                    }`}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. TRACK JUNCTIONS SECTION */}
      <div className="border-b border-[#C5C1B1]">
        <button
          onClick={() => toggleSection('junctions')}
          className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-[#F5F3EE] transition-colors"
        >
          <span className="font-semibold text-[#1A1A1A]">Track Junctions</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-[#555555]">
              {regionNodes.filter(n => n.type === 'junction').length}
            </span>
            <ChevronRight className={`w-3.5 h-3.5 text-[#555555] transition-transform ${activeTab === 'junctions' ? 'rotate-90' : ''}`} />
          </div>
        </button>

        {activeTab === 'junctions' && (
          <div className="px-3 pb-3 pt-1 space-y-2">
            {/* Action row */}
            <div className="flex items-center justify-between gap-1 text-[11px]">
              <span className="text-[#555555] font-semibold">Junction Points</span>
              {isAddingNodeMode ? (
                <button
                  onClick={onCancelAddNode}
                  className="text-[#A44A3F] hover:underline font-mono text-[11px] flex items-center gap-1 font-medium"
                >
                  <X className="w-3 h-3" />
                  Cancel
                </button>
              ) : (
                <button
                  onClick={onOpenAddNode}
                  className="text-[#2D6A4F] hover:underline font-mono text-[11px]"
                >
                  + New
                </button>
              )}
            </div>

            {/* Junction list */}
            <div className="space-y-0.5 max-h-72 overflow-y-auto">
              {regionNodes
                .filter((n) => n.type === 'junction')
                .filter((n) => {
                  if (nodeSearch) {
                    const query = nodeSearch.toLowerCase();
                    const dName = getNodeDisplayName(n).toLowerCase();
                    return dName.includes(query);
                  }
                  return true;
                })
                .map((node) => (
                  <div
                    key={node.id}
                    onClick={() => onOpenNodeEdit(node)}
                    className="px-2 py-1.5 rounded-[4px] flex items-center justify-between text-xs hover:bg-[#F5F3EE] cursor-pointer group transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className="text-[#555555] font-mono text-[11px] w-3 text-center">•</span>
                      <span className="truncate text-[11px] text-[#1A1A1A]">
                        {getNodeDisplayName(node)}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-[#555555] shrink-0">
                      {node.elevation}m
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. LANDMARKS SECTION */}
      <div className="border-b border-[#C5C1B1]">
        <button
          onClick={() => toggleSection('landmarks')}
          className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-[#F5F3EE] transition-colors"
        >
          <span className="font-semibold text-[#1A1A1A]">Landmarks</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-[#555555]">
              {regionNodes.filter(n => n.type !== 'junction').length}
            </span>
            <ChevronRight className={`w-3.5 h-3.5 text-[#555555] transition-transform ${activeTab === 'landmarks' ? 'rotate-90' : ''}`} />
          </div>
        </button>

        {activeTab === 'landmarks' && (
          <div className="px-3 pb-3 pt-1 space-y-2">
            {/* Filter row */}
            <div className="flex flex-wrap items-center gap-1.5 pb-1">
              {[
                { id: 'hut', label: 'Huts', icon: '⌂' },
                { id: 'summit', label: 'Peaks', icon: '△' },
                { id: 'lookout', label: 'Lookouts', icon: '◉' },
                { id: 'waterfall', label: 'Waterfalls', icon: '💧' },
                { id: 'carpark', label: 'Carparks', icon: 'P' },
                { id: 'bridge', label: 'Bridges', icon: '≍' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => toggleLandmarkFilter(item.id)}
                  className={`px-1.5 py-0.5 rounded-[3px] border text-[10px] font-mono transition-colors ${
                    (settings.landmarkFilters || []).includes(item.id)
                      ? 'bg-[#2D6A4F] text-white border-[#2D6A4F]'
                      : 'bg-[#FCFBF7] text-[#555555] border-[#D1CDBC] hover:border-[#2D6A4F]'
                  }`}
                >
                  {item.icon} {item.label}
                </button>
              ))}
              {(settings.landmarkFilters || []).length > 0 && (
                <button 
                  onClick={() => onUpdateSettings({ landmarkFilters: [] })}
                  className="text-[10px] text-[#A44A3F] hover:underline ml-auto"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Landmark list */}
            <div className="space-y-0.5 max-h-72 overflow-y-auto">
              {regionNodes
                .filter((n) => n.type !== 'junction')
                .filter((n) => {
                  if ((settings.landmarkFilters || []).length > 0 && !(settings.landmarkFilters || []).includes(n.type)) return false;
                  if (nodeSearch) {
                    const query = nodeSearch.toLowerCase();
                    const dName = (n.name || getNodeDisplayName(n)).toLowerCase();
                    return dName.includes(query);
                  }
                  return true;
                })
                .map((node) => (
                  <div
                    key={node.id}
                    onClick={() => onOpenNodeEdit(node)}
                    className="px-2 py-1.5 rounded-[4px] flex items-center justify-between text-xs hover:bg-[#F5F3EE] cursor-pointer group transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className="text-[#555555] font-mono text-[11px] w-3 text-center">
                        {getNodeIcon(node.type)}
                      </span>
                      <span className="truncate text-[11px] text-[#1A1A1A]">
                        {node.name || getNodeDisplayName(node)}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-[#555555] shrink-0">
                      {node.elevation}m
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* 5. ROUTE PLANNER SECTION */}
      <div className="border-b border-[#C5C1B1]">
        <button
          onClick={() => toggleSection('planner')}
          className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-[#F5F3EE] transition-colors"
        >
          <span className="font-semibold text-[#1A1A1A]">Route Planner</span>
          <div className="flex items-center gap-2">
            {activeRouteSegmentIds.length > 0 && (
              <span className="font-mono text-[11px] text-[#2D6A4F]">{activeRouteSegmentIds.length}</span>
            )}
            <ChevronRight className={`w-3.5 h-3.5 text-[#555555] transition-transform ${activeTab === 'planner' ? 'rotate-90' : ''}`} />
          </div>
        </button>

        {activeTab === 'planner' && (
          <div className="px-3 pb-3 pt-1 space-y-2.5">
            {!isPlanningStarted && activeRouteSegmentIds.length === 0 ? (
              <div className="py-2 flex flex-col items-center justify-center text-center">
                <p className="text-[11px] text-[#555555] mb-3">Assemble a custom route by selecting connected waypoints on the map.</p>
                <button
                  onClick={onStartPlanning}
                  className="w-full py-2 bg-[#2D6A4F] hover:bg-[#23533E] text-white rounded-[4px] text-xs font-semibold transition-colors shadow-sm"
                >
                  Start Planning
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {isPlanningStarted && !plannerLastNodeId && (
                  <div className="bg-[#2D6A4F]/10 border border-[#2D6A4F]/30 rounded-[4px] p-2.5 animate-pulse">
                    <p className="text-[11px] text-[#2D6A4F] font-medium">Select a starting node on the map to begin.</p>
                  </div>
                )}

                {isPlanningStarted && plannerLastNodeId && (
                  <div className="bg-[#2D6A4F]/10 border border-[#2D6A4F]/30 rounded-[4px] p-2.5">
                    <p className="text-[11px] text-[#2D6A4F] font-medium">Select the next connected node to add a segment.</p>
                  </div>
                )}

                {/* Active Route Summary */}
                {(activeRouteSegments.length > 0 || plannerLastNodeId) && (
                  <div className="space-y-2">
                    {plannerLastNodeId && (
                      <div className="bg-[#2D6A4F]/5 border border-[#2D6A4F]/20 rounded-[4px] p-2">
                        <div className="text-[10px] uppercase font-mono text-[#2D6A4F] mb-1">Current Position</div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#1A1A1A]">
                            {getNodeDisplayName(nodes.find(n => n.id === plannerLastNodeId) || { name: 'Unknown', type: 'junction' } as any)}
                          </span>
                          <button 
                            onClick={onClearRoute}
                            className="text-[10px] text-[#A44A3F] hover:underline"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    )}

                    {activeRouteSegments.length > 0 && (
                      <div className="text-[11px] font-mono text-[#1A1A1A] flex items-center justify-between border-b border-[#C5C1B1] pb-1.5">
                        <span className="font-semibold">{routeTotalDist.toFixed(1)} km</span>
                        <span>+{routeTotalGain}m</span>
                        {!isPlanningStarted && (
                          <button onClick={onClearRoute} className="text-[#A44A3F] hover:underline text-[10px]">
                            Clear
                          </button>
                        )}
                      </div>
                    )}

                    {/* Stages List */}
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {activeRouteSegments.map((seg, idx) => (
                        <div key={`${seg.id}-${idx}`} className="flex items-center justify-between text-[11px] py-0.5">
                          <span className="truncate text-[#1A1A1A] pr-2">
                            {idx + 1}. {getSegmentDisplayName(seg, nodes)}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] font-mono text-[#555555]">{seg.distanceKm.toFixed(1)}k</span>
                            <button
                              onClick={() => onRemoveSegmentFromRoute(idx)}
                              className="text-[#555555] hover:text-[#A44A3F]"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Save Route input */}
                    <form onSubmit={handleSaveCurrentRoute} className="flex flex-col gap-2 pt-1">
                      <input
                        type="text"
                        required
                        placeholder="Name your route..."
                        value={routeNameInput}
                        onChange={(e) => setRouteNameInput(e.target.value)}
                        className="w-full bg-transparent border-b border-[#C5C1B1] px-1 py-1 text-xs text-[#1A1A1A] placeholder-[#555555] focus:outline-none focus:border-[#2D6A4F]"
                      />
                      <div className="flex gap-1.5">
                        <button
                          type="submit"
                          className="flex-1 py-1.5 bg-[#2D6A4F] hover:bg-[#23533E] text-white rounded-[4px] text-xs font-semibold transition-colors"
                        >
                          Save Route
                        </button>
                        <button
                          type="button"
                          onClick={onClearRoute}
                          className="px-3 py-1.5 border border-[#C5C1B1] hover:bg-[#F5F3EE] rounded-[4px] text-xs font-medium transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 6. ROUTES SECTION */}
      <div className="border-b border-[#C5C1B1]">
        <button
          onClick={() => toggleSection('routes')}
          className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-[#F5F3EE] transition-colors"
        >
          <span className="font-semibold text-[#1A1A1A]">Routes</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-[#555555]">
              {regionRoutes.length}
            </span>
            <ChevronRight className={`w-3.5 h-3.5 text-[#555555] transition-transform ${activeTab === 'routes' ? 'rotate-90' : ''}`} />
          </div>
        </button>

        {activeTab === 'routes' && (
          <div className="px-3 pb-3 pt-1 space-y-3">
            {/* Saved Routes */}
            <div>
              <div className="text-[10px] font-mono text-[#555555] uppercase mb-1">
                Saved Routes ({regionRoutes.length})
              </div>
              {regionRoutes.length === 0 ? (
                <div className="text-[11px] text-[#555555] py-1">No saved routes yet.</div>
              ) : (
                <div className="space-y-1.5">
                  {regionRoutes.map((route) => (
                    <div
                      key={route.id}
                      className="py-1.5 px-2 rounded-[4px] hover:bg-[#F5F3EE] transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleCompleteRoute(route.id);
                            }}
                            className={`w-3.5 h-3.5 rounded-[2px] flex items-center justify-center transition-colors border shrink-0 ${
                              route.completed
                                ? 'bg-[#2D6A4F] border-[#2D6A4F] text-white'
                                : 'border-[#D1CDBC] hover:border-[#2D6A4F]'
                            }`}
                            title={route.completed ? 'Done' : 'Mark done'}
                          >
                            {route.completed && <Check className="w-2.5 h-2.5" />}
                          </button>
                          <span className={`font-medium text-[11px] truncate ${route.completed ? 'text-[#555555] line-through' : 'text-[#1A1A1A]'}`}>
                            {route.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-1">
                          <button
                            onClick={() => onEditRoute(route)}
                            className="text-[#555555] hover:text-[#2D6A4F] p-1 rounded hover:bg-black/5"
                            title="Edit Route"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => onDeleteSavedRoute(route.id)}
                            className="text-[#555555] hover:text-[#A44A3F] p-1 rounded hover:bg-black/5"
                            title="Delete Route"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-[#555555] mt-1">
                        <span>{route.totalDistanceKm.toFixed(1)} km · +{route.totalGainM}m</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onHighlightRoute(route.segmentIds)}
                            className={`px-1.5 py-0.5 rounded-[3px] border transition-colors ${
                              highlightedRouteSegmentIds.length === route.segmentIds.length && 
                              highlightedRouteSegmentIds.every((id, i) => id === route.segmentIds[i])
                                ? 'bg-[#D97706] text-white border-[#D97706]'
                                : 'bg-white text-[#555555] border-[#D1CDBC] hover:border-[#2D6A4F] hover:text-[#2D6A4F]'
                            }`}
                          >
                            {highlightedRouteSegmentIds.length === route.segmentIds.length && 
                             highlightedRouteSegmentIds.every((id, i) => id === route.segmentIds[i])
                              ? 'Hiding...' : 'Show on Map'}
                          </button>
                          <button
                            onClick={() => onOpenRouteDetail(route)}
                            className="text-[#2D6A4F] hover:underline"
                          >
                            Details
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* 7. ACTIVITY LOG SECTION */}
      <div className="border-b border-[#C5C1B1]">
        <button
          onClick={() => toggleSection('log')}
          className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-[#F5F3EE] transition-colors"
        >
          <div className="flex items-center gap-2">
            <History className="w-3.5 h-3.5 text-[#2D6A4F]" />
            <span className="font-semibold text-[#1A1A1A]">Activity Log</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-[#555555]">
              {completedRoutes.length}
            </span>
            <ChevronRight className={`w-3.5 h-3.5 text-[#555555] transition-transform ${activeTab === 'log' ? 'rotate-90' : ''}`} />
          </div>
        </button>

        {activeTab === 'log' && (
          <div className="px-3 pb-3 pt-1 space-y-3">
            {completedRoutes.length === 0 ? (
              <div className="text-[11px] text-[#555555] py-4 text-center italic">
                No routes completed yet. Mark a route as done to log your time.
              </div>
            ) : (
              <div className="space-y-2">
                {completedRoutes
                  .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime())
                  .map((route) => (
                    <div
                      key={route.id}
                      className="p-2.5 rounded-[6px] bg-white border border-[#D1CDBC] shadow-sm flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <h4 className="font-bold text-[11px] text-[#1A1A1A] truncate">{route.name}</h4>
                          <p className="text-[10px] text-[#555555] font-mono">
                            {route.completedAt ? new Date(route.completedAt).toLocaleDateString() : 'Unknown date'}
                          </p>
                        </div>
                        <button
                          onClick={() => onOpenRouteDetail(route)}
                          className="text-[#2D6A4F] p-1 hover:bg-[#E8F0EB] rounded-full transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-[10px] text-[#555555]">
                          <Clock className="w-3 h-3" />
                          <input
                            type="text"
                            placeholder="Set time (e.g. 4h 20m)"
                            value={route.completionTime || ''}
                            onChange={(e) => onUpdateRouteTime(route.id, e.target.value)}
                            className="bg-transparent border-b border-[#D1CDBC] focus:border-[#2D6A4F] outline-none px-1 w-24 text-[10px] font-mono text-[#1A1A1A]"
                          />
                        </div>
                        <div className="text-[10px] font-mono text-[#555555]">
                          {route.totalDistanceKm.toFixed(1)}km · +{route.totalGainM}m
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
