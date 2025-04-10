-- Job Bodyguard Database Schema
-- Supabase PostgreSQL
-- Run this in Supabase SQL Editor

-- ==========================================
-- ENABLE EXTENSIONS
-- ==========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- PROFILES (extends Supabase auth.users)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    
    -- Resume data (stored as text for AI processing)
    resume_text TEXT,
    resume_skills TEXT[],
    resume_updated_at TIMESTAMPTZ,
    
    -- Settings
    preferred_language TEXT DEFAULT 'en',
    notifications_enabled BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- APPLICATIONS (saved job applications)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Job Info
    job_url TEXT NOT NULL,
    job_title TEXT NOT NULL,
    company_name TEXT NOT NULL,
    location TEXT,
    platform TEXT NOT NULL CHECK (platform IN ('linkedin', 'indeed', 'hh.ru', 'other')),
    
    -- Analysis Results (stored as JSONB for flexibility)
    job_data JSONB,
    analysis_result JSONB,
    
    -- Resume Version
    resume_snapshot TEXT,
    resume_diff JSONB,
    
    -- Scores & Flags
    toxicity_score INTEGER CHECK (toxicity_score >= 0 AND toxicity_score <= 100),
    compatibility_score INTEGER CHECK (compatibility_score >= 0 AND compatibility_score <= 100),
    red_flags JSONB DEFAULT '[]',
    green_flags JSONB DEFAULT '[]',
    
    -- Interview Prep
    interview_questions JSONB DEFAULT '[]',
    
    -- Status Tracking
    status TEXT DEFAULT 'saved' CHECK (status IN (
        'saved', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn'
    )),
    applied_at TIMESTAMPTZ,
    
    -- Notes
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint: one entry per job per user
    CONSTRAINT unique_user_job UNIQUE (user_id, job_url)
);

-- ==========================================
-- USAGE (rate limiting & analytics)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Counters
    analyze_count INTEGER DEFAULT 0,
    tailor_count INTEGER DEFAULT 0,
    
    -- Unique per user per day
    CONSTRAINT unique_user_date UNIQUE (user_id, date)
);

-- ==========================================
-- ROW LEVEL SECURITY
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Applications policies
CREATE POLICY "Users can view own applications"
    ON public.applications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own applications"
    ON public.applications FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own applications"
    ON public.applications FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own applications"
    ON public.applications FOR DELETE
    USING (auth.uid() = user_id);

-- Usage policies
CREATE POLICY "Users can view own usage"
    ON public.usage FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage"
    ON public.usage FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own usage"
    ON public.usage FOR UPDATE
    USING (auth.uid() = user_id);

-- ==========================================
-- INDEXES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON public.applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_created_at ON public.applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_company ON public.applications(company_name);
CREATE INDEX IF NOT EXISTS idx_usage_user_date ON public.usage(user_id, date);

-- ==========================================
-- FUNCTIONS
-- ==========================================

-- Function to increment usage counter
CREATE OR REPLACE FUNCTION increment_analyze_usage(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.usage (user_id, date, analyze_count)
    VALUES (p_user_id, CURRENT_DATE, 1)
    ON CONFLICT (user_id, date)
    DO UPDATE SET analyze_count = usage.analyze_count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment tailor usage
CREATE OR REPLACE FUNCTION increment_tailor_usage(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.usage (user_id, date, tailor_count)
    VALUES (p_user_id, CURRENT_DATE, 1)
    ON CONFLICT (user_id, date)
    DO UPDATE SET tailor_count = usage.tailor_count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(p_user_id UUID, p_limit INTEGER DEFAULT 50)
RETURNS BOOLEAN AS $$
DECLARE
    current_count INTEGER;
BEGIN
    SELECT COALESCE(analyze_count, 0) INTO current_count
    FROM public.usage
    WHERE user_id = p_user_id AND date = CURRENT_DATE;
    
    RETURN COALESCE(current_count, 0) < p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS applications_updated_at ON public.applications;
CREATE TRIGGER applications_updated_at
    BEFORE UPDATE ON public.applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==========================================
-- COMMENTS (for documentation)
-- ==========================================
COMMENT ON TABLE public.profiles IS 'User profiles extending Supabase auth';
COMMENT ON TABLE public.applications IS 'Saved job applications with analysis results';
COMMENT ON TABLE public.usage IS 'Daily usage tracking for rate limiting';

COMMENT ON COLUMN public.applications.job_data IS 'Full JobData object from parser';
COMMENT ON COLUMN public.applications.analysis_result IS 'AI analysis result with scores and flags';
COMMENT ON COLUMN public.applications.resume_diff IS 'Changes made to resume for this application';
