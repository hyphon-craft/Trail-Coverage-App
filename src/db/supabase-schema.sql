-- ====================================================================
-- Mt Taranaki Trail Coverage - Supabase Database Schema
-- Scalable for all New Zealand / Global hiking networks
-- ====================================================================

-- Enable PostGIS extension if available (optional, fallback to standard GeoJSON)
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
    'hut',
    'summit',
    'junction',
    'lookout',
    'carpark',
    'bridge',
    'water_source'
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
CREATE TYPE public.trail_difficulty_enum AS ENUM (
    'easy',
    'moderate',
    'challenging',
    'expert'
);

CREATE TYPE public.trail_surface_enum AS ENUM (
    'track',
    'boardwalk',
    'scree',
    'poled_route',
    'road'
);

CREATE TABLE IF NOT EXISTS public.segments (
    id TEXT PRIMARY KEY DEFAULT ('seg-' || gen_random_uuid()),
    region_id TEXT NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_node_id TEXT NOT NULL REFERENCES public.nodes(id) ON DELETE RESTRICT,
    end_node_id TEXT NOT NULL REFERENCES public.nodes(id) ON DELETE RESTRICT,
    distance_km DOUBLE PRECISION NOT NULL,
    elevation_gain_m DOUBLE PRECISION NOT NULL DEFAULT 0,
    elevation_loss_m DOUBLE PRECISION NOT NULL DEFAULT 0,
    coordinates JSONB NOT NULL, -- Array of [lng, lat, ele?]
    difficulty public.trail_difficulty_enum DEFAULT 'moderate',
    surface public.trail_surface_enum DEFAULT 'track',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_segments_region ON public.segments(region_id);
CREATE INDEX IF NOT EXISTS idx_segments_nodes ON public.segments(start_node_id, end_node_id);

-- 4. COMPLETIONS TABLE (Segment hike history per user)
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

CREATE INDEX IF NOT EXISTS idx_completions_user ON public.completions(user_id);
CREATE INDEX IF NOT EXISTS idx_completions_segment ON public.completions(segment_id);

-- 5. VISITED NODES TABLE (Tracking huts, summits, lookouts bagged per user)
CREATE TABLE IF NOT EXISTS public.visited_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
    visited_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    notes TEXT,
    UNIQUE(user_id, node_id)
);

-- 6. ROUTES TABLE (Custom hikes formed by connected segment chains)
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

-- 7. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visited_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;

-- Public can read network data
CREATE POLICY "Public read regions" ON public.regions FOR SELECT USING (true);
CREATE POLICY "Public read nodes" ON public.nodes FOR SELECT USING (true);
CREATE POLICY "Public read segments" ON public.segments FOR SELECT USING (true);

-- User-scoped policies for completions and routes
CREATE POLICY "Users can manage their own completions" ON public.completions
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their visited nodes" ON public.visited_nodes
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own routes" ON public.routes
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 8. STATISTICAL VIEW: Coverage Summary
CREATE OR REPLACE VIEW public.v_region_coverage AS
SELECT 
    r.id AS region_id,
    r.name AS region_name,
    COUNT(s.id) AS total_segments,
    ROUND(SUM(s.distance_km)::numeric, 2) AS total_distance_km,
    ROUND(SUM(s.elevation_gain_m)::numeric, 0) AS total_elevation_gain_m
FROM public.regions r
LEFT JOIN public.segments s ON s.region_id = r.id
GROUP BY r.id, r.name;
