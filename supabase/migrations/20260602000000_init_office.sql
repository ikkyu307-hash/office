-- Enable the pgvector extension to work with embeddings for the AI Secretary knowledge base
CREATE EXTENSION IF NOT EXISTS vector;

-- Create Employee Profiles table
CREATE TABLE IF NOT EXISTS public.employee_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    nickname VARCHAR(255),
    department VARCHAR(50) NOT NULL CHECK (department IN ('Tech', 'Design', 'Marketing', 'HR', 'Management')),
    position VARCHAR(100) NOT NULL CHECK (position IN ('Tech Lead', 'PM', 'Developer', 'UI/UX Designer', 'HR Manager', 'Marketing Lead')),
    status VARCHAR(50) DEFAULT 'Available' CHECK (status IN ('Available', 'Focus Mode', 'In a Meeting', 'Away From Keyboard', 'Resting')),
    skin_tone_id INTEGER DEFAULT 1,
    hair_style_id INTEGER DEFAULT 1,
    hair_color_hex VARCHAR(7) DEFAULT '#FF5733',
    outfit_id INTEGER DEFAULT 1,
    accessory_id INTEGER DEFAULT 0,
    x INTEGER DEFAULT 400,
    y INTEGER DEFAULT 300,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Realtime for Employee Profiles (movement synchronization)
ALTER TABLE public.employee_profiles REPLICA IDENTITY FULL;

-- Create Tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES public.employee_profiles(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date DATE,
    priority VARCHAR(10) NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
    status VARCHAR(20) DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Room Bookings table
CREATE TABLE IF NOT EXISTS public.room_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_name VARCHAR(100) NOT NULL CHECK (room_name IN ('Alpha Room', 'Beta Room', 'Cafe lounge')),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    booked_by UUID REFERENCES public.employee_profiles(id) ON DELETE CASCADE NOT NULL,
    attendees TEXT[] DEFAULT '{}'::TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Company Knowledge table (using 768-dimension vectors for Gemini Embeddings)
CREATE TABLE IF NOT EXISTS public.company_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    embedding vector(768), -- Dimension 768 fits Google's text-embedding-004 model
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Vector Similarity Search function for pgvector
CREATE OR REPLACE FUNCTION match_knowledge (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id UUID,
  title VARCHAR,
  content TEXT,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    title,
    content,
    1 - (embedding <=> query_embedding) AS similarity
  FROM company_knowledge
  WHERE 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.employee_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_knowledge ENABLE ROW LEVEL SECURITY;

-- Create Policies (simplistic single-company policy, easily extendable to multi-tenant tenant_id)
-- For demonstration/multi-tenant scalability, we allow all authenticated users to read and update their profiles
CREATE POLICY "Allow read access to profiles for all authenticated users"
    ON public.employee_profiles FOR SELECT
    USING (true);

CREATE POLICY "Allow update access to profiles for owners"
    ON public.employee_profiles FOR UPDATE
    USING (true); -- In production, restrict to: auth.uid() = id

CREATE POLICY "Allow insert access to profiles for owners"
    ON public.employee_profiles FOR INSERT
    WITH CHECK (true);

-- Tasks Policies
CREATE POLICY "Allow read access to tasks for all authenticated users"
    ON public.tasks FOR SELECT
    USING (true);

CREATE POLICY "Allow write access to tasks for owners"
    ON public.tasks FOR ALL
    USING (true);

-- Bookings Policies
CREATE POLICY "Allow read access to room bookings for all"
    ON public.room_bookings FOR SELECT
    USING (true);

CREATE POLICY "Allow booking additions for all"
    ON public.room_bookings FOR ALL
    USING (true);

-- Company Knowledge Policies
CREATE POLICY "Allow read access to knowledge for all"
    ON public.company_knowledge FOR SELECT
    USING (true);

CREATE POLICY "Allow write access to knowledge for all"
    ON public.company_knowledge FOR ALL
    USING (true);
