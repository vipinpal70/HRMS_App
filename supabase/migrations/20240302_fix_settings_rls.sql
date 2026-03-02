-- Allow anyone (authenticated or anonymous) to view company settings
-- This is necessary for geofencing checks during the login process

DROP POLICY IF EXISTS "Everyone can view company settings" ON public.company_settings;

CREATE POLICY "Anyone can view company settings" ON public.company_settings
  FOR SELECT USING (true);
