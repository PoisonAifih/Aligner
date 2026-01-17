-- 1. Add username column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS username text;

-- 2. Update the handle_new_user function to read metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, username)
  VALUES (
    new.id, 
    new.email, 
    -- Default to 'user' if role is not provided in metadata
    COALESCE(new.raw_user_meta_data->>'role', 'user'),
    -- Get username from metadata
    new.raw_user_meta_data->>'username'
  );
  return new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ensure the trigger is still active (it should be, but just to be safe)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
