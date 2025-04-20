import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

// Request validation schema for creating application
const CreateApplicationSchema = z.object({
    jobUrl: z.string().url(),
    jobTitle: z.string(),
    companyName: z.string(),
    location: z.string().optional(),
    platform: z.enum(['linkedin', 'indeed', 'hh.ru', 'other']),
    jobData: z.object({}).passthrough().optional(),
    analysisResult: z.object({}).passthrough().optional(),
    resumeSnapshot: z.string().optional(),
    redFlags: z.array(z.object({}).passthrough()).optional().default([]),
    greenFlags: z.array(z.object({}).passthrough()).optional().default([]),
    toxicityScore: z.number().optional(),
    compatibilityScore: z.number().optional(),
    interviewQuestions: z.array(z.string()).optional().default([]),
});

// GET - List all applications for the user
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Get query params for filtering
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');

        // Build query
        let query = supabase
            .from('applications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) throw error;

        return NextResponse.json({
            success: true,
            data,
        });

    } catch (error) {
        console.error('[/api/applications] GET Error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch applications' },
            { status: 500 }
        );
    }
}

// POST - Create a new application
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Parse and validate request body
        const body = await request.json();
        const validatedData = CreateApplicationSchema.parse(body);

        // Insert application
        const { data, error } = await supabase
            .from('applications')
            .insert({
                user_id: user.id,
                job_url: validatedData.jobUrl,
                job_title: validatedData.jobTitle,
                company_name: validatedData.companyName,
                location: validatedData.location,
                platform: validatedData.platform,
                job_data: validatedData.jobData,
                analysis_result: validatedData.analysisResult,
                resume_snapshot: validatedData.resumeSnapshot,
                red_flags: validatedData.redFlags,
                green_flags: validatedData.greenFlags,
                toxicity_score: validatedData.toxicityScore,
                compatibility_score: validatedData.compatibilityScore,
                interview_questions: validatedData.interviewQuestions,
                status: 'applied',
                applied_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({
            success: true,
            data,
        });

    } catch (error) {
        console.error('[/api/applications] POST Error:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { success: false, error: 'Invalid request data', details: error.errors },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { success: false, error: 'Failed to create application' },
            { status: 500 }
        );
    }
}

// Handle CORS preflight
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
