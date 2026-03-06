-- ============================================================
-- Notifications V2: Schema evolution + new triggers
-- ============================================================

-- 1. Add missing + new columns for production-grade notifications
-- ────────────────────────────────────────────────────────────

-- title: the init migration did NOT include this column,
-- and the 20240301 migration used CREATE TABLE IF NOT EXISTS
-- which silently skipped if the table already existed.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';

-- Fix type CHECK constraint: the init migration only allows
-- ('check_in_alert','leave_status','task_assigned','system','announcement')
-- but triggers use UI severity types ('info','success','warning','error').
-- Drop the old constraint and add the correct one.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('info', 'success', 'warning', 'error'));

-- category: event-type semantics (what happened)
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS category TEXT
  CHECK (category IN (
    'leave_status',
    'leave_request',
    'task_assigned',
    'task_updated',
    'attendance',
    'system',
    'announcement'
  )) DEFAULT 'system';

-- metadata: extensible JSONB payload (entity IDs, extra context)
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- actor_id: who triggered the notification
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES auth.users(id);

-- 2. Better indexes for production queries
-- ────────────────────────────────────────────────────────────

-- Fast unread-count + latest-first for bell badge
CREATE INDEX IF NOT EXISTS idx_notifications_unread_created
  ON public.notifications(user_id, created_at DESC)
  WHERE is_read = FALSE;

-- Fast lookup by category for filtering
CREATE INDEX IF NOT EXISTS idx_notifications_category
  ON public.notifications(user_id, category);


-- 3. Upgrade existing triggers to populate new columns
-- ────────────────────────────────────────────────────────────

-- 3a. Leave status update → Notify the employee
CREATE OR REPLACE FUNCTION public.handle_leave_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (user_id, title, message, type, category, link, metadata)
    VALUES (
      NEW.user_id,
      CASE
        WHEN NEW.status = 'approved' THEN 'Leave Approved ✅'
        WHEN NEW.status = 'rejected' THEN 'Leave Rejected ❌'
        ELSE 'Leave Request Updated'
      END,
      'Your ' || NEW.category || ' request from ' ||
        TO_CHAR(NEW.start_day, 'Mon DD') || ' to ' ||
        TO_CHAR(NEW.end_day, 'Mon DD') || ' has been ' || NEW.status || '.',
      CASE
        WHEN NEW.status = 'approved' THEN 'success'
        WHEN NEW.status = 'rejected' THEN 'error'
        ELSE 'info'
      END,
      'leave_status',
      '/leave',
      jsonb_build_object(
        'leave_id', NEW.id,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'category', NEW.category,
        'start_day', NEW.start_day,
        'end_day', NEW.end_day
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_leave_update ON public.leave_requests;
CREATE TRIGGER on_leave_update
  AFTER UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_leave_update();


-- 3b. New task assigned → Notify the assignee
CREATE OR REPLACE FUNCTION public.handle_new_task()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, category, link, actor_id, metadata)
  VALUES (
    NEW.assigned_to,
    'New Task Assigned 📋',
    'You have been assigned: "' || NEW.title || '" (Priority: ' || UPPER(NEW.priority) || ')',
    CASE
      WHEN NEW.priority IN ('high', 'critical') THEN 'warning'
      ELSE 'info'
    END,
    'task_assigned',
    '/tasks',
    NEW.created_by,
    jsonb_build_object(
      'task_id', NEW.id,
      'title', NEW.title,
      'priority', NEW.priority,
      'start_day', NEW.start_day,
      'end_day', NEW.end_day
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_task_insert ON public.tasks;
CREATE TRIGGER on_task_insert
  AFTER INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_task();


-- 4. NEW: Task status update → Notify the task creator
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_task_status_update()
RETURNS TRIGGER AS $$
DECLARE
  assignee_name TEXT;
BEGIN
  -- Only fire when status actually changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Look up assignee name
    SELECT name INTO assignee_name FROM public.profiles WHERE id = NEW.assigned_to;

    -- Notify the creator
    IF NEW.created_by IS NOT NULL AND NEW.created_by <> NEW.assigned_to THEN
      INSERT INTO public.notifications (user_id, title, message, type, category, link, actor_id, metadata)
      VALUES (
        NEW.created_by,
        'Task Status Updated',
        COALESCE(assignee_name, 'An employee') || ' updated "' || NEW.title || '" to ' || REPLACE(NEW.status, '_', ' ') || '.',
        CASE
          WHEN NEW.status = 'completed' THEN 'success'
          ELSE 'info'
        END,
        'task_updated',
        '/tasks',
        NEW.assigned_to,
        jsonb_build_object(
          'task_id', NEW.id,
          'title', NEW.title,
          'old_status', OLD.status,
          'new_status', NEW.status,
          'assignee', assignee_name
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_task_status_update ON public.tasks;
CREATE TRIGGER on_task_status_update
  AFTER UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.handle_task_status_update();


-- 5. NEW: New leave request → Notify all admin/HR users
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_leave_request()
RETURNS TRIGGER AS $$
DECLARE
  requester_name TEXT;
  admin_record RECORD;
BEGIN
  -- Look up requester name
  SELECT name INTO requester_name FROM public.profiles WHERE id = NEW.user_id;

  -- Notify every admin and HR user
  FOR admin_record IN
    SELECT id FROM public.profiles WHERE role IN ('admin', 'hr') AND id <> NEW.user_id
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, category, link, actor_id, metadata)
    VALUES (
      admin_record.id,
      'New Leave Request 📝',
      COALESCE(requester_name, 'An employee') || ' requested ' || NEW.category ||
        ' from ' || TO_CHAR(NEW.start_day, 'Mon DD') || ' to ' || TO_CHAR(NEW.end_day, 'Mon DD') || '.',
      'info',
      'leave_request',
      '/leave',
      NEW.user_id,
      jsonb_build_object(
        'leave_id', NEW.id,
        'requester', requester_name,
        'category', NEW.category,
        'start_day', NEW.start_day,
        'end_day', NEW.end_day,
        'reason', NEW.reason
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_leave_request_insert ON public.leave_requests;
CREATE TRIGGER on_leave_request_insert
  AFTER INSERT ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_leave_request();


-- 6. Backfill: set category on existing rows that have NULL
-- ────────────────────────────────────────────────────────────
UPDATE public.notifications SET category = 'system' WHERE category IS NULL;
