import React, { useState, useEffect } from 'react';
import { X, MapPin, Trash2, Check, Crosshair, Loader2 } from 'lucide-react';
import { NodeType, TrailNode } from '../../types';
import { fetchElevation } from '../../utils/geo';

interface NodeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  node: TrailNode | null;
  defaultCoordinates?: { lat: number; lng: number } | null;
  activeRegionId: string;
  onSaveNode: (node: TrailNode) => void;
  onDeleteNode?: (nodeId: string) => void;
  onPickOnMap?: () => void;
}

export const NodeEditModal: React.FC<NodeEditModalProps> = ({
  isOpen,
  onClose,
  node,
  defaultCoordinates,
  activeRegionId,
  onSaveNode,
  onDeleteNode,
  onPickOnMap,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<NodeType>('junction');
  const [lat, setLat] = useState<number>(-39.2963);
  const [lng, setLng] = useState<number>(174.0640);
  const [elevation, setElevation] = useState<number>(1000);
  const [notes, setNotes] = useState('');
  const [visited, setVisited] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isFetchingElevation, setIsFetchingElevation] = useState(false);

  useEffect(() => {
    setConfirmDelete(false);
    if (node) {
      setName(node.name);
      setType(node.type);
      setLat(node.lat);
      setLng(node.lng);
      setElevation(node.elevation);
      setNotes(node.notes || '');
      setVisited(Boolean(node.visited));
      setIsFetchingElevation(false);
    } else {
      setName('');
      setType('junction');
      const initialLat = defaultCoordinates?.lat ?? -39.2963;
      const initialLng = defaultCoordinates?.lng ?? 174.0640;
      setLat(initialLat);
      setLng(initialLng);
      setNotes('');
      setVisited(false);

      if (defaultCoordinates) {
        setIsFetchingElevation(true);
        fetchElevation(defaultCoordinates.lat, defaultCoordinates.lng)
          .then((ele) => {
            if (ele !== null) {
              setElevation(ele);
            } else {
              setElevation(1000);
            }
          })
          .catch(() => {
            setElevation(1000);
          })
          .finally(() => {
            setIsFetchingElevation(false);
          });
      } else {
        setElevation(1000);
        setIsFetchingElevation(false);
      }
    }
  }, [node, defaultCoordinates, isOpen]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const savedNode: TrailNode = {
      id: node ? node.id : `node-${Date.now()}`,
      name: name.trim(),
      type,
      lat: Number(lat),
      lng: Number(lng),
      elevation: Number(elevation),
      notes: notes.trim(),
      visited,
      visitedAt: visited
        ? node?.visitedAt || new Date().toISOString()
        : undefined,
      regionId: activeRegionId,
      updatedAt: new Date().toISOString(),
    };

    onSaveNode(savedNode);
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
      <div className="bg-[#FCFBF7] border border-[#D5D0C6] rounded-[6px] w-full max-w-md p-5 shadow-[0_8px_24px_rgba(0,0,0,0.2)] relative text-[#485057] select-none">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 text-[#7A7A7A] hover:text-[#213026] p-1 rounded-[4px] hover:bg-[#F5F3EE] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-4 border-b border-[#D5D0C6] pb-3">
          <div className="w-7 h-7 rounded-[4px] bg-[#2D6A4F] text-white flex items-center justify-center shadow-xs">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold font-sans text-[#213026]">
              {node ? 'Edit Field Waypoint' : 'Create Map Waypoint'}
            </h2>
            <p className="text-[11px] font-mono text-[#485057]">
              {node ? 'Update cartographic designation and coordinates.' : 'Register a new hut, trig station, or junction.'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[#213026] text-[11px] font-semibold font-sans">
                Waypoint Name
              </label>
              <span className="text-[10px] font-mono text-[#7A7A7A]">
                Optional (for junctions & unnamed points)
              </span>
            </div>
            <input
              type="text"
              placeholder={type === 'junction' ? 'Optional (leave blank for unnamed junction)' : 'e.g. Pouakai Hut, North Egmont (optional)'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#FCFBF7] border border-[#D5D0C6] rounded-[4px] px-2.5 py-1.5 text-xs text-[#213026] focus:outline-none focus:border-[#2D6A4F] font-sans"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono">
            <div>
              <label className="text-[#213026] block mb-1 text-[11px] font-medium">
                Classification
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as NodeType)}
                className="w-full bg-[#FCFBF7] border border-[#D5D0C6] rounded-[4px] px-2 py-1.5 text-xs text-[#213026] focus:outline-none focus:border-[#2D6A4F]"
              >
                <option value="junction">Track Junction (•)</option>
                <option value="hut">Backcountry Hut (⌂)</option>
                <option value="summit">Trig Station / Peak (△)</option>
                <option value="lookout">Vantage / Tarn (◉)</option>
                <option value="carpark">Roadhead / Carpark (P)</option>
                <option value="bridge">Bridge / River (≍)</option>
                <option value="water_source">Water Source</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[#213026] text-[11px] font-medium">
                  Elevation (meters)
                </label>
                {isFetchingElevation ? (
                  <span className="text-[10px] font-mono text-[#2D6A4F] flex items-center gap-1">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    Querying DEM...
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      setIsFetchingElevation(true);
                      try {
                        const ele = await fetchElevation(lat, lng);
                        if (ele !== null) setElevation(ele);
                      } finally {
                        setIsFetchingElevation(false);
                      }
                    }}
                    className="text-[10px] font-mono text-[#7A7A7A] hover:text-[#2D6A4F] hover:underline"
                    title="Retrieve elevation from Open-Meteo DEM API"
                  >
                    Auto-detect
                  </button>
                )}
              </div>
              <input
                type="number"
                required
                value={elevation}
                onChange={(e) => setElevation(Number(e.target.value))}
                className="w-full bg-[#FCFBF7] border border-[#D5D0C6] rounded-[4px] px-2 py-1.5 text-xs text-[#213026] focus:outline-none focus:border-[#2D6A4F]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono">
            <div>
              <label className="text-[#213026] block mb-1 text-[11px] font-medium">
                Latitude (WGS84)
              </label>
              <input
                type="number"
                step="0.00001"
                required
                value={lat}
                onChange={(e) => setLat(Number(e.target.value))}
                className="w-full bg-[#FCFBF7] border border-[#D5D0C6] rounded-[4px] px-2 py-1.5 text-xs text-[#213026] focus:outline-none focus:border-[#2D6A4F]"
              />
            </div>

            <div>
              <label className="text-[#213026] block mb-1 text-[11px] font-medium">
                Longitude (WGS84)
              </label>
              <input
                type="number"
                step="0.00001"
                required
                value={lng}
                onChange={(e) => setLng(Number(e.target.value))}
                className="w-full bg-[#FCFBF7] border border-[#D5D0C6] rounded-[4px] px-2 py-1.5 text-xs text-[#213026] focus:outline-none focus:border-[#2D6A4F]"
              />
            </div>
          </div>

          {onPickOnMap && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onPickOnMap}
                className="text-[11px] font-mono text-[#2D6A4F] hover:underline flex items-center gap-1 py-0.5"
              >
                <Crosshair className="w-3 h-3" />
                Pinpoint location on map
              </button>
            </div>
          )}

          <div>
            <label className="text-[#213026] block mb-1 text-[11px] font-semibold font-sans">
              Notes / Facility Details
            </label>
            <textarea
              rows={2}
              placeholder="Bunk capacity, heating, water supply, exposure warning..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#FCFBF7] border border-[#D5D0C6] rounded-[4px] p-2 text-xs text-[#213026] focus:outline-none focus:border-[#2D6A4F] font-sans"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-1 font-sans text-xs text-[#485057]">
            <input
              type="checkbox"
              checked={visited}
              onChange={(e) => setVisited(e.target.checked)}
              className="rounded-[3px] bg-[#FCFBF7] border-[#D5D0C6] text-[#2D6A4F] focus:ring-0 w-3.5 h-3.5"
            />
            <span>
              Mark location as visited / bagged
            </span>
          </label>

          <div className="flex items-center justify-between pt-3 border-t border-[#D5D0C6] font-mono">
            {node && onDeleteNode ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#A44A3F] font-semibold font-sans">Delete waypoint?</span>
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteNode(node.id);
                      onClose();
                    }}
                    className="px-2 py-0.5 bg-[#A44A3F] hover:bg-[#86372E] text-white rounded-[3px] text-xs font-semibold shadow-xs transition-colors"
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
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-[#A44A3F] hover:underline text-xs flex items-center gap-1 font-medium transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete</span>
                </button>
              )
            ) : (
              <div />
            )}

            <div className="flex items-center gap-1.5">
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
                <span>{node ? 'Update Waypoint' : 'Create Waypoint'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
