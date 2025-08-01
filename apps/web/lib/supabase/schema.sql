-- Enable Row Level Security
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Create profiles table extending auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Create teams table
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_name TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on teams
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access teams they belong to
CREATE POLICY "Users can view teams they belong to" ON public.teams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = teams.id
      AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Team owners can update teams" ON public.teams
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Users can create teams" ON public.teams
  FOR INSERT WITH CHECK (created_by = auth.uid());

-- Create team_members table
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('admin', 'accountant', 'viewer')) DEFAULT 'viewer',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (team_id, user_id)
);

-- Enable RLS on team_members
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access team members for teams they belong to
CREATE POLICY "Users can view team members of their teams" ON public.team_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team admins can manage team members" ON public.team_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.user_id = auth.uid()
      AND tm.role = 'admin'
    )
  );

-- Create quickbooks_tokens table
CREATE TABLE IF NOT EXISTS public.quickbooks_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  encrypted_access_token TEXT,
  encrypted_refresh_token TEXT,
  realm_id TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (team_id, user_id)
);

-- Enable RLS on quickbooks_tokens
ALTER TABLE public.quickbooks_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own QuickBooks tokens
CREATE POLICY "Users can view own QuickBooks tokens" ON public.quickbooks_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own QuickBooks tokens" ON public.quickbooks_tokens
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own QuickBooks tokens" ON public.quickbooks_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Team members can access team QuickBooks tokens
CREATE POLICY "Team members can view team QuickBooks tokens" ON public.quickbooks_tokens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_members.team_id = quickbooks_tokens.team_id
      AND team_members.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_teams_created_by ON public.teams(created_by);

-- Create function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create profile
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user(); 