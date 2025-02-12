/**
 * Local type for job data used in prompts
 */
interface JobData {
  title: string;
  company: string;
  location: string;
  description: string;
  jobAge: number | null;
  hiddenSalary: { min: number | null; max: number | null; currency: string; period: string } | null;
  salaryMismatch: boolean;
  redFlags: { keyword: string; context: string }[];
  greenFlags: { keyword: string; context: string }[];
}

/**
 * System prompt for job analysis
 */
export const ANALYSIS_SYSTEM_PROMPT = `You are "Job Decoder" — a sarcastic but insightful career advisor who can:
1. Decode corporate bullshit in job postings
2. Identify red flags that indicate toxic workplace culture
3. Assess candidate-job compatibility based on their resume
4. Suggest resume improvements

Your personality:
- Sarcastically witty but genuinely helpful
- Direct and honest about red flags
- Supportive of the job seeker
- Uses humor to make job hunting less stressful

IMPORTANT: Always respond with valid JSON matching the specified schema. Do not include any text outside the JSON.`;

/**
 * Build the user prompt for analysis
 */
export function buildAnalysisPrompt(jobData: JobData, resume: string): string {
  const hiddenSalary = jobData.hiddenSalary
    ? `$${jobData.hiddenSalary.min?.toLocaleString() || '?'} - $${jobData.hiddenSalary.max?.toLocaleString() || '?'} per ${jobData.hiddenSalary.period.toLowerCase()}`
    : 'Not disclosed';

  return `## JOB POSTING DATA

**Title:** ${jobData.title}
**Company:** ${jobData.company}
**Location:** ${jobData.location}
**Posted:** ${jobData.jobAge !== null ? `${jobData.jobAge} days ago` : 'Unknown'}
**Hidden Salary:** ${hiddenSalary}
**Salary Mismatch:** ${jobData.salaryMismatch ? 'YES - salary hidden from visible text' : 'No'}

**Description:**
${jobData.description.substring(0, 3000)}

**Pre-detected Red Flags:**
${jobData.redFlags.map(f => `- ${f.keyword}: "${f.context.substring(0, 100)}"`).join('\n') || 'None detected'}

**Pre-detected Green Flags:**
${jobData.greenFlags.map(f => `- ${f.keyword}: "${f.context.substring(0, 100)}"`).join('\n') || 'None detected'}

---

## CANDIDATE RESUME

${resume || 'No resume provided'}

---

## YOUR TASK

Analyze this job posting and provide a JSON response with:
{
  "roast": "A sarcastic 2-3 sentence 'translation' of what the job posting really means",
  "toxicityScore": 0-100 (0 = dream job, 100 = run away),
  "compatibilityScore": 0-100 (based on resume match, 50 if no resume),
  "redFlags": [
    { "flag": "Brief title", "explanation": "Why this is concerning", "severity": "low|medium|high|critical" }
  ],
  "greenFlags": [
    { "flag": "Brief title", "explanation": "Why this is positive" }
  ],
  "gapAnalysis": {
    "missingSkills": ["skill1", "skill2"],
    "suggestions": ["Specific action to improve resume"]
  },
  "interviewQuestions": ["Question 1 to ask recruiter", "Question 2", "Question 3"],
  "verdict": "strong_apply|apply|caution|skip",
  "verdictText": "One-line recommendation"
}`;
}

/**
 * System prompt for resume tailoring
 */
export const TAILOR_SYSTEM_PROMPT = `You are a professional resume writer. Your task is to tailor a resume for a specific job posting.

STRICT RULES:
1. NEVER invent experience or skills the candidate doesn't have
2. Only reword and reorganize existing content
3. Integrate keywords from the job posting naturally
4. Improve bullet points using the STAR method (Situation, Task, Action, Result)
5. Optimize the Professional Summary for this specific role
6. Preserve the candidate's authentic voice

Respond ONLY with valid JSON.`;

/**
 * Local type for tailor prompt job data
 */
interface TailorJobData {
  title: string;
  company: string;
  description: string;
}

/**
 * Build the user prompt for resume tailoring
 */
export function buildTailorPrompt(jobData: TailorJobData, resume: string, keywords: string[]): string {
  return `## TARGET JOB

**Title:** ${jobData.title}
**Company:** ${jobData.company}

**Key Requirements:**
${jobData.description.substring(0, 2000)}

**Keywords to integrate:** ${keywords.join(', ')}

---

## CURRENT RESUME

${resume}

---

## YOUR TASK

Tailor the resume for this job. Provide JSON:
{
  "summary": "New professional summary (2-3 sentences)",
  "bullets": [
    {
      "original": "Original bullet from resume",
      "tailored": "Improved version with relevant keywords",
      "reasoning": "Brief explanation of why this helps"
    }
  ],
  "keywordsAdded": ["keyword1", "keyword2"]
}

Only include bullets that actually need changes. Max 5 bullets.`;
}
