import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  X, 
  FileText, 
  Check, 
  AlertCircle
} from 'lucide-react';
import { GpxParsedTrack, TrailNode, TrailSegment } from '../../types';
import { parseGpx, findClosestNode } from '../../utils/geo';

interface GpxUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: TrailNode[];
  activeRegionId: string;
  onSaveSegment: (newSegment: Omit<TrailSegment, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onSetPreviewTrack: (track: GpxParsedTrack | null) => void;
  onSaveNode?: (node: TrailNode) => void;
}

export const GpxUploadModal: React.FC<GpxUploadModalProps> = ({
  isOpen,
  onClose,
  nodes,
  activeRegionId,
  onSaveSegment,
  onSetPreviewTrack,
  onSaveNode,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [track, setTrack] = useState<GpxParsedTrack | null>(null);

  // Form states for saving as a segment
  const [segmentName, setSegmentName] = useState('');
  const [startNodeId, setStartNodeId] = useState('');
  const [endNodeId, setEndNodeId] = useState('');
  const [difficulty, setDifficulty] = useState<TrailSegment['difficulty']>('moderate');
  const [surface, setSurface] = useState<TrailSegment['surface']>('track');
  const [notes, setNotes] = useState('');
  const [markCompleted, setMarkCompleted] = useState(true);

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
        setSegmentName(parsed.name);
        onSetPreviewTrack(parsed);

        // Auto detect start & end nodes or set to auto-create
        const startPoint = parsed.points[0];
        const endPoint = parsed.points[parsed.points.length - 1];

        if (startPoint) {
          const matchedStart = findClosestNode(startPoint.lat, startPoint.lng, nodes);
          if (matchedStart) {
            setStartNodeId(matchedStart.id);
          } else {
            setStartNodeId('__auto_start__');
          }
        } else {
          setStartNodeId('__auto_start__');
        }

        if (endPoint) {
          const matchedEnd = findClosestNode(endPoint.lat, endPoint.lng, nodes);
          if (matchedEnd) {
            setEndNodeId(matchedEnd.id);
          } else {
            setEndNodeId('__auto_end__');
          }
        } else {
          setEndNodeId('__auto_end__');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to parse GPX file.');
      }
    };
    reader.readAsText(file);
  };

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

  const handleSaveAsSegment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!track) return;

    let finalStartNodeId = startNodeId;
    let finalEndNodeId = endNodeId;

    if (finalStartNodeId === '__auto_start__' || !finalStartNodeId) {
      const p = track.points[0];
      const newId = `node-start-${Date.now()}`;
      const newNode: TrailNode = {
        id: newId,
        name: `${segmentName || track.name} (Start)`,
        type: 'carpark',
        lat: p.lat,
        lng: p.lng,
        elevation: Math.round(p.ele ?? track.minElevationM ?? 0),
        notes: `Origin waypoint created from GPX: ${segmentName || track.name}`,
        visited: markCompleted,
        visitedAt: markCompleted ? new Date().toISOString() : undefined,
        regionId: activeRegionId,
      };
      if (onSaveNode) onSaveNode(newNode);
      finalStartNodeId = newId;
    }

    if (finalEndNodeId === '__auto_end__' || !finalEndNodeId) {
      const p = track.points[track.points.length - 1];
      const newId = `node-end-${Date.now() + 1}`;
      const isPeak = p.ele && p.ele > 1800;
      const newNode: TrailNode = {
        id: newId,
        name: `${segmentName || track.name} (End)`,
        type: isPeak ? 'summit' : 'hut',
        lat: p.lat,
        lng: p.lng,
        elevation: Math.round(p.ele ?? track.maxElevationM ?? 0),
        notes: `Destination waypoint created from GPX: ${segmentName || track.name}`,
        visited: markCompleted,
        visitedAt: markCompleted ? new Date().toISOString() : undefined,
        regionId: activeRegionId,
      };
      if (onSaveNode) onSaveNode(newNode);
      finalEndNodeId = newId;
    }

    const coordinates: [number, number, number?][] = track.points.map((p) => [
      p.lng,
      p.lat,
      p.ele,
    ]);

    onSaveSegment({
      name: segmentName || track.name,
      startNodeId: finalStartNodeId,
      endNodeId: finalEndNodeId,
      distanceKm: track.distanceKm,
      elevationGainM: track.elevationGainM,
      elevationLossM: track.elevationLossM,
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
              notes: 'Imported from field GPX recording.',
              rating: 5,
            },
          ]
        : [],
      difficulty,
      surface,
      notes,
      regionId: activeRegionId,
    });

    onClose();
  };

  // SVG path for technical elevation cross-section
  const renderElevationProfile = () => {
    if (!track || track.points.length < 2) return null;
    const width = 460;
    const height = 80;
    const padding = 8;

    const eleRange = Math.max(1, track.maxElevationM - track.minElevationM);
    const stepX = (width - padding * 2) / (track.points.length - 1);

    const points = track.points.map((p, i) => {
      const x = padding + i * stepX;
      const y =
        height -
        padding -
        ((p.ele - track.minElevationM) / eleRange) * (height - padding * 2);
      return `${x},${y}`;
    });

    const pathD = `M ${points[0]} L ${points.join(' L ')}`;
    const areaD = `M ${padding},${height - padding} L ${points.join(' L ')} L ${
      width - padding
    },${height - padding} Z`;

    return (
      <div className="bg-[#F5F3EE] border border-[#D5D0C6] rounded-[6px] p-2.5 font-mono">
        <div className="flex items-center justify-between text-[10px] text-[#485057] mb-1 font-semibold">
          <span>Topographic Cross-Section</span>
          <span>
            {track.minElevationM}m → {track.maxElevationM}m
          </span>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20 overflow-visible">
          <line
            x1={padding}
            y1={height - padding}
            x2={width - padding}
            y2={height - padding}
            stroke="#D5D0C6"
            strokeWidth="1"
          />
          <path d={areaD} fill="#2D6A4F" fillOpacity="0.15" />
          <path d={pathD} fill="none" stroke="#2D6A4F" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    );
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

        <div className="flex items-center gap-2.5 mb-4 border-b border-[#D5D0C6] pb-3">
          <div className="w-7 h-7 rounded-[4px] bg-[#2D6A4F] text-white flex items-center justify-center shadow-xs">
            <Upload className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold font-sans text-[#213026]">Import GPX Track Log</h2>
            <p className="text-[11px] font-mono text-[#485057]">
              Load Garmin, Coros, or DOC GPX telemetry files to parse track geometry and statistics.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-3 p-2 bg-[#FDF2F2] border border-[#F87171] rounded-[4px] text-[#A44A3F] text-xs font-mono flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!track ? (
          /* Drag & Drop Zone */
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border border-dashed rounded-[6px] p-8 text-center cursor-pointer transition-colors ${
              dragActive
                ? 'border-[#2D6A4F] bg-[#F5F3EE]'
                : 'border-[#D5D0C6] bg-[#FCFBF7] hover:border-[#40916C] hover:bg-[#F5F3EE]'
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
            <div className="w-10 h-10 mx-auto rounded-[6px] bg-[#F5F3EE] border border-[#D5D0C6] flex items-center justify-center text-[#2D6A4F] mb-2.5">
              <FileText className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-[#213026] font-sans">
              Drop GPX file here or click to browse
            </p>
            <p className="text-[10px] font-mono text-[#7A7A7A] mt-1">
              Supports standard GPX 1.1 tracks with elevation (ele) and coordinates
            </p>
          </div>
        ) : (
          /* Parsed Track Review & Segment Converter */
          <form onSubmit={handleSaveAsSegment} className="space-y-3 font-mono text-xs">
            {/* Stats Overview */}
            <div className="grid grid-cols-3 gap-1.5 text-center bg-[#F5F3EE] p-2 rounded-[6px] border border-[#D5D0C6]">
              <div>
                <span className="text-[10px] text-[#485057] block">Distance</span>
                <span className="text-xs font-bold text-[#213026]">{track.distanceKm} km</span>
              </div>
              <div>
                <span className="text-[10px] text-[#485057] block">Ascent</span>
                <span className="text-xs font-bold text-[#2D6A4F]">+{track.elevationGainM}m</span>
              </div>
              <div>
                <span className="text-[10px] text-[#485057] block">Descent</span>
                <span className="text-xs font-bold text-[#A44A3F]">-{track.elevationLossM}m</span>
              </div>
            </div>

            {/* Profile visualizer */}
            {renderElevationProfile()}

            {/* Segment Details Form */}
            <div className="space-y-2.5 pt-1">
              <div>
                <label className="text-[11px] text-[#213026] block mb-1 font-sans font-semibold">
                  Track Name
                </label>
                <input
                  type="text"
                  required
                  value={segmentName}
                  onChange={(e) => setSegmentName(e.target.value)}
                  className="w-full bg-[#FCFBF7] border border-[#D5D0C6] rounded-[4px] px-2.5 py-1.5 text-xs text-[#213026] focus:outline-none focus:border-[#2D6A4F] font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-[#213026] block mb-1 font-sans font-semibold">
                    Origin Waypoint
                  </label>
                  <select
                    value={startNodeId}
                    onChange={(e) => setStartNodeId(e.target.value)}
                    className="w-full bg-[#FCFBF7] border border-[#D5D0C6] rounded-[4px] px-2 py-1.5 text-xs text-[#213026] focus:outline-none focus:border-[#2D6A4F]"
                  >
                    <option value="__auto_start__">+ Auto-create waypoint at start</option>
                    {nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name} ({n.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-[#213026] block mb-1 font-sans font-semibold">
                    Destination Waypoint
                  </label>
                  <select
                    value={endNodeId}
                    onChange={(e) => setEndNodeId(e.target.value)}
                    className="w-full bg-[#FCFBF7] border border-[#D5D0C6] rounded-[4px] px-2 py-1.5 text-xs text-[#213026] focus:outline-none focus:border-[#2D6A4F]"
                  >
                    <option value="__auto_end__">+ Auto-create waypoint at end</option>
                    {nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name} ({n.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-[#213026] block mb-1 font-sans font-semibold">
                    DOC Grade
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as any)}
                    className="w-full bg-[#FCFBF7] border border-[#D5D0C6] rounded-[4px] px-2 py-1.5 text-xs text-[#213026] focus:outline-none focus:border-[#2D6A4F]"
                  >
                    <option value="easy">Easy (Well formed)</option>
                    <option value="moderate">Moderate (Tramping track)</option>
                    <option value="challenging">Challenging (Alpine)</option>
                    <option value="expert">Expert (Scoria / Route)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-[#213026] block mb-1 font-sans font-semibold">
                    Surface Type
                  </label>
                  <select
                    value={surface}
                    onChange={(e) => setSurface(e.target.value as any)}
                    className="w-full bg-[#FCFBF7] border border-[#D5D0C6] rounded-[4px] px-2 py-1.5 text-xs text-[#213026] focus:outline-none focus:border-[#2D6A4F]"
                  >
                    <option value="track">Bush Track</option>
                    <option value="boardwalk">Boardwalk / Steps</option>
                    <option value="scree">Scree / Scoria</option>
                    <option value="poled_route">Poled Route</option>
                    <option value="road">Service Road</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-[#213026] block mb-1 font-sans font-semibold">
                  Field Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Surface conditions, water points, weather notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-[#FCFBF7] border border-[#D5D0C6] rounded-[4px] p-2 text-xs text-[#213026] focus:outline-none focus:border-[#2D6A4F] font-sans"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-[#485057]">
                <input
                  type="checkbox"
                  checked={markCompleted}
                  onChange={(e) => setMarkCompleted(e.target.checked)}
                  className="rounded-[3px] bg-[#FCFBF7] border-[#D5D0C6] text-[#2D6A4F] focus:ring-0 w-3.5 h-3.5"
                />
                <span>Mark as surveyed / completed in personal log</span>
              </label>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-between pt-2.5 border-t border-[#D5D0C6] gap-2">
              <button
                type="button"
                onClick={() => {
                  setTrack(null);
                  onSetPreviewTrack(null);
                }}
                className="px-2.5 py-1 bg-[#F5F3EE] hover:bg-[#E8E5DD] text-[#213026] border border-[#D5D0C6] rounded-[4px] text-xs font-medium"
              >
                Upload Different File
              </button>

              <button
                type="submit"
                className="px-3 py-1 bg-[#2D6A4F] hover:bg-[#23533E] text-white rounded-[4px] text-xs font-semibold border border-[#2D6A4F] flex items-center gap-1 shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Segment to Network</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
