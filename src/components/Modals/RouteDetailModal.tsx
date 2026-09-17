import React, { useState } from 'react';
import { 
  SavedRoute, 
  TrailNode,
  TrailSegment 
} from '../../types';
import { 
  X, 
  Download, 
  ChevronDown, 
  Map as MapIcon, 
  ArrowUpRight, 
  ArrowDownRight,
  Route,
  Check,
  Share2
} from 'lucide-react';
import { exportToGpx } from '../../utils/geo';

interface RouteDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  route: SavedRoute | null;
  segments: TrailSegment[];
  nodes: TrailNode[];
  onToggleComplete: (routeId: string) => void;
  onUpdateCompletionTime?: (routeId: string, time: string) => void;
}

export const RouteDetailModal: React.FC<RouteDetailModalProps> = ({
  isOpen,
  onClose,
  route,
  segments,
  nodes,
  onToggleComplete,
  onUpdateCompletionTime
}) => {
  const [expandedSegments, setExpandedSegments] = useState<Record<string, boolean>>({});
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  if (!isOpen || !route) return null;

  const routeSegments = route.segmentIds
    .map(id => segments.find(s => s.id === id))
    .filter(Boolean) as TrailSegment[];

  const toggleSegment = (id: string, index: number) => {
    const key = `${id}-${index}`;
    setExpandedSegments(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleDownloadGpx = () => {
    const combinedCoords: [number, number, number?][] = [];
    routeSegments.forEach(s => {
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

  const handleShareLink = () => {
    // Since nodes and segments are now hardcoded defaults, we can share just by IDs
    const baseUrl = window.location.origin + window.location.pathname;
    const segmentIds = route.segmentIds.join(',');
    const shareUrl = `${baseUrl}?route=${encodeURIComponent(route.name)}&segments=${segmentIds}`;
    
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-[#FCFBF7] w-full max-w-lg rounded-[8px] shadow-2xl border border-[#D1CDBC] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#C5C1B1] flex items-center justify-between bg-[#F5F3EE] rounded-t-[8px]">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-[4px] text-white ${route.completed ? 'bg-[#2D6A4F]' : 'bg-[#555555]'}`}>
              <Route className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1A1A1A] leading-none">{route.name}</h2>
              <p className="text-[10px] text-[#555555] font-mono mt-1 uppercase tracking-wider">
                {route.completed ? 'Completed Route' : 'Planned Route'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleComplete(route.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] text-[10px] font-bold font-mono uppercase transition-all border ${
                route.completed 
                  ? 'bg-[#2D6A4F] text-white border-[#2D6A4F]' 
                  : 'bg-white text-[#555555] border-[#D1CDBC] hover:bg-[#F5F3EE]'
              }`}
            >
              <Check className="w-3 h-3" />
              {route.completed ? 'Done' : 'Mark Done'}
            </button>
            <button 
              onClick={onClose}
              className="p-1 hover:bg-[#D1CDBC] rounded-[4px] transition-colors text-[#555555]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {/* Global Stats Dashboard */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-[#C5C1B1] rounded-[6px] p-2.5 shadow-sm">
              <div className="text-[10px] font-mono text-[#555555] uppercase mb-0.5">Distance</div>
              <div className="text-lg font-mono font-bold text-[#1A1A1A]">{route.totalDistanceKm.toFixed(1)}<span className="text-xs font-normal ml-0.5">km</span></div>
            </div>
            <div className="bg-white border border-[#C5C1B1] rounded-[6px] p-2.5 shadow-sm">
              <div className="text-[10px] font-mono text-[#2D6A4F] uppercase mb-0.5">Ascent</div>
              <div className="text-lg font-mono font-bold text-[#2D6A4F]">+{route.totalGainM}<span className="text-xs font-normal ml-0.5">m</span></div>
            </div>
            <div className="bg-white border border-[#C5C1B1] rounded-[6px] p-2.5 shadow-sm">
              <div className="text-[10px] font-mono text-[#A44A3F] uppercase mb-0.5">Descent</div>
              <div className="text-lg font-mono font-bold text-[#A44A3F]">-{route.totalLossM}<span className="text-xs font-normal ml-0.5">m</span></div>
            </div>
          </div>

          {route.completed && (
            <div className="p-3 bg-[#E8F0EB] border border-[#74C69D] rounded-[6px]">
              <div className="flex items-center gap-2 mb-2">
                <Check className="w-4 h-4 text-[#2D6A4F]" />
                <span className="text-sm font-bold text-[#2D6A4F]">Completed Route</span>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-[#555555] uppercase">Time to Complete</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="e.g. 5h 30m"
                    value={route.completionTime || ''}
                    onChange={(e) => onUpdateCompletionTime?.(route.id, e.target.value)}
                    className="bg-white border border-[#D1CDBC] rounded-[4px] px-2 py-1.5 text-sm w-full focus:outline-none focus:border-[#2D6A4F]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Segment List */}
          <div className="space-y-2">
            <h3 className="text-[11px] font-bold text-[#1A1A1A] uppercase tracking-wider flex items-center gap-1.5">
              <MapIcon className="w-3.5 h-3.5 text-[#2D6A4F]" />
              Route Stages ({routeSegments.length})
            </h3>
            
            <div className="space-y-1.5">
              {routeSegments.map((seg, idx) => {
                const key = `${seg.id}-${idx}`;
                const isExpanded = expandedSegments[key];

                return (
                  <div 
                    key={key}
                    className="bg-white border border-[#C5C1B1] rounded-[6px] overflow-hidden transition-all shadow-sm"
                  >
                    <button
                      onClick={() => toggleSegment(seg.id, idx)}
                      className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#F5F3EE] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono font-bold text-[#555555] bg-[#F5F3EE] w-5 h-5 flex items-center justify-center rounded-full shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-[11px] font-bold text-[#1A1A1A] uppercase tracking-tight">Segment {idx + 1}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-[10px] font-mono text-[#555555]">{seg.distanceKm.toFixed(1)}km</span>
                        <ChevronDown className={`w-3.5 h-3.5 text-[#555555] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 border-t border-[#F5F3EE] bg-[#FCFBF7]">
                        <div className="grid grid-cols-2 gap-4 mt-2">
                          <div className="flex items-center gap-2">
                            <div className="p-1 bg-[#2D6A4F]/10 rounded">
                              <ArrowUpRight className="w-3 h-3 text-[#2D6A4F]" />
                            </div>
                            <div>
                              <div className="text-[9px] text-[#555555] uppercase font-mono">Ascent</div>
                              <div className="text-xs font-mono font-bold text-[#2D6A4F]">+{seg.elevationGainM}m</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="p-1 bg-[#A44A3F]/10 rounded">
                              <ArrowDownRight className="w-3 h-3 text-[#A44A3F]" />
                            </div>
                            <div>
                              <div className="text-[9px] text-[#555555] uppercase font-mono">Descent</div>
                              <div className="text-xs font-mono font-bold text-[#A44A3F]">-{seg.elevationLossM}m</div>
                            </div>
                          </div>
                        </div>
                        {seg.surface && (
                          <div className="mt-3 pt-2 border-t border-[#F5F3EE] flex items-center justify-between">
                            <span className="text-[10px] text-[#555555]">Surface: <span className="text-[#1A1A1A] font-medium capitalize">{seg.surface}</span></span>
                            <span className="text-[10px] text-[#555555]">Difficulty: <span className="text-[#1A1A1A] font-medium capitalize">{seg.difficulty}</span></span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#C5C1B1] flex items-center justify-between bg-[#F5F3EE] rounded-b-[8px]">
          <button
            onClick={handleShareLink}
            className={`flex items-center gap-2 px-4 py-2 rounded-[6px] text-xs font-bold transition-all shadow-sm active:scale-95 border ${
              copyStatus === 'copied' 
                ? 'bg-[#E8F0EB] text-[#2D6A4F] border-[#2D6A4F]' 
                : 'bg-white text-[#1A1A1A] border-[#D1CDBC] hover:bg-white/80'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            {copyStatus === 'copied' ? 'Link Copied!' : 'Share Link'}
          </button>
          
          <button
            onClick={handleDownloadGpx}
            className="flex items-center gap-2 px-4 py-2 bg-[#2D6A4F] hover:bg-[#23533E] text-white rounded-[6px] text-xs font-bold transition-all shadow-md active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            Download GPX
          </button>
        </div>
      </div>
    </div>
  );
};
