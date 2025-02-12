import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { openai, MODEL } from '@/lib/openai/client';
import { TAILOR_SYSTEM_PROMPT, buildTailorPrompt } from '@/lib/openai/prompts';

// Local type for tailor result
interface TailorResult {
    summary: string;
    bullets: { original: string; tailored: string; reasoning: string }[];
    keywordsAdded: string[];
    fullResume?: string;
}

// Request validation schema
const TailorRequestSchema = z.object({
    jobData: z.object({
        title: z.string(),
        company: z.string(),
        description: z.string(),
    }).passthrough(),
    resume: z.string().min(1, 'Resume is required'),
    keywords: z.array(z.string()).optional().default([]),
});

export async function POST(request: NextRequest) {
    try {
        // Parse and validate request body
        const body = await request.json();
        const { jobData, resume, keywords } = TailorRequestSchema.parse(body);

        // Build prompt
        const userPrompt = buildTailorPrompt(jobData, resume, keywords);

        // Call OpenAI
        const completion = await openai.chat.completions.create({
            model: MODEL,
            messages: [
                { role: 'system', content: TAILOR_SYSTEM_PROMPT },
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

        const tailorResult = JSON.parse(content) as Omit<TailorResult, 'fullResume'>;

        // Generate full resume with changes applied
        let fullResume = resume;

        // Apply bullet changes
        for (const bullet of tailorResult.bullets) {
            fullResume = fullResume.replace(bullet.original, bullet.tailored);
        }

        // Return result
        return NextResponse.json({
            success: true,
            data: {
                ...tailorResult,
                fullResume,
            },
        });

    } catch (error) {
        console.error('[/api/tailor] Error:', error);

        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { success: false, error: 'Invalid request data', details: error.errors },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { success: false, error: 'Resume tailoring failed' },
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
