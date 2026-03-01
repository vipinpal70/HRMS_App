-- Add location columns to attendance table
ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS location_lat double precision,
ADD COLUMN IF NOT EXISTS location_lng double precision;

-- Refresh the schema cache (handled automatically by Supabase usually, but good to be explicit if possible via dashboard)
