-- Create leave_requests table
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  type text NOT NULL CHECK (type IN ('full-day', 'half-day', 'wfh')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own leaves" ON public.leave_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all leaves" ON public.leave_requests
  FOR SELECT USING ((SELECT public.get_my_role()) IN ('admin', 'hr'));

CREATE POLICY "Users can insert leaves" ON public.leave_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update leaves" ON public.leave_requests
  FOR UPDATE USING ((SELECT public.get_my_role()) IN ('admin', 'hr'));
