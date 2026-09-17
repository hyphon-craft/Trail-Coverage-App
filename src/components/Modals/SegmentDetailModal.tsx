import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  Download, 
  Trash2, 
  ArrowRight,
  Plus,
  Check,
  FileText
} from 'lucide-react';
import { CompletionRecord, TrailNode, TrailSegment } from '../../types';
import { exportToGpx, getSegmentDisplayName } from '../../utils/geo';

interface SegmentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  segment: TrailSegment | null;
  nodes: TrailNode[];
  isCompleted: boolean;
  onUpdateNotes: (segmentId: string, notes: string) => void;
  onDeleteSegment?: (segmentId: string) => void;
}

export const SegmentDetailModal: React.FC<SegmentDetailModalProps> = ({
  isOpen,
  onClose,
  segment,
  nodes,
  isCompleted,
  onUpdateNotes,
  onDeleteSegment,
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'notes'>('info');
  const [personalNotes, setPersonalNotes] = useState('');
  
  const [confirmDelete, setConfirmDelete] = useState(false);

  React.useEffect(() => {
    if (segment) {
      setPersonalNotes(segment.notes || '');
      setConfirmDelete(false);
    }
  }, [segment]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !segment) return null;

  const startNode = nodes.find((n) => n.id === segment.startNodeId);
  const endNode = nodes.find((n) => n.id === segment.endNodeId);

  const handleExportSegmentGpx = () => {
    const gpxData = exportToGpx(
      segment.name,
      segment.coordinates,
      `Trail segment between ${startNode?.name} and ${endNode?.name}`
    );
    const blob = new Blob([gpxData], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${segment.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.gpx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveNotes = () => {
    onUpdateNotes(segment.id, personalNotes);
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 bg-black/40"
    >
      <div className="bg-[#FCFBF7] border border-[#D1CDBC] rounded-[6px] w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-[0_8px_24px_rgba(0,0,0,0.16)] p-5 relative text-[#2B2B2B] select-none">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 text-[#555555] hover:text-[#1A1A1A] p-1 rounded-[4px] hover:bg-[#F5F3EE] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-3 border-b border-[#D1CDBC] pb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="text-base font-bold text-[#1A1A1A] font-sans truncate">
                {getSegmentDisplayName(segment, nodes)}
              </h2>
              <div className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-mono uppercase tracking-wider ${isCompleted ? 'bg-[#D2F4E1] text-[#2D6A4F] border border-[#74C69D]' : 'bg-[#E5E7EB] text-[#6B7280] border border-[#D1D5DB]'}`}>
                {isCompleted ? 'Completed' : 'Unexplored'}
              </div>
            </div>
            <div className="text-xs text-[#555555] flex items-center gap-1.5 font-sans">
              <span className="text-[#2B2B2B] font-medium">{startNode ? getSegmentDisplayName({ ...segment, name: '' }, [startNode]) : 'Node A'}</span>
              <ArrowRight className="w-3 h-3 text-[#555555]" />
              <span className="text-[#2B2B2B] font-medium">{endNode ? getSegmentDisplayName({ ...segment, name: '' }, [endNode]) : 'Node B'}</span>
            </div>
          </div>
        </div>

        {/* Primary Metrics Grid */}
        <div className="grid grid-cols-3 gap-1.5 text-center bg-[#F5F3EE] p-2.5 rounded-[6px] border border-[#D1CDBC] mb-3 font-mono">
          <div>
            <span className="text-[10px] text-[#555555] block">Distance</span>
            <span className="text-xs font-bold text-[#1A1A1A]">{segment.distanceKm.toFixed(1)} km</span>
          </div>
          <div>
            <span className="text-[10px] text-[#555555] block">Ascent</span>
            <span className="text-xs font-bold text-[#2D6A4F]">+{segment.elevationGainM}m</span>
          </div>
          <div>
            <span className="text-[10px] text-[#555555] block">Descent</span>
            <span className="text-xs font-bold text-[#A44A3F]">-{segment.elevationLossM}m</span>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-[#D1CDBC] mb-3 text-xs font-mono">
          <button
            onClick={() => setActiveTab('info')}
            className={`pb-1.5 px-2.5 border-b-2 transition-colors font-medium ${
              activeTab === 'info'
                ? 'border-[#2D6A4F] text-[#2D6A4F] font-semibold'
                : 'border-transparent text-[#555555] hover:text-[#1A1A1A]'
            }`}
          >
            Description
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`pb-1.5 px-2.5 border-b-2 transition-colors font-medium ${
              activeTab === 'notes'
                ? 'border-[#2D6A4F] text-[#2D6A4F] font-semibold'
                : 'border-transparent text-[#555555] hover:text-[#1A1A1A]'
            }`}
          >
            Field Notes
          </button>
        </div>

        {/* Tab 1: Info Overview */}
        {activeTab === 'info' && (
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-[#F5F3EE] rounded-[6px] border border-[#D1CDBC] space-y-1.5 font-sans">
              <div className="text-[#1A1A1A] font-semibold text-xs">Segment Description & Terrain Profile</div>
              <p className="text-[#2B2B2B] leading-relaxed text-[12px]">
                {segment.notes || 'No description recorded in survey registry for this segment.'}
              </p>
            </div>

            <div className="flex items-center justify-between pt-1 font-mono">
              <button
                onClick={handleExportSegmentGpx}
                className="py-1.5 px-2.5 bg-[#F5F3EE] hover:bg-[#C5C1B1] text-[#1A1A1A] border border-[#D1CDBC] rounded-[4px] text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-[#2D6A4F]" />
                <span>Export Segment GPX</span>
              </button>

              {onDeleteSegment && (
                confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#A44A3F] font-semibold font-sans">Delete segment?</span>
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteSegment(segment.id);
                        onClose();
                      }}
                      className="px-2 py-1 bg-[#A44A3F] hover:bg-[#86372E] text-white rounded-[3px] text-xs font-semibold shadow-xs transition-colors"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="text-[#555555] hover:text-[#1A1A1A] text-xs underline font-sans"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="py-1.5 px-2.5 text-[#A44A3F] hover:bg-[#FDF2F2] border border-transparent hover:border-[#F87171] rounded-[4px] text-xs transition-colors flex items-center gap-1 font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Segment</span>
                  </button>
                )
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Personal Notes */}
        {activeTab === 'notes' && (
          <div className="space-y-2.5 text-xs font-sans">
            <p className="text-[#555555]">
              Record hazards, seasonal water sources, track washouts, or hut reservation details for this trail section.
            </p>
            <textarea
              rows={5}
              value={personalNotes}
              onChange={(e) => setPersonalNotes(e.target.value)}
              placeholder="e.g. Scoria section can be very loose. River crossing unpassable after heavy rains."
              className="w-full bg-[#FCFBF7] border border-[#D1CDBC] rounded-[4px] p-2.5 text-[#1A1A1A] focus:outline-none focus:border-[#2D6A4F]"
            />
            <button
              onClick={handleSaveNotes}
              className="px-3 py-1.5 bg-[#2D6A4F] hover:bg-[#23533E] text-white rounded-[4px] font-mono font-semibold transition-colors flex items-center gap-1.5 border border-[#2D6A4F] shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save Field Notes</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
