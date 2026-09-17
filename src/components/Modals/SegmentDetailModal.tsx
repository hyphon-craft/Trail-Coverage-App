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
import { exportToGpx } from '../../utils/geo';

interface SegmentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  segment: TrailSegment | null;
  nodes: TrailNode[];
  onToggleComplete: (segmentId: string) => void;
  onAddCompletion: (segmentId: string, record: Omit<CompletionRecord, 'id' | 'segmentId'>) => void;
  onUpdateNotes: (segmentId: string, notes: string) => void;
  onDeleteSegment?: (segmentId: string) => void;
}

export const SegmentDetailModal: React.FC<SegmentDetailModalProps> = ({
  isOpen,
  onClose,
  segment,
  nodes,
  onToggleComplete,
  onAddCompletion,
  onUpdateNotes,
  onDeleteSegment,
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'notes'>('info');
  const [personalNotes, setPersonalNotes] = useState('');
  
  // New completion entry form
  const [isAddingLog, setIsAddingLog] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [logDuration, setLogDuration] = useState<number>(60);
  const [logRating, setLogRating] = useState<number>(5);
  const [logWeather, setLogWeather] = useState('Clear & calm');
  const [logNotes, setLogNotes] = useState('');

  React.useEffect(() => {
    if (segment) {
      setPersonalNotes(segment.notes || '');
      setIsAddingLog(false);
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

  const handleSubmitNewLog = (e: React.FormEvent) => {
    e.preventDefault();
    onAddCompletion(segment.id, {
      date: logDate,
      durationMinutes: Number(logDuration),
      rating: Number(logRating),
      weather: logWeather,
      notes: logNotes,
    });
    setIsAddingLog(false);
    setLogNotes('');
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
      <div className="bg-[#FCFBF7] border border-[#D5D0C6] rounded-[6px] w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-[0_8px_24px_rgba(0,0,0,0.16)] p-5 relative text-[#485057] select-none">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 text-[#7A7A7A] hover:text-[#213026] p-1 rounded-[4px] hover:bg-[#F5F3EE] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-3 border-b border-[#D5D0C6] pb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-[9px] uppercase font-mono px-1.5 py-0.5 border rounded-[3px] font-semibold ${
                  segment.completed
                    ? 'bg-[#E8F5E9] text-[#2D6A4F] border-[#52B788]'
                    : 'bg-[#F5F3EE] text-[#7A7A7A] border-[#D5D0C6]'
                }`}
              >
                {segment.completed ? 'Survey Complete' : 'Unsurveyed Track'}
              </span>
              {segment.difficulty && (
                <span className="text-[10px] uppercase font-mono text-[#7A7A7A]">
                  DOC Grade: {segment.difficulty}
                </span>
              )}
            </div>
            <h2 className="text-base font-bold text-[#213026] font-sans">
              {segment.name}
            </h2>
            <div className="text-xs text-[#7A7A7A] flex items-center gap-1.5 mt-0.5 font-sans">
              <span className="text-[#485057] font-medium">{startNode?.name || 'Node A'}</span>
              <ArrowRight className="w-3 h-3 text-[#7A7A7A]" />
              <span className="text-[#485057] font-medium">{endNode?.name || 'Node B'}</span>
            </div>
          </div>

          {/* Survey Toggle Button */}
          <button
            onClick={() => onToggleComplete(segment.id)}
            className={`px-3 py-1.5 rounded-[4px] text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors border shadow-xs ${
              segment.completed
                ? 'bg-[#2D6A4F] hover:bg-[#23533E] text-white border-[#2D6A4F]'
                : 'bg-[#F5F3EE] hover:bg-[#E8E5DD] text-[#213026] border-[#D5D0C6]'
            }`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>{segment.completed ? 'Surveyed' : 'Mark Surveyed'}</span>
          </button>
        </div>

        {/* Primary Metrics Grid */}
        <div className="grid grid-cols-4 gap-1.5 text-center bg-[#F5F3EE] p-2.5 rounded-[6px] border border-[#D5D0C6] mb-3 font-mono">
          <div>
            <span className="text-[10px] text-[#7A7A7A] block">Distance</span>
            <span className="text-xs font-bold text-[#213026]">{segment.distanceKm.toFixed(1)} km</span>
          </div>
          <div>
            <span className="text-[10px] text-[#7A7A7A] block">Ascent</span>
            <span className="text-xs font-bold text-[#2D6A4F]">+{segment.elevationGainM}m</span>
          </div>
          <div>
            <span className="text-[10px] text-[#7A7A7A] block">Descent</span>
            <span className="text-xs font-bold text-[#A44A3F]">-{segment.elevationLossM}m</span>
          </div>
          <div>
            <span className="text-[10px] text-[#7A7A7A] block">Surface</span>
            <span className="text-xs font-bold text-[#213026] capitalize">{segment.surface || 'Track'}</span>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-[#D5D0C6] mb-3 text-xs font-mono">
          <button
            onClick={() => setActiveTab('info')}
            className={`pb-1.5 px-2.5 border-b-2 transition-colors font-medium ${
              activeTab === 'info'
                ? 'border-[#2D6A4F] text-[#2D6A4F] font-semibold'
                : 'border-transparent text-[#7A7A7A] hover:text-[#213026]'
            }`}
          >
            Description
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-1.5 px-2.5 border-b-2 transition-colors flex items-center gap-1 font-medium ${
              activeTab === 'history'
                ? 'border-[#2D6A4F] text-[#2D6A4F] font-semibold'
                : 'border-transparent text-[#7A7A7A] hover:text-[#213026]'
            }`}
          >
            <span>Field Logbook</span>
            <span className="text-[10px] px-1 py-0.2 rounded-[3px] bg-[#F5F3EE] text-[#485057] border border-[#D5D0C6]">
              {segment.completions?.length || 0}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`pb-1.5 px-2.5 border-b-2 transition-colors font-medium ${
              activeTab === 'notes'
                ? 'border-[#2D6A4F] text-[#2D6A4F] font-semibold'
                : 'border-transparent text-[#7A7A7A] hover:text-[#213026]'
            }`}
          >
            Field Notes
          </button>
        </div>

        {/* Tab 1: Info Overview */}
        {activeTab === 'info' && (
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-[#F5F3EE] rounded-[6px] border border-[#D5D0C6] space-y-1.5 font-sans">
              <div className="text-[#213026] font-semibold text-xs">Track Description & Terrain Profile</div>
              <p className="text-[#485057] leading-relaxed text-[12px]">
                {segment.notes || 'No description recorded in survey registry for this track segment.'}
              </p>
            </div>

            <div className="flex items-center justify-between pt-1 font-mono">
              <button
                onClick={handleExportSegmentGpx}
                className="py-1.5 px-2.5 bg-[#F5F3EE] hover:bg-[#E8E5DD] text-[#213026] border border-[#D5D0C6] rounded-[4px] text-xs font-semibold flex items-center gap-1.5 transition-colors"
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
                      className="text-[#7A7A7A] hover:text-[#213026] text-xs underline font-sans"
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

        {/* Tab 2: Completion History */}
        {activeTab === 'history' && (
          <div className="space-y-3 text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="text-[#7A7A7A]">
                Expeditions Logged: <strong className="text-[#213026]">{segment.completionCount || 0}</strong>
              </span>
              <button
                onClick={() => setIsAddingLog(!isAddingLog)}
                className="py-1 px-2 bg-[#2D6A4F] hover:bg-[#23533E] text-white rounded-[4px] text-xs font-semibold flex items-center gap-1 transition-colors border border-[#2D6A4F] shadow-xs"
              >
                <Plus className="w-3 h-3" />
                <span>+ Log Trip</span>
              </button>
            </div>

            {/* Add Log Form */}
            {isAddingLog && (
              <form onSubmit={handleSubmitNewLog} className="p-3 bg-[#F5F3EE] rounded-[6px] border border-[#D5D0C6] space-y-2.5">
                <div className="font-semibold text-[#213026] text-xs font-sans">New Trip Record</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[#7A7A7A] block mb-1 text-[10px] font-semibold">Date</label>
                    <input
                      type="date"
                      required
                      value={logDate}
                      onChange={(e) => setLogDate(e.target.value)}
                      className="w-full bg-[#FCFBF7] border border-[#D5D0C6] rounded-[4px] p-1 text-[#213026] text-xs focus:outline-none focus:border-[#2D6A4F]"
                    />
                  </div>
                  <div>
                    <label className="text-[#7A7A7A] block mb-1 text-[10px] font-semibold">Duration (minutes)</label>
                    <input
                      type="number"
                      required
                      value={logDuration}
                      onChange={(e) => setLogDuration(Number(e.target.value))}
                      className="w-full bg-[#FCFBF7] border border-[#D5D0C6] rounded-[4px] p-1 text-[#213026] text-xs focus:outline-none focus:border-[#2D6A4F]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[#7A7A7A] block mb-1 text-[10px] font-semibold">Rating (1-5)</label>
                    <select
                      value={logRating}
                      onChange={(e) => setLogRating(Number(e.target.value))}
                      className="w-full bg-[#FCFBF7] border border-[#D5D0C6] rounded-[4px] p-1 text-[#213026] text-xs focus:outline-none focus:border-[#2D6A4F]"
                    >
                      <option value="5">★★★★★ (5 - Clear track)</option>
                      <option value="4">★★★★☆ (4 - Good condition)</option>
                      <option value="3">★★★☆☆ (3 - Mud / Roots)</option>
                      <option value="2">★★☆☆☆ (2 - Rough / Windfall)</option>
                      <option value="1">★☆☆☆☆ (1 - Poor / Snowbound)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[#7A7A7A] block mb-1 text-[10px] font-semibold">Weather</label>
                    <input
                      type="text"
                      placeholder="e.g. Calm, Cloud base 1800m"
                      value={logWeather}
                      onChange={(e) => setLogWeather(e.target.value)}
                      className="w-full bg-[#FCFBF7] border border-[#D5D0C6] rounded-[4px] p-1 text-[#213026] text-xs focus:outline-none focus:border-[#2D6A4F]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[#7A7A7A] block mb-1 text-[10px] font-semibold">Track Conditions / Observations</label>
                  <textarea
                    rows={2}
                    placeholder="Track surface, water availability, river crossing depths..."
                    value={logNotes}
                    onChange={(e) => setLogNotes(e.target.value)}
                    className="w-full bg-[#FCFBF7] border border-[#D5D0C6] rounded-[4px] p-1.5 text-[#213026] text-xs focus:outline-none focus:border-[#2D6A4F] font-sans"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingLog(false)}
                    className="px-2.5 py-1 bg-[#F5F3EE] text-[#485057] border border-[#D5D0C6] rounded-[4px] hover:bg-[#E8E5DD] text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 bg-[#2D6A4F] text-white rounded-[4px] font-semibold hover:bg-[#23533E] border border-[#2D6A4F] text-xs shadow-xs"
                  >
                    Save Entry
                  </button>
                </div>
              </form>
            )}

            {/* List of past completions */}
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {(!segment.completions || segment.completions.length === 0) ? (
                <div className="text-center py-5 text-[#7A7A7A]">
                  No logged completions recorded yet for this trail.
                </div>
              ) : (
                segment.completions.map((comp) => (
                  <div key={comp.id} className="p-2.5 bg-[#F5F3EE] rounded-[6px] border border-[#D5D0C6] space-y-1">
                    <div className="flex items-center justify-between font-semibold text-[#213026]">
                      <span className="flex items-center gap-1 text-[#2D6A4F]">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{comp.date}</span>
                      </span>
                      {comp.rating && (
                        <span className="text-[#C77D00]">
                          {'★'.repeat(comp.rating)}{'☆'.repeat(5 - comp.rating)}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-[#7A7A7A] flex items-center gap-3">
                      {comp.durationMinutes && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{comp.durationMinutes} mins</span>
                        </span>
                      )}
                      {comp.weather && <span>Weather: {comp.weather}</span>}
                    </div>
                    {comp.notes && (
                      <p className="text-[#485057] text-[11px] pt-1 font-sans">
                        {comp.notes}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Personal Notes */}
        {activeTab === 'notes' && (
          <div className="space-y-2.5 text-xs font-sans">
            <p className="text-[#7A7A7A]">
              Record hazards, seasonal water sources, track washouts, or hut reservation details for this trail section.
            </p>
            <textarea
              rows={5}
              value={personalNotes}
              onChange={(e) => setPersonalNotes(e.target.value)}
              placeholder="e.g. Scoria section can be very loose. River crossing unpassable after heavy rains."
              className="w-full bg-[#FCFBF7] border border-[#D5D0C6] rounded-[4px] p-2.5 text-[#213026] focus:outline-none focus:border-[#2D6A4F]"
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
