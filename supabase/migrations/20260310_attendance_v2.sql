-- ============================================================
-- Migration: Attendance V2 — Session-based, Approval-first
-- ============================================================

-- 1. Drop removed columns from attendance
ALTER TABLE public.attendance
  DROP COLUMN IF EXISTS late_by,
  DROP COLUMN IF EXISTS overtime_by;

-- 2. Drop old single check_in / check_out columns
ALTER TABLE public.attendance
  DROP COLUMN IF EXISTS check_in,
  DROP COLUMN IF EXISTS check_out;

-- 3. Add four session columns
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS check_in_1  TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS check_out_1 TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS check_in_2  TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS check_out_2 TIMESTAMP WITH TIME ZONE;

-- 4. Update work_type CHECK constraint to include 'hybrid'
ALTER TABLE public.attendance
  DROP CONSTRAINT IF EXISTS attendance_work_type_check;

ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_work_type_check
  CHECK (work_type IN ('office', 'wfh', 'hybrid'));

-- 5. Update leave_requests category CHECK constraint to include 'hybrid'
ALTER TABLE public.leave_requests
  DROP CONSTRAINT IF EXISTS leave_requests_category_check;

ALTER TABLE public.leave_requests
  ADD CONSTRAINT leave_requests_category_check
  CHECK (category IN ('leave', 'wfh', 'halfday', 'hybrid'));

-- 6. Index on new session columns (optional but useful for queries)
CREATE INDEX IF NOT EXISTS idx_attendance_session1_in ON public.attendance(user_id, check_in_1);
