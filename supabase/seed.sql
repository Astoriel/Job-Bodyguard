-- Seed data for development/testing
-- Run after schema.sql

-- Create a test user (note: in real scenario, user comes from auth signup)
-- This is just for reference structure

/*
-- Example: Insert test application
INSERT INTO public.applications (
    user_id,
    job_url,
    job_title,
    company_name,
    location,
    platform,
    status,
    toxicity_score,
    compatibility_score,
    red_flags,
    green_flags
) VALUES (
    'YOUR-USER-UUID-HERE',
    'https://linkedin.com/jobs/view/123456',
    'Senior Frontend Developer',
    'Acme Corp',
    'San Francisco, CA',
    'linkedin',
    'applied',
    35,
    78,
    '[{"flag": "Rockstar developer wanted", "severity": "medium"}]',
    '[{"flag": "Remote-first culture"}]'
);
*/

-- Grant usage permissions for the functions
GRANT EXECUTE ON FUNCTION increment_analyze_usage TO authenticated;
GRANT EXECUTE ON FUNCTION increment_tailor_usage TO authenticated;
GRANT EXECUTE ON FUNCTION check_rate_limit TO authenticated;
