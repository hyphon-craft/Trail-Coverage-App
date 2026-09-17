import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Upload, 
  X, 
  FileText, 
  Check, 
  AlertCircle,
  ArrowRight,
  Trash2,
  Plus,
  ChevronRight,
  ChevronLeft,
  Search,
  Minus,
  Maximize2
} from 'lucide-react';
import { GpxParsedTrack, TrailNode, TrailSegment } from '../../types';
import { parseGpx, findNodesAlongTrack, getTrackSegmentSlice, getNodeDisplayName } from '../../utils/geo';

interface GpxUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: TrailNode[];
  activeRegionId: string;
  onSaveSegment: (newSegment: Omit<TrailSegment, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onSaveMultipleSegments: (newSegments: Omit<TrailSegment, 'id' | 'createdAt' | 'updatedAt'>[]) => void;
  onSetPreviewTrack: (track: GpxParsedTrack | null) => void;
  onSaveNode?: (node: TrailNode) => void;
}

type ModalStep = 'UPLOAD' | 'MATCH_NODES' | 'REVIEW_SEGMENTS';

interface MatchedNodeItem {
  id: string; // for React keys
  node: TrailNode;
  index: number; // index in track points
}

interface ProposedSegment {
  id: string;
  name: string;
  startNode: TrailNode;
  endNode: TrailNode;
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  coordinates: [number, number, number?][];
  approved: boolean;
}

export const GpxUploadModal: React.FC<GpxUploadModalProps> = ({
  isOpen,
  onClose,
  nodes,
  activeRegionId,
  onSaveSegment,
  onSaveMultipleSegments,
  onSetPreviewTrack,
  onSaveNode,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [track, setTrack] = useState<GpxParsedTrack | null>(null);
  const [step, setStep] = useState<ModalStep>('UPLOAD');
  const [isMinimized, setIsMinimized] = useState(false);

  // Node matching states
  const [matchedNodes, setMatchedNodes] = useState<MatchedNodeItem[]>([]);
  const [nodeSearchQuery, setNodeSearchQuery] = useState('');
  
  // Segment states
  const [proposedSegments, setProposedSegments] = useState<ProposedSegment[]>([]);
  const [commonDifficulty, setCommonDifficulty] = useState<TrailSegment['difficulty']>('moderate');
  const [commonSurface, setCommonSurface] = useState<TrailSegment['surface']>('track');
  const [markCompleted, setMarkCompleted] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setStep('UPLOAD');
      setTrack(null);
      setMatchedNodes([]);
      setProposedSegments([]);
      setError(null);
      setIsMinimized(false);
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredNodes = useMemo(() => {
    if (!nodeSearchQuery.trim()) return [];
    const query = nodeSearchQuery.toLowerCase();
    return nodes.filter(n => 
      !matchedNodes.some(m => m.node.id === n.id) && 
      (n.name.toLowerCase().includes(query) || n.type.toLowerCase().includes(query))
    ).slice(0, 5);
  }, [nodes, nodeSearchQuery, matchedNodes]);

  const elevationWarning = useMemo(() => {
    if (!track) return null;
    if (track.validElevationCount === 0) return 'No elevation data found in this GPX file.';
    const ratio = track.validElevationCount / track.pointCount;
    if (ratio < 0.5) return 'Insufficient elevation data detected. Totals may be unreliable.';
    return null;
  }, [track]);

  const handleFileProcess = (file: File) => {
    setError(null);
    if (!file.name.toLowerCase().endsWith('.gpx')) {
      setError('Please provide a valid .gpx track file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = parseGpx(content);
        setTrack(parsed);
        onSetPreviewTrack(parsed);

        // Auto detect nodes within 20m
        const matches = findNodesAlongTrack(parsed.points, nodes, 20);
        setMatchedNodes(matches.map(m => ({
          id: `match-${Date.now()}-${Math.random()}`,
          node: m.node,
          index: m.index
        })));

        setStep('MATCH_NODES');
      } catch (err: any) {
        setError(err.message || 'Failed to parse GPX file.');
      }
    };
    reader.readAsText(file);
  };

  // Re-scan nodes if nodes list updates (e.g. user added them while minimized)
  useEffect(() => {
    if (step === 'MATCH_NODES' && track) {
      // 1. Remove any nodes that have been deleted from the global nodes list (Fix Ghost Nodes)
      setMatchedNodes(prev => {
        const validNodeIds = new Set(nodes.map(n => n.id));
        const filtered = prev.filter(m => validNodeIds.has(m.node.id));
        
        // 2. Scan for any new nodes that might match
        if (!isMinimized) {
          const matches = findNodesAlongTrack(track.points, nodes, 20);
          const existingNodeIds = new Set(filtered.map(m => m.node.id));
          const newMatches = matches
            .filter(m => !existingNodeIds.has(m.node.id))
            .map(m => ({
              id: `match-auto-${Date.now()}-${Math.random()}`,
              node: m.node,
              index: m.index
            }));
          
          if (newMatches.length === 0) return filtered;
          return [...filtered, ...newMatches].sort((a, b) => a.index - b.index);
        }
        
        return filtered;
      });
    }
  }, [nodes, step, track, isMinimized]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleAddManualNode = (node: TrailNode) => {
    if (!track) return;
    
    // Find closest point on track to this node
    let minDistance = Infinity;
    let closestIndex = -1;

    for (let i = 0; i < track.points.length; i++) {
      const p = track.points[i];
      const dist = Math.sqrt(Math.pow(node.lat - p.lat, 2) + Math.pow(node.lng - p.lng, 2));
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = i;
      }
    }

    const newItem: MatchedNodeItem = {
      id: `match-${Date.now()}-${Math.random()}`,
      node,
      index: closestIndex
    };

    const updated = [...matchedNodes, newItem].sort((a, b) => a.index - b.index);
    setMatchedNodes(updated);
    setNodeSearchQuery('');
  };

  const handleRemoveMatchedNode = (matchId: string) => {
    setMatchedNodes(matchedNodes.filter(m => m.id !== matchId));
  };

  const generateSegments = () => {
    if (!track || matchedNodes.length < 2) {
      setError('At least two nodes are required to generate segments.');
      return;
    }

    const segments: ProposedSegment[] = [];
    for (let i = 0; i < matchedNodes.length - 1; i++) {
      const start = matchedNodes[i];
      const end = matchedNodes[i + 1];
      
      // Skip if nodes are at the same point (can happen with manual selection or very close nodes)
      if (start.index === end.index) continue;

      const slice = getTrackSegmentSlice(track.points, start.index, end.index);
      
      segments.push({
        id: `prop-seg-${i}`,
        name: `${start.node.name} to ${end.node.name}`,
        startNode: start.node,
        endNode: end.node,
        distanceKm: slice.distanceKm,
        elevationGainM: slice.gainM,
        elevationLossM: slice.lossM,
        coordinates: slice.coordinates,
        approved: true
      });
    }

    if (segments.length === 0) {
      setError('Could not generate any segments. Ensure nodes are at different positions along the track.');
      return;
    }

    setProposedSegments(segments);
    setStep('REVIEW_SEGMENTS');
    setError(null);
  };

  const handleSaveApproved = () => {
    const toSave = proposedSegments
      .filter(s => s.approved)
      .map(s => ({
        name: '', // Segment names are now strictly Number to Number via display functions
        startNodeId: s.startNode.id,
        endNodeId: s.endNode.id,
        distanceKm: s.distanceKm,
        elevationGainM: s.elevationGainM,
        elevationLossM: s.elevationLossM,
        coordinates: s.coordinates,
        regionId: activeRegionId
      }));

    onSaveMultipleSegments(toSave);
    onClose();
  };

  if (!isOpen) return null;

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-sm">
        <div className="bg-[#2D6A4F] border border-[#40916C] shadow-lg rounded-[6px] p-2 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5 px-1">
            <Upload className="w-3.5 h-3.5 text-[#E9C46A]" />
            <div className="min-w-0">
              <div className="text-[10px] font-mono uppercase tracking-wider opacity-80 leading-none mb-0.5">GPX Import Active</div>
              <div className="text-xs font-bold truncate max-w-[180px]">
                {step === 'MATCH_NODES' ? `Matching: ${matchedNodes.length} nodes` : `Reviewing segments`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setIsMinimized(false)}
              className="p-1.5 hover:bg-white/10 rounded-[3px] transition-colors"
              title="Maximize"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-[3px] transition-colors"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <p className="text-[10px] text-center mt-2 text-[#555555] font-medium bg-[#FCFBF7]/80 backdrop-blur-sm px-2 py-0.5 rounded-full mx-auto w-fit">
          Add missing waypoints on map using sidebar while minimized.
        </p>
      </div>
    );
  }

  const renderUploadStep = () => (
    <div
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`border border-dashed rounded-[6px] p-12 text-center cursor-pointer transition-colors ${
        dragActive
          ? 'border-[#2D6A4F] bg-[#F5F3EE]'
          : 'border-[#D1CDBC] bg-[#FCFBF7] hover:border-[#40916C] hover:bg-[#F5F3EE]'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".gpx"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFileProcess(e.target.files[0]);
          }
        }}
      />
      <div className="w-12 h-12 mx-auto rounded-[8px] bg-[#F5F3EE] border border-[#D1CDBC] flex items-center justify-center text-[#2D6A4F] mb-3">
        <Upload className="w-6 h-6" />
      </div>
      <p className="text-sm font-bold text-[#1A1A1A] font-sans">
        Drop GPX file here or click to browse
      </p>
      <p className="text-[11px] font-mono text-[#555555] mt-1.5">
        Automatically matches track junctions and splits segments.
      </p>
    </div>
  );

  const renderMatchNodesStep = () => (
    <div className="space-y-4">
      {track && (
        <div className="bg-[#FCFBF7] border border-[#D1CDBC] rounded-[6px] p-3">
          <h3 className="text-xs font-bold text-[#1A1A1A] mb-2 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            Elevation Analysis
          </h3>
          
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3">
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-[#555555]">
                <span>Raw Gain:</span>
                <span className="font-bold text-[#2B2B2B]">+{track.rawElevationGainM}m</span>
              </div>
              <div className="flex justify-between text-[10px] font-mono text-[#555555]">
                <span>Smoothed Gain:</span>
                <span className="font-bold text-[#2D6A4F]">+{track.smoothedElevationGainM}m</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-[#555555]">
                <span>Min/Max:</span>
                <span className="font-bold text-[#2B2B2B]">{track.minElevationM}m / {track.maxElevationM}m</span>
              </div>
              <div className="flex justify-between text-[10px] font-mono text-[#555555]">
                <span>Elevation Data:</span>
                <span className={`font-bold ${track.validElevationCount / track.pointCount < 0.5 ? 'text-[#A44A3F]' : 'text-[#2D6A4F]'}`}>
                  {((track.validElevationCount / track.pointCount) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>

          <div className="text-[10px] font-mono text-[#555555] flex justify-between border-t border-[#F5F3EE] pt-2">
            <span>Points: {track.pointCount}</span>
            <span>Distance: {track.distanceKm} km</span>
          </div>

          {elevationWarning && (
            <div className="mt-2 p-1.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-[4px] text-[#92400E] text-[10px] font-mono flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3 shrink-0" />
              {elevationWarning}
            </div>
          )}
        </div>
      )}

      <div className="bg-[#F5F3EE] border border-[#D1CDBC] rounded-[6px] p-3">
        <h3 className="text-xs font-bold text-[#1A1A1A] mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5" />
            Nodes Matched Along Track
          </div>
          <button 
            onClick={() => {
              const matches = findNodesAlongTrack(track!.points, nodes, 20);
              setMatchedNodes(prev => {
                const existingNodeIds = new Set(prev.map(m => m.node.id));
                const newMatches = matches
                  .filter(m => !existingNodeIds.has(m.node.id))
                  .map(m => ({
                    id: `match-refresh-${Date.now()}`,
                    node: m.node,
                    index: m.index
                  }));
                return [...prev, ...newMatches].sort((a, b) => a.index - b.index);
              });
            }}
            className="text-[10px] text-[#2D6A4F] hover:underline font-mono"
          >
            Refresh Matches
          </button>
        </h3>
        
        {matchedNodes.length === 0 ? (
          <div className="text-center py-4 text-[#555555] italic text-xs font-mono">
            No existing nodes found within 20m of track.
          </div>
        ) : (
          <div className="space-y-1.5">
            {matchedNodes.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-2 bg-[#FCFBF7] border border-[#D1CDBC] p-2 rounded-[4px]">
                <div className="w-5 h-5 rounded-full bg-[#2D6A4F] text-white flex items-center justify-center text-[10px] font-bold">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-[#1A1A1A] truncate">{item.node.name}</div>
                  <div className="text-[10px] font-mono text-[#555555]">Pos: {((item.index / (track?.points.length || 1)) * 100).toFixed(0)}%</div>
                </div>
                <button 
                  onClick={() => handleRemoveMatchedNode(item.id)}
                  className="p-1 text-[#A44A3F] hover:bg-[#FDF2F2] rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <label className="text-[11px] font-bold text-[#1A1A1A] mb-1 block">Add Missing Node Manually</label>
        <div className="relative">
          <input 
            type="text"
            placeholder="Search for junction, hut, or peak..."
            value={nodeSearchQuery}
            onChange={(e) => setNodeSearchQuery(e.target.value)}
            className="w-full bg-[#FCFBF7] border border-[#D1CDBC] rounded-[4px] px-8 py-2 text-xs focus:outline-none focus:border-[#2D6A4F]"
          />
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[#555555]" />
        </div>
        
        {filteredNodes.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-[#D1CDBC] rounded-[4px] shadow-lg overflow-hidden">
            {filteredNodes.map(n => (
              <button
                key={n.id}
                onClick={() => handleAddManualNode(n)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F3EE] flex items-center justify-between"
              >
                <span>{n.name} <span className="text-[10px] text-[#555555]">({n.type})</span></span>
                <Plus className="w-3 h-3 text-[#2D6A4F]" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-between items-center pt-2">
        <button
          onClick={() => setStep('UPLOAD')}
          className="flex items-center gap-1 text-xs font-semibold text-[#2B2B2B] hover:text-[#1A1A1A]"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <button
          disabled={matchedNodes.length < 2}
          onClick={generateSegments}
          className={`flex items-center gap-1 px-4 py-1.5 rounded-[4px] text-xs font-bold shadow-sm border transition-colors ${
            matchedNodes.length < 2
              ? 'bg-[#C5C1B1] text-[#555555] border-[#D1CDBC] cursor-not-allowed'
              : 'bg-[#2D6A4F] text-white border-[#2D6A4F] hover:bg-[#23533E]'
          }`}
        >
          Identify Segments
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const renderReviewSegmentsStep = () => (
    <div className="space-y-4">
      <div className="max-h-[350px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {proposedSegments.map((seg, idx) => (
          <div key={seg.id} className={`border rounded-[6px] overflow-hidden ${seg.approved ? 'border-[#D1CDBC] bg-[#FCFBF7]' : 'border-[#C5C1B1] bg-gray-50 opacity-60'}`}>
            <div className="flex items-center p-2 gap-2 border-b border-[#C5C1B1]">
              <input 
                type="checkbox"
                checked={seg.approved}
                onChange={() => {
                  const updated = [...proposedSegments];
                  updated[idx].approved = !updated[idx].approved;
                  setProposedSegments(updated);
                }}
                className="w-3.5 h-3.5 text-[#2D6A4F] rounded focus:ring-0"
              />
              <div className="flex-1 bg-transparent text-xs font-bold p-0 text-[#1A1A1A]">
                {getNodeDisplayName(seg.startNode)} to {getNodeDisplayName(seg.endNode)}
              </div>
              <span className="text-[10px] font-mono text-[#555555] whitespace-nowrap">{seg.distanceKm.toFixed(1)} km</span>
            </div>
            <div className="p-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] font-mono text-[#2B2B2B]">
              <div className="flex justify-between border-b border-[#F5F3EE]">
                <span>Start:</span>
                <span className="font-semibold text-[#1A1A1A] truncate ml-1">{getNodeDisplayName(seg.startNode)}</span>
              </div>
              <div className="flex justify-between border-b border-[#F5F3EE]">
                <span>End:</span>
                <span className="font-semibold text-[#1A1A1A] truncate ml-1">{getNodeDisplayName(seg.endNode)}</span>
              </div>
              <div className="flex justify-between">
                <span>Ascent:</span>
                <span className="text-[#2D6A4F]">+{seg.elevationGainM}m</span>
              </div>
              <div className="flex justify-between">
                <span>Descent:</span>
                <span className="text-[#A44A3F]">-{seg.elevationLossM}m</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end pt-2">
        <div className="flex gap-2">
          <button
            onClick={() => setStep('MATCH_NODES')}
            className="px-3 py-1.5 text-xs font-semibold text-[#2B2B2B] hover:text-[#1A1A1A] border border-[#D1CDBC] rounded-[4px]"
          >
            Back
          </button>
          <button
            onClick={handleSaveApproved}
            className="flex items-center gap-1 px-4 py-1.5 bg-[#2D6A4F] text-white rounded-[4px] text-xs font-bold shadow-sm border border-[#2D6A4F] hover:bg-[#23533E] transition-colors"
          >
            <Check className="w-4 h-4" />
            Save {proposedSegments.filter(s => s.approved).length} Segments
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 bg-black/40"
    >
      <div className="bg-[#FCFBF7] border border-[#D1CDBC] rounded-[6px] w-full max-w-xl max-h-[90vh] flex flex-col shadow-[0_8px_24px_rgba(0,0,0,0.16)] p-5 relative text-[#2B2B2B] select-none">
        {/* Controls */}
        <div className="absolute top-3.5 right-3.5 flex items-center gap-1">
          {step !== 'UPLOAD' && (
            <button
              onClick={() => setIsMinimized(true)}
              className="text-[#555555] hover:text-[#1A1A1A] p-1.5 rounded-[4px] hover:bg-[#F5F3EE] transition-colors"
              title="Minimize to footer"
            >
              <Minus className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-[#555555] hover:text-[#1A1A1A] p-1.5 rounded-[4px] hover:bg-[#F5F3EE] transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2.5 mb-4 border-b border-[#D1CDBC] pb-3 shrink-0">
          <div className="w-7 h-7 rounded-[4px] bg-[#2D6A4F] text-white flex items-center justify-center shadow-xs">
            <Upload className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold font-sans text-[#1A1A1A]">GPX Network Slicer</h2>
            <p className="text-[11px] font-mono text-[#2B2B2B]">
              {step === 'UPLOAD' && 'Load a GPX track to identify trail network segments.'}
              {step === 'MATCH_NODES' && 'Review junction points found along the track.'}
              {step === 'REVIEW_SEGMENTS' && 'Review and approve individual segments before saving.'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-3 p-2 bg-[#FDF2F2] border border-[#F87171] rounded-[4px] text-[#A44A3F] text-xs font-mono flex items-center gap-2 shrink-0">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="overflow-y-auto flex-1">
          {step === 'UPLOAD' && renderUploadStep()}
          {step === 'MATCH_NODES' && renderMatchNodesStep()}
          {step === 'REVIEW_SEGMENTS' && renderReviewSegmentsStep()}
        </div>
      </div>
    </div>
  );
};
