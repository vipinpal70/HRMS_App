-- Create company_settings table
CREATE TABLE IF NOT EXISTS public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL DEFAULT 'My Company',
  office_ip_cidr text,
  office_lat double precision,
  office_lng double precision,
  office_radius_meters integer DEFAULT 100,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Ensure only one row exists (singleton pattern)
-- This trick prevents more than one row by enforcing a unique constraint on a constant value
CREATE UNIQUE INDEX IF NOT EXISTS company_settings_singleton_idx ON public.company_settings ((true));

-- Enable RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- 1. Everyone can view settings (needed for validation logic)
CREATE POLICY "Everyone can view company settings" ON public.company_settings
  FOR SELECT USING (true);

-- 2. Only Admins can update settings
-- Uses the get_my_role() function we created earlier
CREATE POLICY "Admins can update company settings" ON public.company_settings
  FOR UPDATE USING (
    (SELECT public.get_my_role()) = 'admin'
  );

-- 3. Only Admins can insert (initial setup)
CREATE POLICY "Admins can insert company settings" ON public.company_settings
  FOR INSERT WITH CHECK (
    (SELECT public.get_my_role()) = 'admin'
  );

-- Insert default row if empty
INSERT INTO public.company_settings (company_name, office_lat, office_lng, office_radius_meters, office_ip_cidr)
VALUES ('AttendX Corp', 28.6139, 77.2090, 100, '192.168.1.0/24')
ON CONFLICT DO NOTHING;
