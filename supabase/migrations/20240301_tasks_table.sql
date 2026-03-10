-- Create tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_to uuid REFERENCES auth.users(id) NOT NULL,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  due_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 1. Users can view tasks assigned to them or created by them
CREATE POLICY "Users can view own tasks" ON public.tasks
  FOR SELECT USING (auth.uid() = assigned_to OR auth.uid() = created_by);

-- 2. Admins can view all tasks
CREATE POLICY "Admins can view all tasks" ON public.tasks
  FOR SELECT USING (
    (SELECT public.get_my_role()) IN ('admin', 'hr')
  );

-- 3. Admins/HR can insert tasks
CREATE POLICY "Admins and HR can insert tasks" ON public.tasks
  FOR INSERT WITH CHECK (
    (SELECT public.get_my_role()) IN ('admin', 'hr')
  );

-- 4. Users can insert their own tasks
CREATE POLICY "Users can insert own tasks" ON public.tasks
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- 5. Admins/HR can update any task
CREATE POLICY "Admins and HR can update tasks" ON public.tasks
  FOR UPDATE USING (
    (SELECT public.get_my_role()) IN ('admin', 'hr')
  );

-- 6. Users can update their own tasks
CREATE POLICY "Users can update own tasks" ON public.tasks
  FOR UPDATE USING (auth.uid() = assigned_to OR auth.uid() = created_by);
