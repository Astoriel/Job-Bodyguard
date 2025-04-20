import { NextRequest, NextResponse } from 'next/server';

interface SavedJob {
    id: string;
    title: string;
    company: string;
    location: string;
    url: string;
    savedAt: string;
    status: 'saved' | 'applied' | 'interview' | 'rejected' | 'offer';
    platform: string;
}

// In-memory storage (would be replaced with database in production)
let savedJobs: SavedJob[] = [];

// GET - List all saved jobs
export async function GET() {
    return NextResponse.json({
        success: true,
        data: savedJobs,
    });
}

// POST - Save a new job or sync jobs from extension
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Handle bulk sync from extension
        if (Array.isArray(body)) {
            savedJobs = body;
            return NextResponse.json({
                success: true,
                data: savedJobs,
                message: 'Jobs synced',
            });
        }

        // Handle single job save
        const job = body as SavedJob;

        // Check if job already exists
        const existingIndex = savedJobs.findIndex(j => j.url === job.url);

        if (existingIndex >= 0) {
            savedJobs[existingIndex] = job;
        } else {
            savedJobs.unshift(job);
        }

        return NextResponse.json({
            success: true,
            data: job,
            message: 'Job saved',
        });
    } catch (error) {
        console.error('[/api/jobs] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to save job' },
            { status: 500 }
        );
    }
}

// DELETE - Remove a job
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const jobId = searchParams.get('id');

        if (!jobId) {
            return NextResponse.json(
                { success: false, error: 'Job ID required' },
                { status: 400 }
            );
        }

        savedJobs = savedJobs.filter(j => j.id !== jobId);

        return NextResponse.json({
            success: true,
            message: 'Job deleted',
        });
    } catch (error) {
        console.error('[/api/jobs] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to delete job' },
            { status: 500 }
        );
    }
}

// Handle CORS
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
