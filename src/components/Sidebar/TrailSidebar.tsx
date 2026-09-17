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
  X
} from 'lucide-react';
import { estimateHikingDurationHours, exportToGpx, getNodeDisplayName } from '../../utils/geo';

export type SidebarSection = 'coverage' | 'tracks' | 'nodes' | 'planner' | 'activity';

interface TrailSidebarProps {
  activeTab: SidebarSection;
  onSelectTab: (tab: SidebarSection) => void;
  nodes: TrailNode[];
  segments: TrailSegment[];
  savedRoutes: SavedRoute[];
  activeRegionId: string;
  selectedSegmentId: string | null;
  onSelectSegment: (id: string) => void;
  onOpenSegmentDetail: (segment: TrailSegment) => void;
  onOpenNodeEdit: (node: TrailNode) => void;
  onOpenAddNode: () => void;
  isAddingNodeMode?: boolean;
  onCancelAddNode?: () => void;
  onOpenAddSegment: () => void;
  onToggleCompleteSegment: (segmentId: string) => void;
  onToggleVisitedNode: (nodeId: string) => void;
  activeRouteSegmentIds: string[];
  onAddSegmentToRoute: (segmentId: string) => void;
  onRemoveSegmentFromRoute: (index: number) => void;
  onClearRoute: () => void;
  onSaveRoute: (name: string, description: string, notes: string) => void;
  onDeleteSavedRoute: (routeId: string) => void;
  onHighlightRoute: (segmentIds: string[]) => void;
  settings: AppSettings;
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
  onToggleCompleteSegment,
  onToggleVisitedNode,
  activeRouteSegmentIds,
  onAddSegmentToRoute,
  onRemoveSegmentFromRoute,
  onClearRoute,
  onSaveRoute,
  onDeleteSavedRoute,
  onHighlightRoute,
  onOpenGpxUpload,
}) => {
  const regionNodes = nodes.filter((n) => n.regionId === activeRegionId);
  const regionSegments = segments.filter((s) => s.regionId === activeRegionId);
  const regionRoutes = savedRoutes.filter((r) => r.regionId === activeRegionId);

  // Search & filter states
  const [segmentSearch, setSegmentSearch] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<'all' | 'completed' | 'remaining'>('all');
  const [nodeTypeFilter, setNodeTypeFilter] = useState<string>('all');
  const [nodeSearch, setNodeSearch] = useState('');

  // Route Builder inputs
  const [routeNameInput, setRouteNameInput] = useState('');

  // Coverage metric calculations
  const totalDistance = regionSegments.reduce((acc, s) => acc + s.distanceKm, 0);
  const completedSegments = regionSegments.filter((s) => s.completed);
  const completedDistance = completedSegments.reduce((acc, s) => acc + s.distanceKm, 0);
  const coveragePercent = totalDistance > 0 ? (completedDistance / totalDistance) * 100 : 0;
  const remainingDistance = Math.max(0, totalDistance - completedDistance);

  // Route builder totals
  const activeRouteSegments = activeRouteSegmentIds
    .map((id) => regionSegments.find((s) => s.id === id))
    .filter(Boolean) as TrailSegment[];

  const routeTotalDist = activeRouteSegments.reduce((acc, s) => acc + s.distanceKm, 0);
  const routeTotalGain = activeRouteSegments.reduce((acc, s) => acc + s.elevationGainM, 0);
  const routeTotalLoss = activeRouteSegments.reduce((acc, s) => acc + s.elevationLossM, 0);
  const routeEstHours = estimateHikingDurationHours(routeTotalDist, routeTotalGain, routeTotalLoss);

  // Toggle open accordion section
  const toggleSection = (section: SidebarSection) => {
    onSelectTab(section);
  };

  const handleSaveCurrentRoute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeNameInput.trim()) return;
    onSaveRoute(routeNameInput.trim(), '', '');
    setRouteNameInput('');
    onSelectTab('activity');
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
      default: return '•';
    }
  };

  return (
    <aside className="w-full h-full bg-[#FCFBF7] flex flex-col text-[#213026] text-xs select-none overflow-y-auto">
      {/* 1. COVERAGE SECTION */}
      <div className="border-b border-[#E8E5DD]">
        <button
          onClick={() => toggleSection('coverage')}
          className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-[#F5F3EE] transition-colors"
        >
          <span className="font-semibold text-[#213026]">Coverage</span>
          <div className="flex items-center gap-2">
            <span className="font-mono font-medium text-[#2D6A4F]">{coveragePercent.toFixed(0)}%</span>
            <ChevronRight className={`w-3.5 h-3.5 text-[#7A7A7A] transition-transform ${activeTab === 'coverage' ? 'rotate-90' : ''}`} />
          </div>
        </button>

        {activeTab === 'coverage' && (
          <div className="px-3.5 pb-3.5 pt-1 space-y-2">
            {/* Single bold number display */}
            <div className="text-3xl font-mono font-bold text-[#213026]">
              {coveragePercent.toFixed(1)}%
            </div>
            <div className="text-[11px] text-[#7A7A7A] font-mono">
              {completedDistance.toFixed(1)} of {totalDistance.toFixed(1)} km surveyed
            </div>
            <div className="w-full bg-[#E8E5DD] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#2D6A4F] h-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, coveragePercent))}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#7A7A7A] pt-1">
              <span>{remainingDistance.toFixed(1)} km remaining</span>
              <span>{completedSegments.length}/{regionSegments.length} tracks</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. TRACKS SECTION */}
      <div className="border-b border-[#E8E5DD]">
        <button
          onClick={() => toggleSection('tracks')}
          className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-[#F5F3EE] transition-colors"
        >
          <span className="font-semibold text-[#213026]">Tracks</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-[#7A7A7A]">{regionSegments.length}</span>
            <ChevronRight className={`w-3.5 h-3.5 text-[#7A7A7A] transition-transform ${activeTab === 'tracks' ? 'rotate-90' : ''}`} />
          </div>
        </button>

        {activeTab === 'tracks' && (
          <div className="px-3 pb-3 pt-1 space-y-2">
            {/* Filter row */}
            <div className="flex items-center justify-between gap-1 text-[11px]">
              <div className="flex items-center gap-2">
                {(['all', 'remaining', 'completed'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setSegmentFilter(filter)}
                    className={`capitalize transition-colors ${
                      segmentFilter === filter
                        ? 'text-[#2D6A4F] font-semibold underline underline-offset-4'
                        : 'text-[#7A7A7A] hover:text-[#213026]'
                    }`}
                  >
                    {filter === 'remaining' ? 'Remaining' : filter}
                  </button>
                ))}
              </div>
              <button
                onClick={onOpenAddSegment}
                className="text-[#2D6A4F] hover:underline font-mono text-[11px]"
              >
                + New
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Filter tracks..."
                value={segmentSearch}
                onChange={(e) => setSegmentSearch(e.target.value)}
                className="w-full bg-transparent border-b border-[#E8E5DD] px-1 py-1 text-xs text-[#213026] placeholder-[#7A7A7A] focus:outline-none focus:border-[#2D6A4F]"
              />
            </div>

            {/* Clean Track list - No cards */}
            <div className="space-y-0.5 max-h-72 overflow-y-auto">
              {regionSegments
                .filter((s) => {
                  if (segmentFilter === 'completed' && !s.completed) return false;
                  if (segmentFilter === 'remaining' && s.completed) return false;
                  if (segmentSearch && !s.name.toLowerCase().includes(segmentSearch.toLowerCase())) return false;
                  return true;
                })
                .map((seg) => (
                  <div
                    key={seg.id}
                    onClick={() => {
                      onSelectSegment(seg.id);
                      onOpenSegmentDetail(seg);
                    }}
                    className={`px-2 py-1.5 rounded-[4px] flex items-center justify-between text-xs cursor-pointer group transition-colors ${
                      selectedSegmentId === seg.id ? 'bg-[#F5F3EE]' : 'hover:bg-[#F5F3EE]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleCompleteSegment(seg.id);
                        }}
                        className={`w-3.5 h-3.5 rounded-[2px] flex items-center justify-center transition-colors border ${
                          seg.completed
                            ? 'bg-[#2D6A4F] border-[#2D6A4F] text-white'
                            : 'border-[#D5D0C6] hover:border-[#2D6A4F]'
                        }`}
                        title={seg.completed ? 'Completed' : 'Mark completed'}
                      >
                        {seg.completed && <Check className="w-2.5 h-2.5" />}
                      </button>
                      <span className={`truncate text-[11px] ${seg.completed ? 'text-[#7A7A7A] line-through' : 'text-[#213026]'}`}>
                        {seg.name}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-[#7A7A7A] shrink-0">
                      {seg.distanceKm.toFixed(1)} km
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. NODES SECTION */}
      <div className="border-b border-[#E8E5DD]">
        <button
          onClick={() => toggleSection('nodes')}
          className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-[#F5F3EE] transition-colors"
        >
          <span className="font-semibold text-[#213026]">Nodes</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-[#7A7A7A]">{regionNodes.length}</span>
            <ChevronRight className={`w-3.5 h-3.5 text-[#7A7A7A] transition-transform ${activeTab === 'nodes' ? 'rotate-90' : ''}`} />
          </div>
        </button>

        {activeTab === 'nodes' && (
          <div className="px-3 pb-3 pt-1 space-y-2">
            {/* Filter row */}
            <div className="flex items-center justify-between gap-1 text-[11px]">
              <div className="flex items-center gap-2">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'hut', label: 'Huts' },
                  { id: 'summit', label: 'Peaks' },
                  { id: 'lookout', label: 'Lookouts' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setNodeTypeFilter(item.id)}
                    className={`transition-colors ${
                      nodeTypeFilter === item.id
                        ? 'text-[#2D6A4F] font-semibold underline underline-offset-4'
                        : 'text-[#7A7A7A] hover:text-[#213026]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              {isAddingNodeMode ? (
                <button
                  onClick={onCancelAddNode}
                  className="text-[#A44A3F] hover:underline font-mono text-[11px] flex items-center gap-1 font-medium"
                  title="Cancel waypoint placement"
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

            {/* Clean Node list - No cards */}
            <div className="space-y-0.5 max-h-72 overflow-y-auto">
              {regionNodes
                .filter((n) => {
                  if (nodeTypeFilter !== 'all' && n.type !== nodeTypeFilter) return false;
                  if (nodeSearch) {
                    const query = nodeSearch.toLowerCase();
                    const dName = getNodeDisplayName(n).toLowerCase();
                    const rawName = (n.name || '').toLowerCase();
                    if (!dName.includes(query) && !rawName.includes(query) && !n.type.toLowerCase().includes(query)) {
                      return false;
                    }
                  }
                  return true;
                })
                .map((node) => {
                  const displayName = getNodeDisplayName(node);
                  const isUnnamed = !node.name || !node.name.trim();

                  return (
                    <div
                      key={node.id}
                      onClick={() => onOpenNodeEdit(node)}
                      className="px-2 py-1.5 rounded-[4px] flex items-center justify-between text-xs hover:bg-[#F5F3EE] cursor-pointer group transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleVisitedNode(node.id);
                          }}
                          className={`w-3.5 h-3.5 rounded-[2px] flex items-center justify-center transition-colors border ${
                            node.visited
                              ? 'bg-[#2D6A4F] border-[#2D6A4F] text-white'
                              : 'border-[#D5D0C6] hover:border-[#2D6A4F]'
                          }`}
                          title={node.visited ? 'Visited' : 'Mark visited'}
                        >
                          {node.visited && <Check className="w-2.5 h-2.5" />}
                        </button>
                        <span className="text-[#7A7A7A] font-mono text-[11px] w-3 text-center">
                          {getNodeIcon(node.type)}
                        </span>
                        <span className={`truncate text-[11px] ${isUnnamed ? 'italic text-[#7A7A7A]' : node.visited ? 'text-[#7A7A7A]' : 'text-[#213026]'}`}>
                          {displayName}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-[#7A7A7A] shrink-0">
                        {node.elevation}m
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* 4. PLANNER SECTION */}
      <div className="border-b border-[#E8E5DD]">
        <button
          onClick={() => toggleSection('planner')}
          className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-[#F5F3EE] transition-colors"
        >
          <span className="font-semibold text-[#213026]">Planner</span>
          <div className="flex items-center gap-2">
            {activeRouteSegmentIds.length > 0 && (
              <span className="font-mono text-[11px] text-[#2D6A4F]">{activeRouteSegmentIds.length}</span>
            )}
            <ChevronRight className={`w-3.5 h-3.5 text-[#7A7A7A] transition-transform ${activeTab === 'planner' ? 'rotate-90' : ''}`} />
          </div>
        </button>

        {activeTab === 'planner' && (
          <div className="px-3 pb-3 pt-1 space-y-2.5">
            {/* Active Route Summary - Single calm line */}
            {activeRouteSegments.length > 0 ? (
              <div className="space-y-2">
                <div className="text-[11px] font-mono text-[#213026] flex items-center justify-between border-b border-[#E8E5DD] pb-1.5">
                  <span className="font-semibold">{routeTotalDist.toFixed(1)} km</span>
                  <span>+{routeTotalGain}m</span>
                  <span>~{routeEstHours}h</span>
                  <button onClick={onClearRoute} className="text-[#A44A3F] hover:underline text-[10px]">
                    Clear
                  </button>
                </div>

                {/* Stages List */}
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {activeRouteSegments.map((seg, idx) => (
                    <div key={`${seg.id}-${idx}`} className="flex items-center justify-between text-[11px] py-0.5">
                      <span className="truncate text-[#213026] pr-2">
                        {idx + 1}. {seg.name}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-mono text-[#7A7A7A]">{seg.distanceKm.toFixed(1)}k</span>
                        <button
                          onClick={() => onRemoveSegmentFromRoute(idx)}
                          className="text-[#7A7A7A] hover:text-[#A44A3F]"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Save Route input */}
                <form onSubmit={handleSaveCurrentRoute} className="flex gap-1.5 pt-1">
                  <input
                    type="text"
                    required
                    placeholder="Route title..."
                    value={routeNameInput}
                    onChange={(e) => setRouteNameInput(e.target.value)}
                    className="flex-1 bg-transparent border-b border-[#E8E5DD] px-1 py-1 text-xs text-[#213026] placeholder-[#7A7A7A] focus:outline-none focus:border-[#2D6A4F]"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1 bg-[#2D6A4F] hover:bg-[#23533E] text-white rounded-[4px] text-xs font-medium transition-colors"
                  >
                    Save
                  </button>
                </form>
              </div>
            ) : (
              <div className="text-[11px] text-[#7A7A7A] py-1">
                Select tracks below to assemble a route.
              </div>
            )}

            {/* Quick add track list */}
            <div className="space-y-1 pt-1 border-t border-[#E8E5DD]">
              <div className="text-[10px] font-mono text-[#7A7A7A] uppercase">Add Track to Route</div>
              <div className="space-y-0.5 max-h-40 overflow-y-auto">
                {regionSegments.map((seg) => (
                  <div
                    key={seg.id}
                    className="flex items-center justify-between text-[11px] py-1 px-1.5 rounded-[4px] hover:bg-[#F5F3EE]"
                  >
                    <span className="truncate text-[#213026] pr-2">{seg.name}</span>
                    <button
                      onClick={() => onAddSegmentToRoute(seg.id)}
                      className="text-[#2D6A4F] hover:underline font-mono text-[10px] shrink-0"
                    >
                      + Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. ACTIVITY SECTION */}
      <div className="border-b border-[#E8E5DD]">
        <button
          onClick={() => toggleSection('activity')}
          className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-[#F5F3EE] transition-colors"
        >
          <span className="font-semibold text-[#213026]">Activity</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-[#7A7A7A]">
              {regionRoutes.length + completedSegments.length}
            </span>
            <ChevronRight className={`w-3.5 h-3.5 text-[#7A7A7A] transition-transform ${activeTab === 'activity' ? 'rotate-90' : ''}`} />
          </div>
        </button>

        {activeTab === 'activity' && (
          <div className="px-3 pb-3 pt-1 space-y-3">
            {/* Saved Routes */}
            <div>
              <div className="text-[10px] font-mono text-[#7A7A7A] uppercase mb-1">
                Saved Routes ({regionRoutes.length})
              </div>
              {regionRoutes.length === 0 ? (
                <div className="text-[11px] text-[#7A7A7A] py-1">No saved routes yet.</div>
              ) : (
                <div className="space-y-1.5">
                  {regionRoutes.map((route) => (
                    <div
                      key={route.id}
                      className="py-1.5 px-2 rounded-[4px] hover:bg-[#F5F3EE] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-[#213026] text-[11px]">{route.name}</span>
                        <button
                          onClick={() => onDeleteSavedRoute(route.id)}
                          className="text-[#7A7A7A] hover:text-[#A44A3F]"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-[#7A7A7A] mt-0.5">
                        <span>{route.totalDistanceKm.toFixed(1)} km · +{route.totalGainM}m</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onHighlightRoute(route.segmentIds)}
                            className="text-[#2D6A4F] hover:underline"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleExportRouteGpx(route)}
                            className="text-[#7A7A7A] hover:text-[#213026]"
                          >
                            GPX
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Completed tracks log */}
            <div className="pt-2 border-t border-[#E8E5DD]">
              <div className="text-[10px] font-mono text-[#7A7A7A] uppercase mb-1">
                Completed Tracks ({completedSegments.length})
              </div>
              {completedSegments.length === 0 ? (
                <div className="text-[11px] text-[#7A7A7A] py-1">No completed tracks logged.</div>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {completedSegments.map((seg) => (
                    <div
                      key={seg.id}
                      className="flex items-center justify-between text-[11px] py-1 px-1.5 hover:bg-[#F5F3EE] rounded-[4px]"
                    >
                      <span className="truncate text-[#213026]">{seg.name}</span>
                      <span className="font-mono text-[10px] text-[#7A7A7A] shrink-0 ml-2">
                        {seg.distanceKm.toFixed(1)} km
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
