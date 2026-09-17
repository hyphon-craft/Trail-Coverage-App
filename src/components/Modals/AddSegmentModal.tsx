import React, { useState, useEffect } from 'react';
import { X, Plus, Check } from 'lucide-react';
import { TrailNode, TrailSegment } from '../../types';
import { calculateDistanceKm, getNodeDisplayName } from '../../utils/geo';

interface AddSegmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: TrailNode[];
  activeRegionId: string;
  onSaveSegment: (newSegment: Omit<TrailSegment, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

export const AddSegmentModal: React.FC<AddSegmentModalProps> = ({
  isOpen,
  onClose,
  nodes,
  activeRegionId,
  onSaveSegment,
}) => {
  const [name, setName] = useState('');
  const [startNodeId, setStartNodeId] = useState('');
  const [endNodeId, setEndNodeId] = useState('');
  const [distanceKm, setDistanceKm] = useState<number>(3.0);
  const [elevationGainM, setElevationGainM] = useState<number>(200);
  const [elevationLossM, setElevationLossM] = useState<number>(50);
  const [difficulty, setDifficulty] = useState<TrailSegment['difficulty']>('moderate');
  const [surface, setSurface] = useState<TrailSegment['surface']>('track');
  const [notes, setNotes] = useState('');
  const [markCompleted, setMarkCompleted] = useState(false);

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

  if (!isOpen) return null;

  const handleStartNodeChange = (id: string) => {
    setStartNodeId(id);
    updateDefaults(id, endNodeId);
  };

  const handleEndNodeChange = (id: string) => {
    setEndNodeId(id);
    updateDefaults(startNodeId, id);
  };

  const updateDefaults = (sId: string, eId: string) => {
    const sNode = nodes.find((n) => n.id === sId);
    const eNode = nodes.find((n) => n.id === eId);
    if (sNode && eNode) {
      if (!name) {
        setName(`${sNode.name} to ${eNode.name}`);
      }
      const dist = calculateDistanceKm(sNode.lat, sNode.lng, eNode.lat, eNode.lng);
      setDistanceKm(Math.round(dist * 1.3 * 10) / 10); // trail winding factor 1.3
      const eleDiff = eNode.elevation - sNode.elevation;
      if (eleDiff > 0) {
        setElevationGainM(Math.round(eleDiff));
        setElevationLossM(10);
      } else {
        setElevationGainM(10);
        setElevationLossM(Math.round(Math.abs(eleDiff)));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sNode = nodes.find((n) => n.id === startNodeId);
    const eNode = nodes.find((n) => n.id === endNodeId);
    if (!sNode || !eNode || sNode.id === eNode.id) {
      alert('Please select two different nodes to connect.');
      return;
    }

    const midLng = (sNode.lng + eNode.lng) / 2;
    const midLat = (sNode.lat + eNode.lat) / 2;
    const midEle = (sNode.elevation + eNode.elevation) / 2;

    const coordinates: [number, number, number?][] = [
      [sNode.lng, sNode.lat, sNode.elevation],
      [midLng, midLat, midEle],
      [eNode.lng, eNode.lat, eNode.elevation],
    ];

    onSaveSegment({
      name: name.trim() || `${sNode.name} to ${eNode.name}`,
      startNodeId: sNode.id,
      endNodeId: eNode.id,
      distanceKm: Number(distanceKm),
      elevationGainM: Number(elevationGainM),
      elevationLossM: Number(elevationLossM),
      coordinates,
      completed: markCompleted,
      completedAt: markCompleted ? new Date().toISOString() : undefined,
      completionCount: markCompleted ? 1 : 0,
      completions: markCompleted
        ? [
            {
              id: 'comp-' + Date.now(),
              segmentId: '',
              date: new Date().toISOString().split('T')[0],
              notes: 'Defined as surveyed segment.',
              rating: 5,
            },
          ]
        : [],
      difficulty,
      surface,
      notes: notes.trim(),
      regionId: activeRegionId,
    });

    onClose();
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
      <div className="bg-[#FCFBF7] border border-[#D5D0C6] rounded-[6px] w-full max-w-lg p-5 shadow-[0_8px_24px_rgba(0,0,0,0.16)] relative text-[#485057] select-none">
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 text-[#7A7A7A] hover:text-[#213026] p-1 rounded-[4px] hover:bg-[#F5F3EE] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-4 border-b border-[#D5D0C6] pb-3">
          <div className="w-7 h-7 rounded-[4px] bg-[#2D6A4F] text-white flex items-center justify-center shadow-xs">
            <Plus className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold font-sans text-[#213026]">Define Track Segment</h2>
            <p className="text-[11px] font-mono text-[#485057]">
              Establish a topological connection between two network waypoints.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2 font-mono">
            <div>
              <label className="text-[#213026] block mb-1 text-[11px] font-semibold font-sans">
                Origin Waypoint
              </label>
              <select
                required
                value={startNodeId}
                onChange={(e) => handleStartNodeChange(e.target.value)}
                className="w-full bg-[#FCFBF7] border border-[#D5D0C6] rounded-[4px] px-2.5 py-1.5 text-xs text-[#213026] focus:outline-none focus:border-[#2D6A4F]"
              >
                <option value="">Select origin...</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[#213026] block mb-1 text-[11px] font-semibold font-sans">
                Destination Waypoint
              </label>
              <select
                required
                value={endNodeId}
                onChange={(e) => handleEndNodeChange(e.target.value)}
                className="w-full bg-[#FCFBF7] border border-[#D5D0C6] rounded-[4px] px-2.5 py-1.5 text-xs text-[#213026] focus:outline-none focus:border-[#2D6A4F]"
              >
                <option value="">Select destination...</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[#213026] block mb-1 text-[11px] font-semibold font-sans">
              Track Segment Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Holly Hut to Pouakai Hut"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#FCFBF7] border border-[#D5D0C6] rounded-[4px] px-2.5 py-1.5 text-xs text-[#213026] focus:outline-none focus:border-[#2D6A4F] font-sans"
            />
          </div>

          <div className="grid grid-cols-3 gap-2 font-mono">
            <div>
              <label className="text-[#213026] block mb-1 text-[11px] font-medium">
                Distance (km)
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={distanceKm}
                onChange={(e) => setDistanceKm(Number(e.target.value))}
                className="w-full bg-[#FCFBF7] border border-[#D5D0C6] rounded-[4px] px-2 py-1.5 text-xs text-[#213026] focus:outline-none focus:border-[#2D6A4F]"
              />
            </div>
            <div>
              <label className="text-[#213026] block mb-1 text-[11px] font-medium">
                Ascent (+m)
              </label>
              <input
                type="number"
                required
                value={elevationGainM}
                onChange={(e) => setElevationGainM(Number(e.target.value))}
                className="w-full bg-[#FCFBF7] border border-[#D5D0C6] rounded-[4px] px-2 py-1.5 text-xs text-[#213026] focus:outline-none focus:border-[#2D6A4F]"
              />
            </div>
            <div>
              <label className="text-[#213026] block mb-1 text-[11px] font-medium">
                Descent (-m)
              </label>
              <input
                type="number"
                required
                value={elevationLossM}
                onChange={(e) => setElevationLossM(Number(e.target.value))}
                className="w-full bg-[#FCFBF7] border border-[#D5D0C6] rounded-[4px] px-2 py-1.5 text-xs text-[#213026] focus:outline-none focus:border-[#2D6A4F]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono">
            <div>
              <label className="text-[#213026] block mb-1 text-[11px] font-medium">
                DOC Classification
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as any)}
                className="w-full bg-[#FCFBF7] border border-[#D5D0C6] rounded-[4px] px-2 py-1.5 text-xs text-[#213026] focus:outline-none focus:border-[#2D6A4F]"
              >
                <option value="easy">Easy (Well-graded track)</option>
                <option value="moderate">Moderate (Tramping track / steps)</option>
                <option value="challenging">Challenging (Route / Alpine)</option>
                <option value="expert">Expert (Scoria / Exposure)</option>
              </select>
            </div>

            <div>
              <label className="text-[#213026] block mb-1 text-[11px] font-medium">
                Surface Category
              </label>
              <select
                value={surface}
                onChange={(e) => setSurface(e.target.value as any)}
                className="w-full bg-[#FCFBF7] border border-[#D5D0C6] rounded-[4px] px-2 py-1.5 text-xs text-[#213026] focus:outline-none focus:border-[#2D6A4F]"
              >
                <option value="track">Forest Track</option>
                <option value="boardwalk">Boardwalk / Steps</option>
                <option value="scree">Volcanic Scoria / Scree</option>
                <option value="poled_route">Poled Alpine Route</option>
                <option value="road">Service Road</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[#213026] block mb-1 text-[11px] font-semibold font-sans">
              Terrain Description & Notes
            </label>
            <textarea
              rows={2}
              placeholder="Seasonal water points, river fords, exposure..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#FCFBF7] border border-[#D5D0C6] rounded-[4px] p-2 text-xs text-[#213026] focus:outline-none focus:border-[#2D6A4F] font-sans"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer font-sans text-xs text-[#485057]">
            <input
              type="checkbox"
              checked={markCompleted}
              onChange={(e) => setMarkCompleted(e.target.checked)}
              className="rounded-[3px] bg-[#FCFBF7] border-[#D5D0C6] text-[#2D6A4F] focus:ring-0 w-3.5 h-3.5"
            />
            <span>
              Mark as surveyed / completed immediately
            </span>
          </label>

          <div className="flex justify-end gap-1.5 pt-3 border-t border-[#D5D0C6] font-mono">
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 bg-[#F5F3EE] hover:bg-[#E8E5DD] text-[#213026] border border-[#D5D0C6] rounded-[4px] text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1 bg-[#2D6A4F] hover:bg-[#23533E] text-white rounded-[4px] text-xs font-semibold border border-[#2D6A4F] flex items-center gap-1 shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Record Segment</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
