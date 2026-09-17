import React, { useState, useMemo } from 'react';
import { 
  X, 
  GripVertical, 
  ArrowUp, 
  ArrowDown, 
  Save, 
  Map as MapIcon,
  Route as RouteIcon,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { TrailNode, TrailSegment, AppSettings } from '../../types';
import { 
  calculateRouteStats, 
  getSegmentDisplayName, 
  getOrderedNodeIdsFromSegments,
  getSegmentsFromNodeSequence,
  getNodeDisplayName
} from '../../utils/geo';

interface SaveRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  segmentIds: string[];
  segments: TrailSegment[];
  nodes: TrailNode[];
  onSave: (name: string, description: string, notes: string, finalSegmentIds: string[], isReturn: boolean) => void;
}

export const SaveRouteModal: React.FC<SaveRouteModalProps> = ({
  isOpen,
  onClose,
  segmentIds: initialSegmentIds,
  segments,
  nodes,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [isReturnTrip, setIsReturnTrip] = useState(false);
  const [orderedNodeIds, setOrderedNodeIds] = useState<string[]>([]);

  // Sync with initialSegmentIds when modal opens
  React.useEffect(() => {
    if (isOpen) {
      const nodeIds = getOrderedNodeIdsFromSegments(initialSegmentIds, segments);
      setOrderedNodeIds(nodeIds);
    }
  }, [isOpen, initialSegmentIds, segments]);

  const { finalSegmentIds, stats, isInvalid } = useMemo(() => {
    const ids = getSegmentsFromNodeSequence(orderedNodeIds, segments);
    if (!ids) {
      return { 
        finalSegmentIds: [], 
        stats: { elevationGainM: 0, elevationLossM: 0, distanceKm: 0 }, 
        isInvalid: true 
      };
    }
    return {
      finalSegmentIds: ids,
      stats: calculateRouteStats(ids, segments, false, isReturnTrip),
      isInvalid: false
    };
  }, [orderedNodeIds, segments, isReturnTrip]);

  if (!isOpen) return null;

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newIds = [...orderedNodeIds];
    const temp = newIds[index];
    newIds[index] = newIds[index - 1];
    newIds[index - 1] = temp;
    setOrderedNodeIds(newIds);
  };

  const handleMoveDown = (index: number) => {
    if (index === orderedNodeIds.length - 1) return;
    const newIds = [...orderedNodeIds];
    const temp = newIds[index];
    newIds[index] = newIds[index + 1];
    newIds[index + 1] = temp;
    setOrderedNodeIds(newIds);
  };

  const handleRemoveNode = (index: number) => {
    if (orderedNodeIds.length <= 2) return; // Must have at least a start and end
    const newIds = [...orderedNodeIds];
    newIds.splice(index, 1);
    setOrderedNodeIds(newIds);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isInvalid) return;
    onSave(name, description, notes, finalSegmentIds, isReturnTrip);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[#FCFBF7] w-full max-w-xl rounded-[8px] shadow-2xl border border-[#D1CDBC] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#C5C1B1] flex items-center justify-between bg-[#F5F3EE] rounded-t-[8px]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#2D6A4F] text-white rounded-[6px] shadow-sm">
              <RouteIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1A1A1A] leading-none">Finalize Route</h2>
              <p className="text-xs text-[#555555] mt-1 font-medium">Set the sequence of stages for accurate elevation profiling.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[#D1CDBC] rounded-[4px] transition-colors text-[#555555]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#1A1A1A] uppercase tracking-wider flex items-center gap-2">
                Route Identity
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Northern Summit Route"
                className="w-full bg-white border border-[#C5C1B1] rounded-[6px] p-2.5 text-sm focus:outline-none focus:border-[#2D6A4F] focus:ring-1 focus:ring-[#2D6A4F]/20"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#1A1A1A] uppercase tracking-wider">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short summary of the journey..."
                  rows={2}
                  className="w-full bg-white border border-[#C5C1B1] rounded-[6px] p-2.5 text-sm focus:outline-none focus:border-[#2D6A4F]"
                />
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-[#1A1A1A] uppercase tracking-wider">Field Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Track conditions, gear requirements..."
                    rows={2}
                    className="w-full bg-white border border-[#C5C1B1] rounded-[6px] p-2.5 text-sm focus:outline-none focus:border-[#2D6A4F]"
                  />
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsReturnTrip(!isReturnTrip)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-[6px] text-xs font-bold transition-all border ${
                      isReturnTrip 
                        ? 'bg-[#2D6A4F]/10 border-[#2D6A4F] text-[#2D6A4F]' 
                        : 'bg-white border-[#D1CDBC] text-[#555555] hover:border-[#2D6A4F]'
                    }`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isReturnTrip ? 'animate-spin-slow' : ''}`} />
                    Return Trip (Out & Back)
                  </button>
                  {isReturnTrip && (
                    <span className="text-[10px] text-[#2D6A4F] font-medium italic">
                      Stats will be doubled (Out + Back)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Reordering Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-[#1A1A1A] uppercase tracking-wider flex items-center gap-2">
                <GripVertical className="w-3.5 h-3.5 text-[#2D6A4F]" />
                Route Dots Sequence ({orderedNodeIds.length})
              </label>
              <div className="text-[10px] text-[#555555] font-mono flex items-center gap-2">
                <span className="text-[#2D6A4F] font-bold">+{stats.elevationGainM}m</span>
                <span className="text-[#A44A3F] font-bold">-{stats.elevationLossM}m</span>
              </div>
            </div>

            {isInvalid && (
              <div className="p-3 bg-[#A44A3F]/10 border border-[#A44A3F]/30 rounded-[6px] flex items-center gap-2 text-[11px] text-[#A44A3F] font-medium animate-pulse">
                <AlertCircle className="w-4 h-4" />
                Connectivity Gap: The current sequence of dots does not have continuous trail segments.
              </div>
            )}

            <div className="space-y-2 border border-[#C5C1B1] rounded-[8px] bg-white p-2 max-h-64 overflow-y-auto shadow-inner">
              {orderedNodeIds.map((id, index) => {
                const node = nodes.find(n => n.id === id);
                if (!node) return null;

                return (
                  <div 
                    key={`${id}-${index}`}
                    className={`flex items-center justify-between p-2 rounded-[6px] border transition-all group ${
                      isInvalid && index > 0 && !getSegmentsFromNodeSequence([orderedNodeIds[index-1], id], segments)
                        ? 'bg-[#A44A3F]/5 border-[#A44A3F]/30'
                        : 'bg-[#F5F3EE] border-[#D1CDBC] hover:border-[#2D6A4F]'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="flex flex-col gap-0.5">
                        <button 
                          type="button"
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          className="p-0.5 hover:text-[#2D6A4F] disabled:opacity-30"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleMoveDown(index)}
                          disabled={index === orderedNodeIds.length - 1}
                          className="p-0.5 hover:text-[#2D6A4F] disabled:opacity-30"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-mono font-bold text-[#555555] uppercase leading-none mb-1">Dot {index + 1}</span>
                        <span className="text-xs font-bold text-[#1A1A1A] truncate">
                          {getNodeDisplayName(node)}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] font-mono text-[#555555] bg-white px-1 border border-[#D1CDBC] rounded">
                            {node.type || 'Waypoint'}
                          </span>
                          {node.elevation && (
                            <span className="text-[9px] font-mono text-[#555555]">{node.elevation}m</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRemoveNode(index)}
                        className="p-1.5 text-[#555555] hover:text-[#A44A3F] hover:bg-[#A44A3F]/10 rounded-[4px] transition-all opacity-0 group-hover:opacity-100"
                        title="Remove dot from sequence"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-[#555555] leading-relaxed flex items-start gap-1.5 p-2 bg-[#F5F3EE] rounded-[4px] border border-[#D1CDBC]/50">
              <AlertCircle className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
              Order your dots from start to finish. The elevation will automatically calculate based on the sequence of trail segments connecting these points.
            </p>
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-[#C5C1B1] flex items-center justify-between bg-[#F5F3EE] rounded-b-[8px]">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-white text-[#1A1A1A] border border-[#D1CDBC] rounded-[6px] text-xs font-bold hover:bg-white/80 transition-all shadow-sm"
          >
            Cancel
          </button>
          
          <button
            onClick={handleSubmit}
            className="flex items-center gap-2 px-6 py-2 bg-[#2D6A4F] hover:bg-[#23533E] text-white rounded-[6px] text-xs font-bold transition-all shadow-md active:scale-95"
          >
            <Save className="w-4 h-4" />
            Save Track to Collection
          </button>
        </div>
      </div>
    </div>
  );
};
