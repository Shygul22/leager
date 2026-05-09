-- Create Projects and Project Updates tables
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'in_progress',
    progress NUMERIC DEFAULT 0,
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own projects" ON public.projects FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.project_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.project_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own project updates" ON public.project_updates FOR ALL USING (
    project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid())
);

-- Update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Refresh schema
NOTIFY pgrst, 'reload schema';
