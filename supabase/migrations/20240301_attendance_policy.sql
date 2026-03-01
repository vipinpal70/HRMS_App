-- Enable RLS on attendance
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Policy for INSERT: Users can insert their own attendance
CREATE POLICY "Users can insert own attendance" ON public.attendance
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy for SELECT: Users can view their own attendance
CREATE POLICY "Users can view own attendance" ON public.attendance
  FOR SELECT USING (auth.uid() = user_id);

-- Policy for UPDATE: Users can update their own attendance (for check-out)
CREATE POLICY "Users can update own attendance" ON public.attendance
  FOR UPDATE USING (auth.uid() = user_id);

-- Admins can view/edit all (using the function we created earlier)
CREATE POLICY "Admins can view all attendance" ON public.attendance
  FOR SELECT USING (
    (SELECT public.get_my_role()) IN ('admin', 'hr')
  );

CREATE POLICY "Admins can update all attendance" ON public.attendance
  FOR UPDATE USING (
    (SELECT public.get_my_role()) = 'admin'
  );
