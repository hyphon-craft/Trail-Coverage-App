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
  Clock,
  RefreshCw,
  Save,
  Calendar
} from 'lucide-react';
import { 
  exportToGpx, 
  getNodeDisplayName, 
  getSegmentDisplayName, 
  calculateRouteStats,
  getOrderedNodeIdsFromSegments
} from '../../utils/geo';

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
  onAddRouteCompletion: (routeId: string) => void;
  onUpdateRouteCompletion: (routeId: string, completionId: string, date: string, time: string) => void;
  onRemoveRouteCompletion: (routeId: string, completionId: string) => void;
  activeRouteSegmentIds: string[];
  onRemoveSegmentFromRoute: (index: number) => void;
  onClearRoute: () => void;
  onSaveRoute: (name: string, description: string, notes: string, finalSegmentIds: string[]) => void;
  onOpenSaveRoute: () => void;
  onDeleteSavedRoute: (routeId: string) => void;
  onHighlightRoute: (segmentIds: string[]) => void;
  highlightedRouteSegmentIds: string[];
  onOpenRouteDetail: (route: SavedRoute) => void;
  onEditRoute: (route: SavedRoute) => void;
  plannerLastNodeId?: string | null;
  isPlanningStarted?: boolean;
  onStartPlanning?: () => void;
  plannerIsReversed?: boolean;
  onTogglePlannerReverse?: () => void;
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
  onAddRouteCompletion,
  onUpdateRouteCompletion,
  onRemoveRouteCompletion,
  activeRouteSegmentIds,
  onRemoveSegmentFromRoute,
  onClearRoute,
  onSaveRoute,
  onOpenSaveRoute,
  onDeleteSavedRoute,
  onHighlightRoute,
  highlightedRouteSegmentIds,
  onOpenRouteDetail,
  onEditRoute,
  plannerLastNodeId,
  isPlanningStarted,
  onStartPlanning,
  plannerIsReversed,
  onTogglePlannerReverse,
  settings,
  onUpdateSettings,
  onOpenGpxUpload,
}) => {
  const regionNodes = nodes.filter((n) => n.regionId === activeRegionId);
  const regionRoutes = savedRoutes.filter((r) => r.regionId === activeRegionId);
  
  // Search & filter states
  const [nodeTypeFilter, setNodeTypeFilter] = useState<string>('all');
  const [nodeSearch, setNodeSearch] = useState('');
  const [showDebug, setShowDebug] = useState(false);
  const [logSortBy, setLogSortBy] = useState<'date' | 'distance' | 'time' | 'elevation'>('date');
  const [logSortOrder, setLogSortOrder] = useState<'asc' | 'desc'>('desc');

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

  // Helper to parse duration string to minutes for sorting
  const parseDuration = (timeStr: string): number => {
    if (!timeStr) return 0;
    const hoursMatch = timeStr.match(/(\d+)\s*h/i);
    const minutesMatch = timeStr.match(/(\d+)\s*m/i);
    const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
    const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0;
    return (hours * 60) + minutes;
  };

  const allCompletions = React.useMemo(() => {
    const completions = regionRoutes.flatMap(route => {
      const routeCompletions = route.completions || [];
      if (routeCompletions.length === 0 && route.completed) {
        // Legacy fallback
        return [{
          id: route.id + '-legacy',
          date: (route.completedAt ? new Date(route.completedAt) : new Date()).toISOString().split('T')[0],
          time: route.completionTime || '',
          distanceKm: route.totalDistanceKm,
          elevationGainM: route.totalGainM,
          route
        }];
      }
      return routeCompletions.map(completion => ({
        ...completion,
        route
      }));
    });

    return completions.sort((a, b) => {
      let comparison = 0;
      switch (logSortBy) {
        case 'date':
          comparison = new Date(b.date).getTime() - new Date(a.date).getTime();
          break;
        case 'distance':
          comparison = (b.distanceKm || b.route.totalDistanceKm) - (a.distanceKm || a.route.totalDistanceKm);
          break;
        case 'elevation':
          comparison = (b.elevationGainM || b.route.totalGainM) - (a.elevationGainM || a.route.totalGainM);
          break;
        case 'time':
          comparison = parseDuration(b.time) - parseDuration(a.time);
          break;
      }
      return logSortOrder === 'desc' ? comparison : -comparison;
    });
  }, [regionRoutes, logSortBy, logSortOrder]);

  // Route builder totals
  const activeRouteSegments = activeRouteSegmentIds
    .map((id) => segments.find((s) => s.id === id))
    .filter((s): s is TrailSegment => !!s);

  const routeStats = calculateRouteStats(activeRouteSegmentIds, segments, plannerIsReversed);
  const routeTotalDist = routeStats.distanceKm;
  const routeTotalGain = routeStats.elevationGainM;
  const routeTotalLoss = routeStats.elevationLossM;

  // Derive node sequence for display
  const plannerNodeIds = getOrderedNodeIdsFromSegments(activeRouteSegmentIds, segments);
  const plannerNodes = plannerNodeIds
    .map(id => nodes.find(n => n.id === id))
    .filter((n): n is TrailNode => !!n);

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
                      <div className="flex flex-col gap-2 border-b border-[#C5C1B1] pb-1.5">
                        <div className="text-[11px] font-mono text-[#1A1A1A] flex items-center justify-between">
                          <span className="font-semibold">{routeTotalDist.toFixed(1)} km</span>
                          <span className="flex items-center gap-1.5">
                            <span className="text-[#2D6A4F]">+{routeTotalGain}m</span>
                            <span className="text-[#A44A3F]">-{routeTotalLoss}m</span>
                          </span>
                          {!isPlanningStarted && (
                            <button onClick={onClearRoute} className="text-[#A44A3F] hover:underline text-[10px]">
                              Clear
                            </button>
                          )}
                        </div>
                        <button
                          onClick={onTogglePlannerReverse}
                          className={`w-full py-1.5 rounded-[4px] text-[10px] font-bold font-mono uppercase transition-all border flex items-center justify-center gap-1.5 ${
                            plannerIsReversed
                              ? 'bg-[#D97706] text-white border-[#D97706]'
                              : 'bg-white text-[#555555] border-[#D1CDBC] hover:bg-[#F5F3EE]'
                          }`}
                        >
                          <RefreshCw className={`w-3 h-3 ${plannerIsReversed ? 'animate-spin-slow' : ''}`} />
                          {plannerIsReversed ? 'Route Reversed' : 'Reverse Direction'}
                        </button>

                        {showDebug && (
                          <div className="p-2 bg-[#F5F3EE] rounded border border-[#D1CDBC] font-mono text-[9px] text-[#555555] space-y-1 mt-1">
                            <div className="flex justify-between border-b border-[#D1CDBC] pb-1 mb-1 font-bold text-[#1A1A1A]">
                              <span>DEBUG DATA</span>
                              <span>{plannerIsReversed ? 'REVERSED' : 'FORWARD'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Start Ele:</span>
                              <span className="text-[#1A1A1A] font-bold">{routeStats.startElevation}m</span>
                            </div>
                            <div className="flex justify-between">
                              <span>End Ele:</span>
                              <span className="text-[#1A1A1A] font-bold">{routeStats.endElevation}m</span>
                            </div>
                            <div className="flex justify-between border-t border-dotted border-[#D1CDBC] pt-1">
                              <span>Net Change:</span>
                              <span className={`font-bold ${routeStats.netChange >= 0 ? 'text-[#2D6A4F]' : 'text-[#A44A3F]'}`}>
                                {routeStats.netChange > 0 ? '+' : ''}{routeStats.netChange}m
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Calc Ascent:</span>
                              <span className="text-[#2D6A4F] font-bold">{routeStats.elevationGainM}m</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Calc Descent:</span>
                              <span className="text-[#A44A3F] font-bold">{routeStats.elevationLossM}m</span>
                            </div>
                            <div className="pt-1 border-t border-[#D1CDBC] leading-tight">
                              Dirs: {routeStats.isForwardArray.map((f, i) => `${i+1}:${f?'F':'B'}`).join(', ')}
                            </div>
                          </div>
                        )}
                        <button 
                          onClick={() => setShowDebug(!showDebug)}
                          className="text-[9px] text-[#555555] hover:text-[#1A1A1A] hover:underline transition-colors text-right"
                        >
                          {showDebug ? 'Hide Debug' : 'Show Debug Metrics'}
                        </button>
                      </div>
                    )}

                    {/* Dots Sequence List */}
                    <div className="space-y-1.5 max-h-48 overflow-y-auto mb-2">
                      <div className="text-[10px] uppercase font-mono text-[#555555] mb-1 px-1 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 bg-[#2D6A4F] rounded-full"></div>
                        Dot Sequence
                      </div>
                      {plannerNodes.map((node, idx) => (
                        <div key={`${node.id}-${idx}`} className="flex items-center justify-between text-[11px] py-1 px-2 bg-[#F5F3EE] rounded-[4px] border border-[#D1CDBC]/50">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-[10px] text-[#2D6A4F] font-bold bg-white w-4 h-4 flex items-center justify-center rounded-full border border-[#D1CDBC]">
                              {idx + 1}
                            </span>
                            <span className="truncate text-[#1A1A1A] font-medium">
                              {getNodeDisplayName(node)}
                            </span>
                          </div>
                          <span className="text-[9px] font-mono text-[#555555] uppercase tracking-tighter ml-2 bg-white px-1 rounded border border-[#D1CDBC]">
                            {node.type || 'Dot'}
                          </span>
                        </div>
                      ))}
                      {plannerNodes.length === 0 && plannerLastNodeId && (
                        <div className="flex items-center gap-2 py-1 px-2 bg-[#F5F3EE] rounded-[4px] border border-[#D1CDBC]/50">
                           <span className="font-mono text-[10px] text-[#2D6A4F] font-bold bg-white w-4 h-4 flex items-center justify-center rounded-full border border-[#D1CDBC]">1</span>
                           <span className="text-[#1A1A1A] font-medium italic">Start Point Selected</span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={onOpenSaveRoute}
                        className="flex-1 py-1.5 bg-[#2D6A4F] hover:bg-[#23533E] text-white rounded-[4px] text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Review & Save
                      </button>
                      <button
                        type="button"
                        onClick={onClearRoute}
                        className="px-3 py-1.5 border border-[#C5C1B1] hover:bg-[#F5F3EE] rounded-[4px] text-xs font-medium transition-colors"
                      >
                        Clear
                      </button>
                    </div>
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
                              onAddRouteCompletion(route.id);
                            }}
                            className="px-1.5 py-0.5 rounded-[3px] flex items-center justify-center transition-colors border shrink-0 bg-[#E8F0EB] hover:bg-[#D1E2D9] border-[#2D6A4F]/20 text-[#2D6A4F] text-[10px] font-medium"
                            title="Log completion"
                          >
                            <Plus className="w-3 h-3 mr-0.5" /> Log
                          </button>
                          <span className={`font-medium text-[11px] truncate ${route.completed ? 'text-[#2D6A4F]' : 'text-[#1A1A1A]'}`}>
                            {route.name}
                          </span>
                          {route.isReturn && (
                            <span className="ml-1 text-[8px] font-bold bg-[#2D6A4F]/10 text-[#2D6A4F] px-1 rounded uppercase shrink-0">
                              Return
                            </span>
                          )}
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
              {allCompletions.length}
            </span>
            <ChevronRight className={`w-3.5 h-3.5 text-[#555555] transition-transform ${activeTab === 'log' ? 'rotate-90' : ''}`} />
          </div>
        </button>

        {activeTab === 'log' && (
          <div className="px-3 pb-3 pt-1 space-y-3">
            {/* Sorting Controls */}
            {allCompletions.length > 0 && (
              <div className="flex items-center justify-between gap-2 bg-[#F5F3EE] p-2 rounded-[4px] border border-[#D1CDBC]">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {(['date', 'distance', 'time', 'elevation'] as const).map((key) => (
                    <button
                      key={key}
                      onClick={() => {
                        if (logSortBy === key) {
                          setLogSortOrder(logSortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setLogSortBy(key);
                          setLogSortOrder('desc');
                        }
                      }}
                      className={`px-1.5 py-0.5 rounded-[3px] text-[9px] font-mono uppercase tracking-tighter transition-all border shrink-0 ${
                        logSortBy === key
                          ? 'bg-[#2D6A4F] text-white border-[#2D6A4F]'
                          : 'bg-white text-[#555555] border-[#D1CDBC] hover:border-[#2D6A4F]'
                      }`}
                    >
                      {key} {logSortBy === key && (logSortOrder === 'desc' ? '↓' : '↑')}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {allCompletions.length === 0 ? (
              <div className="text-[11px] text-[#555555] py-4 text-center italic">
                No routes completed yet. Log a completion on a route to record it.
              </div>
            ) : (
              <div className="space-y-2">
                {allCompletions.map((completion) => {
                  const { route, id, date, time, distanceKm, elevationGainM, notes } = completion as any;
                  return (
                    <div
                      key={id}
                      className="p-2.5 rounded-[6px] bg-white border border-[#D1CDBC] shadow-sm flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1 pr-2">
                          <h4 className="font-bold text-[11px] text-[#1A1A1A] truncate">{route.name}</h4>
                          <div className="text-[10px] font-mono text-[#555555] mt-0.5 flex items-center gap-2">
                            <Calendar className="w-3 h-3" />
                            {new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => onOpenRouteDetail(route)}
                            className="text-[#2D6A4F] p-1 hover:bg-[#E8F0EB] rounded-full transition-colors"
                            title="View Route"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => onRemoveRouteCompletion(route.id, id)}
                            className="text-[#A44A3F] p-1 hover:bg-[#FDF2F2] rounded-full transition-colors"
                            title="Delete Log"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {time && (
                          <div className="flex items-center gap-1 text-[10px] text-[#555555]">
                            <Clock className="w-3 h-3" />
                            <span className="font-mono">{time}</span>
                          </div>
                        )}
                        <div className="text-[10px] font-mono text-[#555555]">
                          {(distanceKm || route.totalDistanceKm).toFixed(1)}km · +{elevationGainM || route.totalGainM}m
                        </div>
                      </div>

                      {notes && (
                        <div className="text-[10px] text-[#555555] bg-[#F5F3EE] p-1.5 rounded-[4px] border border-[#D1CDBC]/50 font-sans italic">
                          "{notes}"
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
