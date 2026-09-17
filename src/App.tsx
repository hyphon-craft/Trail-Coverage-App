import React, { useState, useEffect, useMemo } from 'react';
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
import { RouteDetailModal } from './components/Modals/RouteDetailModal';
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
  const [highlightedRouteSegmentIds, setHighlightedRouteSegmentIds] = useState<string[]>([]);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);

  // Modals
  const [isGpxModalOpen, setIsGpxModalOpen] = useState(false);
  const [isNodeEditModalOpen, setIsNodeEditModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<TrailNode | null>(null);
  const [isAddingNodeMode, setIsAddingNodeMode] = useState(false);
  const [clickedMapCoords, setClickedMapCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [isSegmentDetailModalOpen, setIsSegmentDetailModalOpen] = useState(false);
  const [detailSegment, setDetailSegment] = useState<TrailSegment | null>(null);

  const [isRouteDetailModalOpen, setIsRouteDetailModalOpen] = useState(false);
  const [detailRoute, setDetailRoute] = useState<SavedRoute | null>(null);

  const [isAddSegmentModalOpen, setIsAddSegmentModalOpen] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);

  // Route Builder State
  const [activeRouteSegmentIds, setActiveRouteSegmentIds] = useState<string[]>([]);
  const [plannerLastNodeId, setPlannerLastNodeId] = useState<string | null>(null);
  const [isPlanningStarted, setIsPlanningStarted] = useState(false);

  // GPX Track Preview State
  const [gpxPreviewTrack, setGpxPreviewTrack] = useState<GpxParsedTrack | null>(null);

  // Handle shared route from URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedSegments = params.get('segments');
    const sharedRouteName = params.get('route');

    if (sharedSegments) {
      const segmentIds = sharedSegments.split(',');
      // Validate that all segments exist in our registry
      const validSegmentIds = segmentIds.filter(id => segments.some(s => s.id === id));
      
      if (validSegmentIds.length > 0) {
        // Create a temporary route object for the detail modal
        const tempRoute: SavedRoute = {
          id: 'shared-temp',
          name: sharedRouteName || 'Shared Route',
          segmentIds: validSegmentIds,
          totalDistanceKm: validSegmentIds.reduce((sum, id) => {
            const seg = segments.find(s => s.id === id);
            return sum + (seg?.distanceKm || 0);
          }, 0),
          totalGainM: validSegmentIds.reduce((sum, id) => {
            const seg = segments.find(s => s.id === id);
            return sum + (seg?.elevationGainM || 0);
          }, 0),
          totalLossM: validSegmentIds.reduce((sum, id) => {
            const seg = segments.find(s => s.id === id);
            return sum + (seg?.elevationLossM || 0);
          }, 0),
          estimatedHours: 0,
          completed: false,
          regionId: activeRegionId,
          createdAt: new Date().toISOString()
        };

        setDetailRoute(tempRoute);
        setIsRouteDetailModalOpen(true);
        setHighlightedRouteSegmentIds(validSegmentIds);
        
        // Clean up URL to avoid re-opening on refresh
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }
    }
  }, [segments, activeRegionId]);

  // Migration: Ensure all nodes have a unique nodeNumber
  useEffect(() => {
    let changed = false;
    const regionUsedNumbers = new Map<string, Set<number>>();

    // First pass: collect unique numbers and identify nodes that need reassignment (missing or duplicate)
    const updatedNodes = nodes.map(node => {
      if (!regionUsedNumbers.has(node.regionId)) {
        regionUsedNumbers.set(node.regionId, new Set());
      }
      
      const used = regionUsedNumbers.get(node.regionId)!;
      
      // If it has a number and it's not a duplicate, keep it
      if (node.nodeNumber && !used.has(node.nodeNumber)) {
        used.add(node.nodeNumber);
        return node;
      }

      // If it's a duplicate or missing a number, we'll assign it in the second pass
      changed = true;
      return { ...node, nodeNumber: undefined };
    });

    // Second pass: fill in the blanks
    const finalNodes = updatedNodes.map(node => {
      if (!node.nodeNumber) {
        const used = regionUsedNumbers.get(node.regionId)!;
        let num = 1;
        while (used.has(num)) num++;
        used.add(num);
        return { ...node, nodeNumber: num };
      }
      return node;
    });

    if (changed) {
      setNodes(finalNodes);
      saveStoredNodes(finalNodes);
    }
  }, [nodes.length]); // Focus on nodes length changes

  // Persist updates
  const updateSettings = (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    saveStoredSettings(updated);
  };

  const activeRegion = useMemo(() => 
    regions.find((r) => r.id === activeRegionId) || regions[0],
  [regions, activeRegionId]);

  // Region stats
  const regionSegments = segments.filter((s) => s.regionId === activeRegionId);
  const regionRoutes = savedRoutes.filter((r) => r.regionId === activeRegionId);
  
  const totalDistanceKm = regionSegments.reduce((acc, s) => acc + s.distanceKm, 0);
  // Calculation of completion based ONLY on completed routes
  const completedRouteSegmentIds = new Set<string>();
  regionRoutes.forEach(route => {
    if (route.completed) {
      route.segmentIds.forEach(id => completedRouteSegmentIds.add(id));
    }
  });

  const filteredNodes = useMemo(() => {
    if (settings.segmentFilter === 'all') return nodes;
    
    // Find all segments that match the filter
    const visibleSegments = regionSegments.filter(s => {
      const isCompleted = completedRouteSegmentIds.has(s.id);
      if (settings.segmentFilter === 'completed') return isCompleted;
      if (settings.segmentFilter === 'uncompleted') return !isCompleted;
      return true;
    });

    // Extract node IDs from visible segments
    const activeNodeIds = new Set<string>();
    visibleSegments.forEach(s => {
      activeNodeIds.add(s.startNodeId);
      activeNodeIds.add(s.endNodeId);
    });

    // Return nodes that are either connected to visible segments OR not in the active region
    return nodes.filter(n => n.regionId !== activeRegionId || activeNodeIds.has(n.id));
  }, [nodes, regionSegments, completedRouteSegmentIds, settings.segmentFilter, activeRegionId]);

  const completedDistanceKm = regionSegments
    .filter(s => completedRouteSegmentIds.has(s.id))
    .reduce((acc, s) => acc + s.distanceKm, 0);
    
  const completionPercentage = totalDistanceKm > 0 ? (completedDistanceKm / totalDistanceKm) * 100 : 0;

  // Toggle route completion
  const handleToggleRouteComplete = (routeId: string) => {
    const updated = savedRoutes.map((r) => {
      if (r.id === routeId) {
        const nextCompleted = !r.completed;
        return {
          ...r,
          completed: nextCompleted,
          completedAt: nextCompleted ? new Date().toISOString() : undefined,
        };
      }
      return r;
    });

    setSavedRoutes(updated);
    saveStoredRoutes(updated);

    if (detailRoute && detailRoute.id === routeId) {
      setDetailRoute(updated.find((r) => r.id === routeId) || null);
    }
  };

  const handleUpdateRouteTime = (routeId: string, time: string) => {
    const updated = savedRoutes.map((r) => {
      if (r.id === routeId) {
        return { ...r, completionTime: time };
      }
      return r;
    });
    setSavedRoutes(updated);
    saveStoredRoutes(updated);
    if (detailRoute && detailRoute.id === routeId) {
      setDetailRoute(updated.find((r) => r.id === routeId) || null);
    }
  };

  const handleExportAllData = () => {
    const exportData = {
      nodes,
      segments,
      savedRoutes,
      settings,
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trail_app_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Save Node (Create or Edit)
  const handleSaveNode = (nodeToSave: TrailNode) => {
    let updated: TrailNode[];
    const exists = nodes.some((n) => n.id === nodeToSave.id);
    
    const processedNode = { ...nodeToSave };
    
    // Assign node number if it doesn't have one
    if (!processedNode.nodeNumber) {
      const regionNodes = nodes.filter(n => n.regionId === processedNode.regionId);
      const usedNumbers = new Set(regionNodes.map(n => n.nodeNumber).filter(Boolean) as number[]);
      let num = 1;
      while (usedNumbers.has(num)) num++;
      processedNode.nodeNumber = num;
    }

    if (exists) {
      updated = nodes.map((n) => (n.id === processedNode.id ? processedNode : n));
    } else {
      updated = [processedNode, ...nodes];
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
    setActiveTab('segments');
  };

  // Save Multiple Segments
  const handleSaveMultipleSegments = (
    newSegmentsData: Omit<TrailSegment, 'id' | 'createdAt' | 'updatedAt'>[]
  ) => {
    const timestamp = Date.now();
    
    // Filter out segments that already exist between the same two nodes
    const filteredNewSegments = newSegmentsData.filter(newSeg => {
      const exists = segments.some(existingSeg => 
        (existingSeg.startNodeId === newSeg.startNodeId && existingSeg.endNodeId === newSeg.endNodeId) ||
        (existingSeg.startNodeId === newSeg.endNodeId && existingSeg.endNodeId === newSeg.startNodeId)
      );
      return !exists;
    });

    if (filteredNewSegments.length === 0) return;

    const newSegments: TrailSegment[] = filteredNewSegments.map((data, index) => ({
      ...data,
      id: `seg-${timestamp}-${index}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    
    const updated = [...newSegments, ...segments];
    setSegments(updated);
    saveStoredSegments(updated);
    if (newSegments.length > 0) {
      setSelectedSegmentId(newSegments[0].id);
      setActiveTab('segments');
    }
  };

  // Delete Segment
  const handleDeleteSegment = (segmentId: string) => {
    const updated = segments.filter((s) => s.id !== segmentId);
    setSegments(updated);
    saveStoredSegments(updated);
    setActiveRouteSegmentIds((prev) => prev.filter((id) => id !== segmentId));
    if (selectedSegmentId === segmentId) setSelectedSegmentId(null);
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
      setActiveRouteSegmentIds(prev => [...prev, segmentId]);
    }
  };

  const handleRemoveSegmentFromRoute = (index: number) => {
    const updated = [...activeRouteSegmentIds];
    updated.splice(index, 1);
    setActiveRouteSegmentIds(updated);
  };

  const handleClearRoute = () => {
    setActiveRouteSegmentIds([]);
    setPlannerLastNodeId(null);
    setIsPlanningStarted(false);
    setEditingRouteId(null);
  };

  const handleSaveRoute = (name: string, description: string, notes: string) => {
    const routeSegments = activeRouteSegmentIds
      .map((id) => segments.find((s) => s.id === id))
      .filter(Boolean) as TrailSegment[];

    const dist = routeSegments.reduce((acc, s) => acc + s.distanceKm, 0);
    const gain = routeSegments.reduce((acc, s) => acc + s.elevationGainM, 0);
    const loss = routeSegments.reduce((acc, s) => acc + s.elevationLossM, 0);
    const hours = Math.round(((dist / 4.2) + (gain / 500)) * 10) / 10;

    if (editingRouteId) {
      const updated = savedRoutes.map(r => {
        if (r.id === editingRouteId) {
          return {
            ...r,
            name,
            segmentIds: [...activeRouteSegmentIds],
            totalDistanceKm: Math.round(dist * 10) / 10,
            totalGainM: gain,
            totalLossM: loss,
            estimatedHours: hours,
          };
        }
        return r;
      });
      setSavedRoutes(updated);
      saveStoredRoutes(updated);
      setEditingRouteId(null);
    } else {
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
        completed: false,
        createdAt: new Date().toISOString(),
        regionId: activeRegionId,
      };

      const updated = [newRoute, ...savedRoutes];
      setSavedRoutes(updated);
      saveStoredRoutes(updated);
    }
    
    setActiveRouteSegmentIds([]);
  };

  const handleDeleteSavedRoute = (routeId: string) => {
    // If the route being deleted is currently highlighted, clear the highlight
    const routeToDelete = savedRoutes.find(r => r.id === routeId);
    if (routeToDelete) {
      const isHighlighted = highlightedRouteSegmentIds.length === routeToDelete.segmentIds.length &&
                           highlightedRouteSegmentIds.every((id, i) => id === routeToDelete.segmentIds[i]);
      if (isHighlighted) {
        setHighlightedRouteSegmentIds([]);
      }
    }

    const updated = savedRoutes.filter((r) => r.id !== routeId);
    setSavedRoutes(updated);
    saveStoredRoutes(updated);
  };

  const handleHighlightRoute = (segmentIds: string[]) => {
    // If we're clicking the same route that's already highlighted, unhighlight it
    const isAlreadyHighlighted = highlightedRouteSegmentIds.length === segmentIds.length && 
                                 highlightedRouteSegmentIds.every((id, index) => id === segmentIds[index]);
    
    if (isAlreadyHighlighted) {
      setHighlightedRouteSegmentIds([]);
      return;
    }

    setHighlightedRouteSegmentIds(segmentIds);
    // Also clear other builder states to avoid confusion unless we are editing
    if (!editingRouteId) {
      setPlannerLastNodeId(null);
      setIsPlanningStarted(false);
    }
  };

  const handleEditRoute = (route: SavedRoute) => {
    setEditingRouteId(route.id);
    setActiveRouteSegmentIds(route.segmentIds);
    
    // Set planner head to the end of the last segment to allow continuation
    if (route.segmentIds.length > 0) {
      const lastSegId = route.segmentIds[route.segmentIds.length - 1];
      const lastSeg = segments.find(s => s.id === lastSegId);
      if (lastSeg) {
        setPlannerLastNodeId(lastSeg.endNodeId);
      }
    }
    
    setIsPlanningStarted(true);
    setActiveTab('planner');
    setHighlightedRouteSegmentIds(route.segmentIds);
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
  const handleSelectSegmentFromMap = (segId: string | null) => {
    setSelectedSegmentId(segId);
    if (segId) {
      const seg = segments.find((s) => s.id === segId);
      if (seg) {
        setDetailSegment(seg);
        setIsSegmentDetailModalOpen(true);
      }
    }
  };

  const handleSelectNodeFromMap = (node: TrailNode | null) => {
    setSelectedNodeId(node ? node.id : null);
    
    // Smart Route Planner Logic
    if (activeTab === 'planner' && node && isPlanningStarted) {
      if (!plannerLastNodeId) {
        setPlannerLastNodeId(node.id);
      } else if (plannerLastNodeId !== node.id) {
        // Try to find a segment between last node and this node
        // Use loose comparison or ensure they are the same type if needed, but here we assume strings
        const segment = segments.find(s => 
          (String(s.startNodeId) === String(plannerLastNodeId) && String(s.endNodeId) === String(node.id)) ||
          (String(s.startNodeId) === String(node.id) && String(s.endNodeId) === String(plannerLastNodeId))
        );

        if (segment) {
          // If segment found, add to route
          if (!activeRouteSegmentIds.includes(segment.id)) {
            setActiveRouteSegmentIds(prev => [...prev, segment.id]);
          }
          setPlannerLastNodeId(node.id);
        } else {
          // If no direct segment found between these two specific nodes,
          // check if this node is connected to ANY of the existing nodes in the route?
          // Actually, the user intent for a sequential planner is usually point-to-point.
          // We'll just update the last node to allow them to "jump" to a new start if they missed a connection.
          setPlannerLastNodeId(node.id);
        }
      }
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#F5F3EE] text-[#2B2B2B] overflow-hidden font-sans">
      {/* Top Application Bar */}
      <Header
        settings={settings}
        onUpdateSettings={updateSettings}
        regions={regions}
        activeRegionId={activeRegionId}
        onSelectRegion={setActiveRegionId}
        onOpenGpxUpload={() => setIsGpxModalOpen(true)}
        onOpenSupabase={() => setIsSupabaseModalOpen(true)}
        onExportData={handleExportAllData}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      {/* Main Workspace: Navigation Panel + Dominant Map Canvas */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Toggle Sidebar Button (Mobile) */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute bottom-6 right-4 z-30 md:hidden w-8 h-8 rounded-[4px] bg-[#FCFBF7] border border-[#D1CDBC] text-[#1A1A1A] hover:bg-[#F5F3EE] flex items-center justify-center shadow-sm"
          title="Toggle Navigation Panel"
        >
          {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
        </button>

        {/* Collapsible Left Navigation Panel */}
        <div
          className={`${
            isSidebarOpen 
              ? 'translate-x-0 w-[85vw] sm:w-[320px] md:w-[290px] lg:w-[310px]' 
              : '-translate-x-full md:translate-x-0 md:w-0'
          } transition-all duration-300 ease-in-out absolute md:relative z-20 h-full border-r border-[#C5C1B1] bg-[#FCFBF7] overflow-hidden`}
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
            onToggleCompleteRoute={handleToggleRouteComplete}
            activeRouteSegmentIds={activeRouteSegmentIds}
            onRemoveSegmentFromRoute={handleRemoveSegmentFromRoute}
            onClearRoute={handleClearRoute}
            onSaveRoute={handleSaveRoute}
            onDeleteSavedRoute={handleDeleteSavedRoute}
            onHighlightRoute={handleHighlightRoute}
            highlightedRouteSegmentIds={highlightedRouteSegmentIds}
            onOpenRouteDetail={(route) => {
              setDetailRoute(route);
              setIsRouteDetailModalOpen(true);
              // Also highlight it on the map when detail opens
              setHighlightedRouteSegmentIds(route.segmentIds);
            }}
            onEditRoute={handleEditRoute}
            onUpdateRouteTime={handleUpdateRouteTime}
            plannerLastNodeId={plannerLastNodeId}
            isPlanningStarted={isPlanningStarted}
            onStartPlanning={() => setIsPlanningStarted(true)}
            settings={settings}
            onUpdateSettings={updateSettings}
            onOpenGpxUpload={() => setIsGpxModalOpen(true)}
          />
        </div>

        {/* Primary Interface: Leaflet Map (~70% screen space) */}
        <main className="flex-1 h-full relative bg-[#C5C1B1] z-0 isolate">
          <TrailMap
            settings={settings}
            activeRegion={activeRegion}
            nodes={filteredNodes}
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
            onMapClickCoordinates={handleMapClickCoordinates}
            isAddingNodeMode={isAddingNodeMode}
            onCancelAddNode={() => setIsAddingNodeMode(false)}
            activeRouteSegmentIds={activeRouteSegmentIds}
            highlightedRouteSegmentIds={highlightedRouteSegmentIds}
            plannerLastNodeId={plannerLastNodeId}
            activeTab={activeTab}
            gpxPreviewTrack={gpxPreviewTrack}
            completedSegmentIds={Array.from(completedRouteSegmentIds)}
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
        onSaveMultipleSegments={handleSaveMultipleSegments}
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
        isCompleted={detailSegment ? completedRouteSegmentIds.has(detailSegment.id) : false}
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

      <RouteDetailModal
        isOpen={isRouteDetailModalOpen}
        onClose={() => {
          setIsRouteDetailModalOpen(false);
          setDetailRoute(null);
          setHighlightedRouteSegmentIds([]);
        }}
        route={detailRoute}
        segments={segments}
        nodes={nodes}
        onToggleComplete={handleToggleRouteComplete}
        onUpdateCompletionTime={handleUpdateRouteTime}
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
