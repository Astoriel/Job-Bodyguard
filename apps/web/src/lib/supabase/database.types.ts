/**
 * Supabase Database Types
 * Generated from schema.sql
 */

export type ApplicationStatus =
    | 'saved'
    | 'applied'
    | 'interviewing'
    | 'offer'
    | 'rejected'
    | 'withdrawn';

export type Platform = 'linkedin' | 'indeed' | 'hh.ru' | 'other';

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string;
                    email: string;
                    full_name: string | null;
                    avatar_url: string | null;
                    resume_text: string | null;
                    resume_skills: string[] | null;
                    resume_updated_at: string | null;
                    preferred_language: string;
                    notifications_enabled: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id: string;
                    email: string;
                    full_name?: string | null;
                    avatar_url?: string | null;
                    resume_text?: string | null;
                    resume_skills?: string[] | null;
                    resume_updated_at?: string | null;
                    preferred_language?: string;
                    notifications_enabled?: boolean;
                };
                Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
            };
            applications: {
                Row: {
                    id: string;
                    user_id: string;
                    job_url: string;
                    job_title: string;
                    company_name: string;
                    location: string | null;
                    platform: Platform;
                    job_data: Record<string, unknown> | null;
                    analysis_result: Record<string, unknown> | null;
                    resume_snapshot: string | null;
                    resume_diff: Record<string, unknown> | null;
                    toxicity_score: number | null;
                    compatibility_score: number | null;
                    red_flags: Record<string, unknown>[];
                    green_flags: Record<string, unknown>[];
                    interview_questions: string[];
                    status: ApplicationStatus;
                    applied_at: string | null;
                    notes: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    job_url: string;
                    job_title: string;
                    company_name: string;
                    location?: string | null;
                    platform: Platform;
                    job_data?: Record<string, unknown> | null;
                    analysis_result?: Record<string, unknown> | null;
                    resume_snapshot?: string | null;
                    resume_diff?: Record<string, unknown> | null;
                    toxicity_score?: number | null;
                    compatibility_score?: number | null;
                    red_flags?: Record<string, unknown>[];
                    green_flags?: Record<string, unknown>[];
                    interview_questions?: string[];
                    status?: ApplicationStatus;
                    applied_at?: string | null;
                    notes?: string | null;
                };
                Update: Partial<Database['public']['Tables']['applications']['Insert']>;
            };
            usage: {
                Row: {
                    id: string;
                    user_id: string;
                    date: string;
                    analyze_count: number;
                    tailor_count: number;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    date?: string;
                    analyze_count?: number;
                    tailor_count?: number;
                };
                Update: Partial<Database['public']['Tables']['usage']['Insert']>;
            };
        };
        Functions: {
            increment_analyze_usage: {
                Args: { p_user_id: string };
                Returns: void;
            };
            increment_tailor_usage: {
                Args: { p_user_id: string };
                Returns: void;
            };
            check_rate_limit: {
                Args: { p_user_id: string; p_limit?: number };
                Returns: boolean;
            };
        };
    };
}

// Helper types for easier use
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export type Application = Database['public']['Tables']['applications']['Row'];
export type ApplicationInsert = Database['public']['Tables']['applications']['Insert'];
export type ApplicationUpdate = Database['public']['Tables']['applications']['Update'];

export type Usage = Database['public']['Tables']['usage']['Row'];
