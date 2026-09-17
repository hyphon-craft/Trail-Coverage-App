import React, { useState, useEffect } from 'react';
import { 
  X, 
  Database, 
  Copy, 
  Check, 
  Download, 
  Upload, 
  RotateCcw
} from 'lucide-react';
import { AppSettings } from '../../types';
import { exportBackupData } from '../../utils/storage';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onResetToDefaults: () => void;
  onImportBackup: (data: any) => void;
}

const SUPABASE_SCHEMA_SQL = `-- ====================================================================
-- Mt Taranaki Trail Coverage - Database Schema (PostGIS + PostgreSQL)
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. REGIONS TABLE
CREATE TABLE IF NOT EXISTS public.regions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    center_lat DOUBLE PRECISION NOT NULL,
    center_lng DOUBLE PRECISION NOT NULL,
    zoom DOUBLE PRECISION DEFAULT 12.0,
    bounds JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. NODES TABLE (Huts, Summits, Junctions, Carparks, Lookouts, Bridges)
CREATE TYPE public.node_type_enum AS ENUM (
    'hut', 'summit', 'junction', 'lookout', 'carpark', 'bridge', 'water_source'
);

CREATE TABLE IF NOT EXISTS public.nodes (
    id TEXT PRIMARY KEY DEFAULT ('node-' || gen_random_uuid()),
    region_id TEXT NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type public.node_type_enum NOT NULL DEFAULT 'junction',
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    elevation DOUBLE PRECISION NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nodes_region ON public.nodes(region_id);
CREATE INDEX IF NOT EXISTS idx_nodes_type ON public.nodes(type);

-- 3. SEGMENTS TABLE (Connecting two nodes)
CREATE TYPE public.trail_difficulty_enum AS ENUM ('easy', 'moderate', 'challenging', 'expert');
CREATE TYPE public.trail_surface_enum AS ENUM ('track', 'boardwalk', 'scree', 'poled_route', 'road');

CREATE TABLE IF NOT EXISTS public.segments (
    id TEXT PRIMARY KEY DEFAULT ('seg-' || gen_random_uuid()),
    region_id TEXT NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_node_id TEXT NOT NULL REFERENCES public.nodes(id) ON DELETE RESTRICT,
    end_node_id TEXT NOT NULL REFERENCES public.nodes(id) ON DELETE RESTRICT,
    distance_km DOUBLE PRECISION NOT NULL,
    elevation_gain_m DOUBLE PRECISION NOT NULL DEFAULT 0,
    elevation_loss_m DOUBLE PRECISION NOT NULL DEFAULT 0,
    coordinates JSONB NOT NULL,
    difficulty public.trail_difficulty_enum DEFAULT 'moderate',
    surface public.trail_surface_enum DEFAULT 'track',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_segments_region ON public.segments(region_id);
CREATE INDEX IF NOT EXISTS idx_segments_nodes ON public.segments(start_node_id, end_node_id);

-- 4. COMPLETIONS TABLE (Segment hike history)
CREATE TABLE IF NOT EXISTS public.completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    segment_id TEXT NOT NULL REFERENCES public.segments(id) ON DELETE CASCADE,
    completed_at DATE NOT NULL DEFAULT CURRENT_DATE,
    duration_minutes INTEGER,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    weather TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. ROUTES TABLE (Custom hikes formed by connected segment chains)
CREATE TABLE IF NOT EXISTS public.routes (
    id TEXT PRIMARY KEY DEFAULT ('route-' || gen_random_uuid()),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    region_id TEXT NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    segment_ids TEXT[] NOT NULL,
    total_distance_km DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_gain_m DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_loss_m DOUBLE PRECISION NOT NULL DEFAULT 0,
    estimated_hours DOUBLE PRECISION NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
`;

export const SupabaseModal: React.FC<SupabaseModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onResetToDefaults,
  onImportBackup,
}) => {
  const [activeTab, setActiveTab] = useState<'config' | 'schema' | 'backup'>('config');
  const [supabaseUrl, setSupabaseUrl] = useState(settings.supabaseUrl || '');
  const [supabaseKey, setSupabaseKey] = useState(settings.supabaseKey || '');
  const [copied, setCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

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

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      supabaseUrl: supabaseUrl.trim(),
      supabaseKey: supabaseKey.trim(),
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleCopySchema = () => {
    navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportBackup = () => {
    const jsonStr = exportBackupData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taranaki_trail_network_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target?.result as string);
          onImportBackup(parsed);
          alert('Network registry successfully restored from backup.');
          onClose();
        } catch {
          alert('Invalid backup JSON file.');
        }
      };
      reader.readAsText(e.target.files[0]);
    }
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
      <div className="bg-[#FCFBF7] border border-[#D1CDBC] rounded-[6px] w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-[0_8px_24px_rgba(0,0,0,0.16)] p-5 relative text-[#2B2B2B] select-none font-sans">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 text-[#555555] hover:text-[#1A1A1A] p-1 rounded-[4px] hover:bg-[#F5F3EE] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-4 border-b border-[#D1CDBC] pb-3">
          <div className="w-7 h-7 rounded-[4px] bg-[#2D6A4F] text-white flex items-center justify-center shadow-xs">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#1A1A1A]">
              GIS Configuration & Database
            </h2>
            <p className="text-[11px] font-mono text-[#555555]">
              Open-source map layers, PostgreSQL schema, and local network backup.
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 border-b border-[#D1CDBC] mb-3 text-xs font-mono">
          <button
            onClick={() => setActiveTab('config')}
            className={`pb-1.5 px-2.5 border-b-2 transition-colors font-medium ${
              activeTab === 'config'
                ? 'border-[#2D6A4F] text-[#2D6A4F] font-semibold'
                : 'border-transparent text-[#555555] hover:text-[#1A1A1A]'
            }`}
          >
            Maps & Cloud Sync
          </button>
          <button
            onClick={() => setActiveTab('schema')}
            className={`pb-1.5 px-2.5 border-b-2 transition-colors font-medium ${
              activeTab === 'schema'
                ? 'border-[#2D6A4F] text-[#2D6A4F] font-semibold'
                : 'border-transparent text-[#555555] hover:text-[#1A1A1A]'
            }`}
          >
            PostgreSQL Schema
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`pb-1.5 px-2.5 border-b-2 transition-colors font-medium ${
              activeTab === 'backup'
                ? 'border-[#2D6A4F] text-[#2D6A4F] font-semibold'
                : 'border-transparent text-[#555555] hover:text-[#1A1A1A]'
            }`}
          >
            Backup & Reset
          </button>
        </div>

        {/* Tab 1: API Configuration */}
        {activeTab === 'config' && (
          <form onSubmit={handleSaveSettings} className="space-y-3 text-xs font-mono">
            <div className="p-3 bg-[#F5F3EE] rounded-[6px] border border-[#D1CDBC] space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#1A1A1A] block font-sans">Free Open-Source Mapping</span>
                <span className="text-[10px] text-[#2D6A4F] font-mono font-semibold">Zero Keys Required ✓</span>
              </div>
              <p className="text-[#2B2B2B] text-[11px] font-sans leading-relaxed">
                Mt Taranaki Trail Registry runs entirely on free, open-source cartography (CyclOSM Topographic Hiking, Esri World Topo, High-Res Satellite Imagery, and OpenStreetMap). No Mapbox tokens, paid accounts, or API keys are required.
              </p>
            </div>

            <div className="p-3 bg-[#F5F3EE] rounded-[6px] border border-[#D1CDBC] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#1A1A1A] font-sans">Supabase Cloud Sync</span>
                <span className="text-[10px] text-[#2D6A4F] font-semibold font-mono">PostgreSQL + PostGIS</span>
              </div>
              <p className="text-[#2B2B2B] text-[11px] font-sans">
                Connect external cloud storage to synchronize tracks across mobile devices and field stations.
              </p>

              <div>
                <label className="text-[#1A1A1A] block mb-1 text-[10px] font-semibold">Project URL</label>
                <input
                  type="text"
                  placeholder="https://your-project.supabase.co"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  className="w-full bg-[#FCFBF7] border border-[#D1CDBC] rounded-[4px] p-1.5 text-[#1A1A1A] text-[11px] focus:outline-none focus:border-[#2D6A4F]"
                />
              </div>

              <div>
                <label className="text-[#1A1A1A] block mb-1 text-[10px] font-semibold">Anon / Public API Key</label>
                <input
                  type="password"
                  placeholder="eyJhbGciOi..."
                  value={supabaseKey}
                  onChange={(e) => setSupabaseKey(e.target.value)}
                  className="w-full bg-[#FCFBF7] border border-[#D1CDBC] rounded-[4px] p-1.5 text-[#1A1A1A] text-[11px] focus:outline-none focus:border-[#2D6A4F]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 font-mono">
              {savedSuccess ? (
                <span className="text-[#2D6A4F] font-semibold flex items-center gap-1 text-xs">
                  <Check className="w-3.5 h-3.5" /> Settings saved successfully
                </span>
              ) : (
                <div />
              )}

              <button
                type="submit"
                className="px-3 py-1 bg-[#2D6A4F] hover:bg-[#23533E] text-white rounded-[4px] text-xs font-semibold border border-[#2D6A4F] transition-colors shadow-xs"
              >
                Save Settings
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: SQL Schema */}
        {activeTab === 'schema' && (
          <div className="space-y-2.5 text-xs font-mono">
            <div className="flex items-center justify-between">
              <p className="text-[#2B2B2B] font-sans text-[11px]">
                PostGIS topological schema for nodes, segments, completions, and expeditions:
              </p>
              <button
                onClick={handleCopySchema}
                className="px-2.5 py-1 bg-[#2D6A4F] hover:bg-[#23533E] text-white rounded-[4px] text-xs font-semibold flex items-center gap-1 transition-colors border border-[#2D6A4F] shrink-0 shadow-xs"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy SQL'}</span>
              </button>
            </div>

            <div className="relative">
              <pre className="p-2.5 bg-[#F5F3EE] border border-[#D1CDBC] rounded-[4px] font-mono text-[10px] text-[#1A1A1A] max-h-72 overflow-y-auto leading-relaxed select-all">
                {SUPABASE_SCHEMA_SQL}
              </pre>
            </div>
          </div>
        )}

        {/* Tab 3: Backup & Restore */}
        {activeTab === 'backup' && (
          <div className="space-y-3 text-xs font-mono">
            <div className="p-3 bg-[#F5F3EE] rounded-[6px] border border-[#D1CDBC] space-y-2">
              <span className="font-semibold text-[#1A1A1A] block font-sans">Export Trail Network JSON</span>
              <p className="text-[#2B2B2B] font-sans text-[11px]">
                Download a complete offline snapshot containing all surveyed track segments, waypoints, completions, and routes.
              </p>
              <button
                onClick={handleExportBackup}
                className="px-3 py-1 bg-[#FCFBF7] hover:bg-[#C5C1B1] text-[#1A1A1A] border border-[#D1CDBC] rounded-[4px] text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-[#2D6A4F]" />
                <span>Export JSON Snapshot</span>
              </button>
            </div>

            <div className="p-3 bg-[#F5F3EE] rounded-[6px] border border-[#D1CDBC] space-y-2">
              <span className="font-semibold text-[#1A1A1A] block font-sans">Restore Network JSON</span>
              <p className="text-[#2B2B2B] font-sans text-[11px]">
                Restore your personal survey logs and waypoints from an exported JSON file.
              </p>
              <label className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FCFBF7] hover:bg-[#C5C1B1] text-[#1A1A1A] border border-[#D1CDBC] rounded-[4px] text-xs font-semibold cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5 text-[#2D6A4F]" />
                <span>Select JSON File</span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImportFile}
                />
              </label>
            </div>

            <div className="p-3 bg-[#FDF2F2] border border-[#F87171] rounded-[6px] space-y-2">
              <span className="font-semibold text-[#A44A3F] block font-sans">Reset to Factory DOC Mt Taranaki Registry</span>
              <p className="text-[#2B2B2B] font-sans text-[11px]">
                Reset nodes and segments to the original Egmont National Park baseline (North Egmont, Pouakai Tarns, Tahurangi, Bells Falls, etc.).
              </p>
              <button
                onClick={() => {
                  if (confirm('Reset trail network to default Mt Taranaki state? Any custom nodes will be cleared.')) {
                    onResetToDefaults();
                    onClose();
                  }
                }}
                className="px-3 py-1 bg-[#FDF2F2] text-[#A44A3F] border border-[#F87171] hover:bg-[#FEE2E2] rounded-[4px] text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore Default Network</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
