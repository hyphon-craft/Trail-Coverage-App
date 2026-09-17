import React, { useState, useEffect } from 'react';
import { 
  AppSettings, 
  CompletionRecord, 
  GpxParsedTrack, 
  Region, 
  SavedRoute, 
  TrailNode, 
  TrailSegment 
} from './types';
import { 
  loadStoredNodes, 
  loadStoredRegions, 
  loadStoredRoutes, 
  loadStoredSegments, 
  loadStoredSettings, 
  resetToDefaults, 
  saveStoredNodes, 
  saveStoredRegions, 
  saveStoredRoutes, 
  saveStoredSegments, 
  saveStoredSettings 
} from './utils/storage';
import { Header } from './components/Header';
import { TrailMap } from './components/Map/TrailMap';
import { TrailSidebar, SidebarSection } from './components/Sidebar/TrailSidebar';
import { GpxUploadModal } from './components/Modals/GpxUploadModal';
import { NodeEditModal } from './components/Modals/NodeEditModal';
import { SegmentDetailModal } from './components/Modals/SegmentDetailModal';
import { AddSegmentModal } from './components/Modals/AddSegmentModal';
import { SupabaseModal } from './components/Modals/SupabaseModal';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

export default function App() {
  // Global persisted states
  const [regions, setRegions] = useState<Region[]>(() => loadStoredRegions());
  const [activeRegionId, setActiveRegionId] = useState<string>('taranaki');
  const [nodes, setNodes] = useState<TrailNode[]>(() => loadStoredNodes());
  const [segments, setSegments] = useState<TrailSegment[]>(() => loadStoredSegments());
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>(() => loadStoredRoutes());
  const [settings, setSettings] = useState<AppSettings>(() => loadStoredSettings());

  // Interactive selection & modal states
  const [activeTab, setActiveTab] = useState<SidebarSection>('coverage');
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Modals
  const [isGpxModalOpen, setIsGpxModalOpen] = useState(false);
  const [isNodeEditModalOpen, setIsNodeEditModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<TrailNode | null>(null);
  const [isAddingNodeMode, setIsAddingNodeMode] = useState(false);
  const [clickedMapCoords, setClickedMapCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [isSegmentDetailModalOpen, setIsSegmentDetailModalOpen] = useState(false);
  const [detailSegment, setDetailSegment] = useState<TrailSegment | null>(null);

  const [isAddSegmentModalOpen, setIsAddSegmentModalOpen] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);

  // Route Builder State
  const [activeRouteSegmentIds, setActiveRouteSegmentIds] = useState<string[]>([]);

  // GPX Track Preview State
  const [gpxPreviewTrack, setGpxPreviewTrack] = useState<GpxParsedTrack | null>(null);

  // Persist updates
  const updateSettings = (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    saveStoredSettings(updated);
  };

  const activeRegion = regions.find((r) => r.id === activeRegionId) || regions[0];

  // Region stats
  const regionSegments = segments.filter((s) => s.regionId === activeRegionId);
  const totalDistanceKm = regionSegments.reduce((acc, s) => acc + s.distanceKm, 0);
  const completedSegments = regionSegments.filter((s) => s.completed);
  const completedDistanceKm = completedSegments.reduce((acc, s) => acc + s.distanceKm, 0);
  const completionPercentage = totalDistanceKm > 0 ? (completedDistanceKm / totalDistanceKm) * 100 : 0;

  // Toggle segment completion
  const handleToggleCompleteSegment = (segmentId: string) => {
    const updated = segments.map((s) => {
      if (s.id === segmentId) {
        const nextCompleted = !s.completed;
        const count = nextCompleted ? (s.completionCount || 0) + 1 : Math.max(0, (s.completionCount || 1) - 1);
        return {
          ...s,
          completed: nextCompleted,
          completedAt: nextCompleted ? new Date().toISOString() : undefined,
          completionCount: count,
        };
      }
      return s;
    });

    setSegments(updated);
    saveStoredSegments(updated);

    // If modal is open for this segment, update detail segment as well
    if (detailSegment && detailSegment.id === segmentId) {
      setDetailSegment(updated.find((s) => s.id === segmentId) || null);
    }
  };

  // Toggle node visited
  const handleToggleVisitedNode = (nodeId: string) => {
    const updated = nodes.map((n) => {
      if (n.id === nodeId) {
        const nextVisited = !n.visited;
        return {
          ...n,
          visited: nextVisited,
          visitedAt: nextVisited ? new Date().toISOString() : undefined,
        };
      }
      return n;
    });
    setNodes(updated);
    saveStoredNodes(updated);
  };

  // Save Node (Create or Edit)
  const handleSaveNode = (nodeToSave: TrailNode) => {
    let updated: TrailNode[];
    const exists = nodes.some((n) => n.id === nodeToSave.id);
    if (exists) {
      updated = nodes.map((n) => (n.id === nodeToSave.id ? nodeToSave : n));
    } else {
      updated = [nodeToSave, ...nodes];
    }
    setNodes(updated);
    saveStoredNodes(updated);
    setIsAddingNodeMode(false);
  };

  // Delete Node
  const handleDeleteNode = (nodeId: string) => {
    const updatedNodes = nodes.filter((n) => n.id !== nodeId);
    // Also remove segments connected to this node
    const updatedSegments = segments.filter(
      (s) => s.startNodeId !== nodeId && s.endNodeId !== nodeId
    );
    setNodes(updatedNodes);
    setSegments(updatedSegments);
    saveStoredNodes(updatedNodes);
    saveStoredSegments(updatedSegments);
  };

  // Save Segment (Create or Edit)
  const handleSaveSegment = (
    newSegmentData: Omit<TrailSegment, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    const newSegment: TrailSegment = {
      ...newSegmentData,
      id: `seg-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [newSegment, ...segments];
    setSegments(updated);
    saveStoredSegments(updated);
    setSelectedSegmentId(newSegment.id);
    setActiveTab('tracks');
  };

  // Delete Segment
  const handleDeleteSegment = (segmentId: string) => {
    const updated = segments.filter((s) => s.id !== segmentId);
    setSegments(updated);
    saveStoredSegments(updated);
    setActiveRouteSegmentIds((prev) => prev.filter((id) => id !== segmentId));
    if (selectedSegmentId === segmentId) setSelectedSegmentId(null);
  };

  // Add completion log to segment
  const handleAddCompletion = (
    segmentId: string,
    record: Omit<CompletionRecord, 'id' | 'segmentId'>
  ) => {
    const newRecord: CompletionRecord = {
      ...record,
      id: `comp-${Date.now()}`,
      segmentId,
    };
    const updated = segments.map((s) => {
      if (s.id === segmentId) {
        const completions = [newRecord, ...(s.completions || [])];
        return {
          ...s,
          completed: true,
          completedAt: newRecord.date,
          completionCount: completions.length,
          completions,
        };
      }
      return s;
    });
    setSegments(updated);
    saveStoredSegments(updated);
    if (detailSegment && detailSegment.id === segmentId) {
      setDetailSegment(updated.find((s) => s.id === segmentId) || null);
    }
  };

  // Update notes on segment
  const handleUpdateNotes = (segmentId: string, notes: string) => {
    const updated = segments.map((s) => (s.id === segmentId ? { ...s, notes } : s));
    setSegments(updated);
    saveStoredSegments(updated);
    if (detailSegment && detailSegment.id === segmentId) {
      setDetailSegment(updated.find((s) => s.id === segmentId) || null);
    }
  };

  // Route Builder actions
  const handleAddSegmentToRoute = (segmentId: string) => {
    if (!activeRouteSegmentIds.includes(segmentId)) {
      setActiveRouteSegmentIds([...activeRouteSegmentIds, segmentId]);
    }
  };

  const handleRemoveSegmentFromRoute = (index: number) => {
    const updated = [...activeRouteSegmentIds];
    updated.splice(index, 1);
    setActiveRouteSegmentIds(updated);
  };

  const handleClearRoute = () => {
    setActiveRouteSegmentIds([]);
  };

  const handleSaveRoute = (name: string, description: string, notes: string) => {
    const routeSegments = activeRouteSegmentIds
      .map((id) => segments.find((s) => s.id === id))
      .filter(Boolean) as TrailSegment[];

    const dist = routeSegments.reduce((acc, s) => acc + s.distanceKm, 0);
    const gain = routeSegments.reduce((acc, s) => acc + s.elevationGainM, 0);
    const loss = routeSegments.reduce((acc, s) => acc + s.elevationLossM, 0);
    const hours = Math.round(((dist / 4.2) + (gain / 500)) * 10) / 10;

    const newRoute: SavedRoute = {
      id: `route-${Date.now()}`,
      name,
      description,
      segmentIds: [...activeRouteSegmentIds],
      totalDistanceKm: Math.round(dist * 10) / 10,
      totalGainM: gain,
      totalLossM: loss,
      estimatedHours: hours,
      notes,
      createdAt: new Date().toISOString(),
      regionId: activeRegionId,
    };

    const updated = [newRoute, ...savedRoutes];
    setSavedRoutes(updated);
    saveStoredRoutes(updated);
    setActiveRouteSegmentIds([]);
  };

  const handleDeleteSavedRoute = (routeId: string) => {
    const updated = savedRoutes.filter((r) => r.id !== routeId);
    setSavedRoutes(updated);
    saveStoredRoutes(updated);
  };

  const handleHighlightRoute = (segmentIds: string[]) => {
    setActiveRouteSegmentIds(segmentIds);
    setActiveTab('planner');
  };

  // Reset to default Mt Taranaki network
  const handleResetToDefaults = () => {
    const res = resetToDefaults();
    setNodes(res.nodes);
    setSegments(res.segments);
    setSavedRoutes(res.routes);
    setRegions(res.regions);
    setSelectedSegmentId(null);
    setSelectedNodeId(null);
    setActiveRouteSegmentIds([]);
    setGpxPreviewTrack(null);
  };

  // Restore from JSON backup
  const handleImportBackup = (data: any) => {
    if (data.nodes) {
      setNodes(data.nodes);
      saveStoredNodes(data.nodes);
    }
    if (data.segments) {
      setSegments(data.segments);
      saveStoredSegments(data.segments);
    }
    if (data.routes) {
      setSavedRoutes(data.routes);
      saveStoredRoutes(data.routes);
    }
    if (data.regions) {
      setRegions(data.regions);
      saveStoredRegions(data.regions);
    }
    if (data.settings) {
      setSettings(data.settings);
      saveStoredSettings(data.settings);
    }
  };

  // Map click when in Add Node mode
  const handleMapClickCoordinates = (coords: { lat: number; lng: number }) => {
    setClickedMapCoords(coords);
    setEditingNode(null);
    setIsNodeEditModalOpen(true);
    setIsAddingNodeMode(false);
  };

  // Map clicks on segment / node
  const handleSelectSegmentFromMap = (segId: string) => {
    setSelectedSegmentId(segId);
    const seg = segments.find((s) => s.id === segId);
    if (seg) {
      setDetailSegment(seg);
      setIsSegmentDetailModalOpen(true);
    }
  };

  const handleSelectNodeFromMap = (node: TrailNode) => {
    setSelectedNodeId(node.id);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#F5F3EE] text-[#485057] overflow-hidden font-sans">
      {/* Top Application Bar */}
      <Header
        settings={settings}
        onUpdateSettings={updateSettings}
        regions={regions}
        activeRegionId={activeRegionId}
        onSelectRegion={setActiveRegionId}
        onOpenGpxUpload={() => setIsGpxModalOpen(true)}
        onOpenSupabase={() => setIsSupabaseModalOpen(true)}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      {/* Main Workspace: Navigation Panel + Dominant Map Canvas */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Toggle Sidebar Button (Mobile) */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute bottom-6 right-4 z-30 md:hidden w-8 h-8 rounded-[4px] bg-[#FCFBF7] border border-[#D5D0C6] text-[#213026] hover:bg-[#F5F3EE] flex items-center justify-center shadow-sm"
          title="Toggle Navigation Panel"
        >
          {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
        </button>

        {/* Collapsible Left Navigation Panel */}
        <div
          className={`${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0 md:overflow-hidden md:border-none'
          } transition-all duration-200 ease-in-out absolute md:relative z-20 h-full w-[85vw] sm:w-[320px] md:w-[290px] lg:w-[310px] border-r border-[#E8E5DD] bg-[#FCFBF7]`}
        >
          <TrailSidebar
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            nodes={nodes}
            segments={segments}
            savedRoutes={savedRoutes}
            activeRegionId={activeRegionId}
            selectedSegmentId={selectedSegmentId}
            onSelectSegment={(id) => {
              setSelectedSegmentId(id);
              const seg = segments.find((s) => s.id === id);
              if (seg) {
                setDetailSegment(seg);
                setIsSegmentDetailModalOpen(true);
              }
            }}
            onOpenSegmentDetail={(seg) => {
              setDetailSegment(seg);
              setIsSegmentDetailModalOpen(true);
            }}
            onOpenNodeEdit={(node) => {
              setEditingNode(node);
              setIsNodeEditModalOpen(true);
            }}
            onOpenAddNode={() => {
              setEditingNode(null);
              setClickedMapCoords({ lat: activeRegion.center[1], lng: activeRegion.center[0] });
              setIsNodeEditModalOpen(true);
            }}
            isAddingNodeMode={isAddingNodeMode}
            onCancelAddNode={() => setIsAddingNodeMode(false)}
            onOpenAddSegment={() => setIsAddSegmentModalOpen(true)}
            onToggleCompleteSegment={handleToggleCompleteSegment}
            onToggleVisitedNode={handleToggleVisitedNode}
            activeRouteSegmentIds={activeRouteSegmentIds}
            onAddSegmentToRoute={handleAddSegmentToRoute}
            onRemoveSegmentFromRoute={handleRemoveSegmentFromRoute}
            onClearRoute={handleClearRoute}
            onSaveRoute={handleSaveRoute}
            onDeleteSavedRoute={handleDeleteSavedRoute}
            onHighlightRoute={handleHighlightRoute}
            settings={settings}
            onOpenGpxUpload={() => setIsGpxModalOpen(true)}
          />
        </div>

        {/* Primary Interface: Leaflet Map (~70% screen space) */}
        <main className="flex-1 h-full relative bg-[#E8E5DD] z-0 isolate">
          <TrailMap
            settings={settings}
            activeRegion={activeRegion}
            nodes={nodes}
            segments={segments}
            selectedSegmentId={selectedSegmentId}
            onSelectSegment={handleSelectSegmentFromMap}
            selectedNodeId={selectedNodeId}
            onSelectNode={handleSelectNodeFromMap}
            onOpenNodeEdit={(node) => {
              setEditingNode(node);
              setIsNodeEditModalOpen(true);
            }}
            onDeleteNode={handleDeleteNode}
            onToggleVisitedNode={handleToggleVisitedNode}
            onMapClickCoordinates={handleMapClickCoordinates}
            isAddingNodeMode={isAddingNodeMode}
            onCancelAddNode={() => setIsAddingNodeMode(false)}
            activeRouteSegmentIds={activeRouteSegmentIds}
            gpxPreviewTrack={gpxPreviewTrack}
            onToggleCompleteSegment={handleToggleCompleteSegment}
          />
        </main>
      </div>

      {/* Modals */}
      <GpxUploadModal
        isOpen={isGpxModalOpen}
        onClose={() => {
          setIsGpxModalOpen(false);
          setGpxPreviewTrack(null);
        }}
        nodes={nodes.filter((n) => n.regionId === activeRegionId)}
        activeRegionId={activeRegionId}
        onSaveSegment={handleSaveSegment}
        onSetPreviewTrack={setGpxPreviewTrack}
        onSaveNode={handleSaveNode}
      />

      <NodeEditModal
        isOpen={isNodeEditModalOpen}
        onClose={() => {
          setIsNodeEditModalOpen(false);
          setEditingNode(null);
          setClickedMapCoords(null);
        }}
        node={editingNode}
        defaultCoordinates={clickedMapCoords}
        activeRegionId={activeRegionId}
        onSaveNode={handleSaveNode}
        onDeleteNode={handleDeleteNode}
        onPickOnMap={() => {
          setIsNodeEditModalOpen(false);
          setIsAddingNodeMode(true);
        }}
      />

      <SegmentDetailModal
        isOpen={isSegmentDetailModalOpen}
        onClose={() => {
          setIsSegmentDetailModalOpen(false);
          setDetailSegment(null);
        }}
        segment={detailSegment}
        nodes={nodes}
        onToggleComplete={handleToggleCompleteSegment}
        onAddCompletion={handleAddCompletion}
        onUpdateNotes={handleUpdateNotes}
        onDeleteSegment={handleDeleteSegment}
      />

      <AddSegmentModal
        isOpen={isAddSegmentModalOpen}
        onClose={() => setIsAddSegmentModalOpen(false)}
        nodes={nodes.filter((n) => n.regionId === activeRegionId)}
        activeRegionId={activeRegionId}
        onSaveSegment={handleSaveSegment}
      />

      <SupabaseModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
        onResetToDefaults={handleResetToDefaults}
        onImportBackup={handleImportBackup}
      />
    </div>
  );
}
