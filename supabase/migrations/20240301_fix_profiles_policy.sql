-- Fix infinite recursion in profiles policy
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "HR can view all profiles" ON public.profiles;

-- Create non-recursive policies
-- 1. Users can ALWAYS view their own profile (simplest base case)
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- 2. Admins/HR can view all profiles
-- To avoid recursion, we DON'T query the profiles table again to check if the user is admin.
-- Instead, we should rely on a secure way or a different table.
-- BUT, typically, we can use a "security definer" function to check role safely without recursion.

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Now use this function in the policy
CREATE POLICY "Admins and HR can view all profiles" ON public.profiles
  FOR SELECT USING (
    (SELECT public.get_my_role()) IN ('admin', 'hr')
  );

-- Also allow update
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE USING (
    (SELECT public.get_my_role()) = 'admin'
  );
