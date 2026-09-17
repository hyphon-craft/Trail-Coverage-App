import React from 'react';
import { 
  Eye, 
  EyeOff, 
  Upload, 
  Database, 
  PanelLeftClose, 
  PanelLeftOpen,
  Layers,
  Download
} from 'lucide-react';
import { AppSettings, Region } from '../types';

interface HeaderProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  regions: Region[];
  activeRegionId: string;
  onSelectRegion: (id: string) => void;
  onOpenGpxUpload: () => void;
  onOpenSupabase: () => void;
  onExportData: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  onUpdateSettings,
  regions,
  activeRegionId,
  onSelectRegion,
  onOpenGpxUpload,
  onOpenSupabase,
  onExportData,
  isSidebarOpen,
  onToggleSidebar,
}) => {
  return (
    <header className="h-11 bg-[#FCFBF7] border-b border-[#C5C1B1] px-3 flex items-center justify-between z-30 relative select-none">
      {/* Left: Sidebar Toggle + Region Title */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleSidebar}
          className="p-1 rounded-[4px] text-[#2B2B2B] hover:text-[#1A1A1A] hover:bg-[#F5F3EE] transition-colors"
          title={isSidebarOpen ? 'Hide panel' : 'Show panel'}
        >
          {isSidebarOpen ? (
            <PanelLeftClose className="w-4 h-4" />
          ) : (
            <PanelLeftOpen className="w-4 h-4" />
          )}
        </button>

        <select
          value={activeRegionId}
          onChange={(e) => onSelectRegion(e.target.value)}
          className="text-xs font-semibold text-[#1A1A1A] bg-transparent hover:bg-[#F5F3EE] rounded-[4px] px-1.5 py-1 cursor-pointer focus:outline-none transition-colors"
        >
          {regions.map((reg) => (
            <option key={reg.id} value={reg.id} className="bg-[#FCFBF7] text-[#1A1A1A]">
              {reg.name}
            </option>
          ))}
        </select>
      </div>

      {/* Right: Minimal GIS Controls */}
      <div className="flex items-center gap-1 text-xs">
        {/* Layer Selector */}
        <div className="flex items-center gap-1 text-[#2B2B2B] hover:text-[#1A1A1A] px-1.5 py-0.5 rounded-[4px] hover:bg-[#F5F3EE]">
          <Layers className="w-3.5 h-3.5 text-[#555555]" />
          <select
            value={settings.mapStyle}
            onChange={(e) => onUpdateSettings({ mapStyle: e.target.value as any })}
            className="text-xs font-mono text-[#2B2B2B] bg-transparent cursor-pointer focus:outline-none"
          >
            <option value="topo">ESRI Topo</option>
            <option value="cyclosm">CyclOSM Topo</option>
            <option value="osm">OSM</option>
            <option value="satellite">Satellite</option>
          </select>
        </div>

        {/* Survey Focus Toggle */}
        <button
          onClick={() => onUpdateSettings({ fogOfWarEnabled: !settings.fogOfWarEnabled })}
          className={`p-1.5 rounded-[4px] transition-colors ${
            settings.fogOfWarEnabled
              ? 'text-[#2D6A4F] bg-[#E8F0EB]'
              : 'text-[#555555] hover:text-[#1A1A1A] hover:bg-[#F5F3EE]'
          }`}
          title={settings.fogOfWarEnabled ? 'Focus mode active (unexplored subdued)' : 'Focus mode off'}
        >
          {settings.fogOfWarEnabled ? (
            <Eye className="w-3.5 h-3.5" />
          ) : (
            <EyeOff className="w-3.5 h-3.5" />
          )}
        </button>

        {/* GPX Import */}
        <button
          onClick={onOpenGpxUpload}
          className="flex items-center gap-1 px-2 py-1 rounded-[4px] text-xs font-medium text-[#2D6A4F] hover:bg-[#E8F0EB] transition-colors"
          title="Import GPX track"
        >
          <Upload className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Import GPX</span>
        </button>

        {/* Export Full Backup */}
        <button
          onClick={onExportData}
          className="flex items-center gap-1 px-2 py-1 rounded-[4px] text-xs font-medium text-[#1A1A1A] hover:bg-[#F5F3EE] transition-colors"
          title="Export all nodes, segments, and routes"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Export Backup</span>
        </button>

        {/* Settings / Supabase */}
        <button
          onClick={onOpenSupabase}
          className="p-1.5 rounded-[4px] text-[#555555] hover:text-[#1A1A1A] hover:bg-[#F5F3EE] transition-colors"
          title="GIS Database & Settings"
        >
          <Database className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
