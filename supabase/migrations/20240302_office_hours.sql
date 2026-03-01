-- Add office hours columns to company_settings
-- Default: 9:00 AM to 7:00 PM
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS office_start_time TIME DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS office_end_time TIME DEFAULT '19:00';
