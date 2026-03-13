-- Refine handle_new_user trigger to safely handle DOB
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  dob_val DATE;
BEGIN
  -- Attempt to cast dob from metadata, handle null/invalid safely
  BEGIN
    dob_val := (new.raw_user_meta_data->>'dob')::DATE;
  EXCEPTION WHEN OTHERS THEN
    dob_val := NULL;
  END;

  INSERT INTO public.profiles (id, name, email, role, dob)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    'emp', -- Default role
    dob_val
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
