import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  MapPin, 
  TrendingUp, 
  FileText,
  Save,
  Route as RouteIcon
} from 'lucide-react';
import { SavedRoute } from '../../types';

interface LogCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  route: SavedRoute | null;
  onSave: (routeId: string, date: string, time: string, distanceKm: number, elevationGainM: number, notes: string) => void;
}

export const LogCompletionModal: React.FC<LogCompletionModalProps> = ({
  isOpen,
  onClose,
  route,
  onSave,
}) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('');
  const [distance, setDistance] = useState(0);
  const [elevation, setElevation] = useState(0);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen && route) {
      setDistance(route.totalDistanceKm);
      setElevation(route.totalGainM);
      setDate(new Date().toISOString().split('T')[0]);
      setTime('');
      setNotes('');
    }
  }, [isOpen, route]);

  if (!isOpen || !route) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(route.id, date, time, distance, elevation, notes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[#FCFBF7] w-full max-w-md rounded-[8px] shadow-2xl border border-[#D1CDBC] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#C5C1B1] flex items-center justify-between bg-[#F5F3EE] rounded-t-[8px]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#2D6A4F] text-white rounded-[6px]">
              <RouteIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1A1A1A]">Log Completion</h2>
              <p className="text-xs text-[#555555] truncate max-w-[200px]">{route.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[#D1CDBC] rounded-[4px] transition-colors text-[#555555]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#1A1A1A] uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3 h-3 text-[#2D6A4F]" />
                Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white border border-[#C5C1B1] rounded-[6px] p-2 text-sm focus:outline-none focus:border-[#2D6A4F]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#1A1A1A] uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-[#2D6A4F]" />
                Duration
              </label>
              <input
                type="text"
                placeholder="e.g. 4h 30m"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-white border border-[#C5C1B1] rounded-[6px] p-2 text-sm focus:outline-none focus:border-[#2D6A4F]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#1A1A1A] uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-[#2D6A4F]" />
                Distance (km)
              </label>
              <input
                type="number"
                step="0.1"
                required
                value={distance}
                onChange={(e) => setDistance(parseFloat(e.target.value))}
                className="w-full bg-white border border-[#C5C1B1] rounded-[6px] p-2 text-sm focus:outline-none focus:border-[#2D6A4F]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#1A1A1A] uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3 text-[#2D6A4F]" />
                Ascent (m)
              </label>
              <input
                type="number"
                required
                value={elevation}
                onChange={(e) => setElevation(parseInt(e.target.value))}
                className="w-full bg-white border border-[#C5C1B1] rounded-[6px] p-2 text-sm focus:outline-none focus:border-[#2D6A4F]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-[#1A1A1A] uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3 h-3 text-[#2D6A4F]" />
              Field Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How was the track? Any hazards?"
              rows={3}
              className="w-full bg-white border border-[#C5C1B1] rounded-[6px] p-2.5 text-sm focus:outline-none focus:border-[#2D6A4F]"
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-[#C5C1B1] text-[#555555] rounded-[6px] text-sm font-bold hover:bg-[#F5F3EE] transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-[2] py-2 bg-[#2D6A4F] text-white rounded-[6px] text-sm font-bold hover:bg-[#23533E] transition-all flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save to Log
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
