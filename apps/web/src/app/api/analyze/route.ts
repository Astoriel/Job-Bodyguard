import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { openai, MODEL } from '@/lib/openai/client';
import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisPrompt } from '@/lib/openai/prompts';

// Local types for job data and analysis result
interface JobData {
    title: string;
    company: string;
    location: string;
    description: string;
    requirements: string[];
    datePosted: string | null;
    validThrough: string | null;
    jobAge: number | null;
    visibleSalary: string | null;
    hiddenSalary: { min: number | null; max: number | null; currency: string; period: 'YEAR' | 'MONTH' | 'HOUR' } | null;
    salaryMismatch: boolean;
    redFlags: { keyword: string; context: string; severity: string; category: string }[];
    greenFlags: { keyword: string; context: string; severity: string; category: string }[];
    url: string;
    platform: 'linkedin' | 'indeed' | 'other';
    scrapedAt: string;
}

interface AnalysisResult {
    roast: string;
    toxicityScore: number;
    compatibilityScore: number;
    redFlags: { flag: string; explanation: string; severity: string }[];
    greenFlags: { flag: string; explanation: string }[];
    gapAnalysis: { missingSkills: string[]; suggestions: string[] };
    interviewQuestions: string[];
    verdict: string;
    verdictText: string;
}

// Request validation schema
const AnalyzeRequestSchema = z.object({
    jobData: z.object({
        title: z.string(),
        company: z.string(),
        location: z.string(),
        description: z.string(),
        requirements: z.array(z.string()),
        datePosted: z.string().nullable(),
        validThrough: z.string().nullable(),
        jobAge: z.number().nullable(),
        visibleSalary: z.string().nullable(),
        hiddenSalary: z.object({
            min: z.number().nullable(),
            max: z.number().nullable(),
            currency: z.string(),
            period: z.enum(['YEAR', 'MONTH', 'HOUR']),
        }).nullable(),
        salaryMismatch: z.boolean(),
        redFlags: z.array(z.object({
            keyword: z.string(),
            context: z.string(),
            severity: z.enum(['low', 'medium', 'high', 'critical']),
            category: z.string(),
        })),
        greenFlags: z.array(z.object({
            keyword: z.string(),
            context: z.string(),
            severity: z.enum(['low', 'medium', 'high', 'critical']),
            category: z.string(),
        })),
        url: z.string(),
        platform: z.enum(['linkedin', 'indeed', 'other']),
        scrapedAt: z.string(),
    }),
    resume: z.string().optional().default(''),
});

export async function POST(request: NextRequest) {
    try {
        // Parse and validate request body
        const body = await request.json();
        const { jobData, resume } = AnalyzeRequestSchema.parse(body);

        // Build prompt
        const userPrompt = buildAnalysisPrompt(jobData as unknown as Parameters<typeof buildAnalysisPrompt>[0], resume);

        // Call OpenAI
        const completion = await openai.chat.completions.create({
            model: MODEL,
            messages: [
                { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
                { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.7,
            max_tokens: 2000,
        });

        // Parse response
        const content = completion.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response from OpenAI');
        }

        const analysis: AnalysisResult = JSON.parse(content);

        // Return result
        return NextResponse.json({
            success: true,
            data: analysis,
        });

    } catch (error) {
        console.error('[/api/analyze] Error:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { success: false, error: 'Invalid request data', details: error.errors },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { success: false, error: 'Analysis failed' },
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
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
