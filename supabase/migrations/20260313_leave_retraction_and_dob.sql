-- 1. Update leave_requests status constraint
ALTER TABLE public.leave_requests DROP CONSTRAINT IF EXISTS leave_requests_status_check;
ALTER TABLE public.leave_requests ADD CONSTRAINT leave_requests_status_check 
  CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'retraction_pending'));

-- 2. Update leave_requests category constraint (to allow 'hybrid')
ALTER TABLE public.leave_requests DROP CONSTRAINT IF EXISTS leave_requests_category_check;
ALTER TABLE public.leave_requests ADD CONSTRAINT leave_requests_category_check 
  CHECK (category IN ('leave', 'wfh', 'halfday', 'hybrid'));

-- 3. Add DOB to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dob DATE;

-- 4. Update handle_new_user trigger to include DOB
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role, dob)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    'emp', -- Default role
    (new.raw_user_meta_data->>'dob')::DATE
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
