// app/api/start-interview/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@vercel/postgres';
import OpenAI from 'openai';
import { Buffer } from 'buffer';
import { executeWithRetry } from '@/lib/db-retry';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    console.log('🔍 Starting resume validation for candidate:', params.id);

    // Get job profile ID from query parameters
    const { searchParams } = new URL(req.url);
    const profileId = searchParams.get('profileId');
    
    if (!profileId) {
      return NextResponse.json(
        { error: 'Job profile ID is required' },
        { status: 400 },
      );
    }

    // Fetch both candidate and job profile data
    console.log('Fetching candidate and job profile data...');
    const [candidateResult, jobResult] = await Promise.all([
      executeWithRetry(
        () =>
          db.sql`
          SELECT
            resume,
            resume_file_name AS "resumeFileName",
            created_at       AS "createdAt"
          FROM candidates
          WHERE id = ${params.id};
        `,
      ),
      executeWithRetry(
        () =>
          db.sql`
          SELECT
            id,
            title,
            department,
            location,
            type,
            salary,
            description
          FROM jobs
          WHERE id = ${profileId};
        `,
      ),
    ]);

    const { rows } = candidateResult;

    console.log('✅ Candidate query completed, found:', rows.length, 'records');
    console.log('✅ Job profile query completed, found:', jobResult.rows.length, 'records');

    if (rows.length === 0) {
      console.log('❌ No candidate found with ID:', params.id);
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 },
      );
    }

    if (jobResult.rows.length === 0) {
      console.log('❌ No job profile found with ID:', profileId);
      return NextResponse.json(
        { error: 'Job profile not found' },
        { status: 404 },
      );
    }

    const { resume: resumeBase64, resumeFileName } = rows[0];
    const jobProfile = jobResult.rows[0];
    console.log('📄 Resume data found:', {
      fileName: resumeFileName,
      hasData: !!resumeBase64,
    });

    // Convert resume to base64 for AI analysis
    let resumeAnalysis;
    try {
      const buffer = Buffer.from(resumeBase64, 'base64');

      // Check if it's a PDF or text file
      const isPDF = buffer.slice(0, 4).toString() === '%PDF';

      console.log('📄 Analyzing resume:', {
        fileName: resumeFileName,
        isPDF,
        size: `${(buffer.length / 1024).toFixed(1)}KB`,
      });

      if (isPDF) {
        // Use OpenAI's native PDF processing with Files API (2025 feature)
        console.log('📄 Processing PDF using OpenAI native PDF support...');

        try {
          // Upload PDF file to OpenAI
          console.log('📤 Uploading PDF to OpenAI Files API...');
          const file = await openai.files.create({
            file: new File([buffer], resumeFileName, {
              type: 'application/pdf',
            }),
            purpose: 'assistants',
          });

          console.log('✅ File uploaded successfully:', file.id);

          // Process the PDF using GPT-4o with native PDF support
          const completion = await openai.chat.completions.create({
            model: 'gpt-4o', // Use gpt-4o for PDF support
            temperature: 0.3,
            messages: [
              {
                role: 'system',
                content: `You are an expert resume reviewer and career advisor. Analyze the PDF resume document and provide detailed feedback specifically for the given job position.

Job Position Details:
- Title: ${jobProfile.title}
- Department: ${jobProfile.department}
- Location: ${jobProfile.location}
- Employment Type: ${jobProfile.type}
- Salary Range: ${jobProfile.salary}
- Description: ${jobProfile.description || 'Not provided'}

Return ONLY valid JSON with this structure:
{
  "summary": "Brief 2-3 sentence summary of the candidate's profile and how well they match the ${jobProfile.title} position",
  "strengths": ["List of 3-5 key strengths that are relevant to the ${jobProfile.title} role"],
  "weaknesses": ["List of 2-4 areas where the candidate may not fully match the ${jobProfile.title} requirements or areas for improvement"],
  "recommendation": "Overall recommendation for hiring potential for the ${jobProfile.title} position with specific reasoning",
  "experienceLevel": "junior|mid-level|senior",
  "keySkills": ["List of technical and soft skills relevant to ${jobProfile.title} and ${jobProfile.department}"],
  "roleMatch": "poor|fair|good|excellent - how well the candidate matches the job requirements"
}`,
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `Please analyze this resume PDF (${resumeFileName}) specifically for the ${jobProfile.title} position in ${jobProfile.department}. Evaluate how well the candidate's background, skills, and experience align with this role:`,
                  },
                  {
                    type: 'file',
                    file: {
                      file_id: file.id,
                    },
                  },
                ],
              },
            ],
            response_format: { type: 'json_object' },
          });

          // Clean up the uploaded file
          try {
            await openai.files.delete(file.id);
            console.log('🗑️ Temporary file cleaned up');
          } catch (cleanupError) {
            console.warn('⚠️ Failed to cleanup temporary file:', cleanupError);
          }

          const raw = completion.choices[0]?.message?.content ?? '{}';
          resumeAnalysis = JSON.parse(raw);
        } catch (fileError: any) {
          console.warn(
            '⚠️ OpenAI Files API failed, falling back to text extraction:',
            fileError.message,
          );

          // Fallback to text extraction if Files API fails
          const pdfText = buffer
            .toString('utf8')
            .replace(/[^\x20-\x7E\n\r]/g, ' ')
            .trim();
          const words = pdfText.split(/\s+/).filter((word) => word.length > 2);
          const extractedText = words.slice(0, 1000).join(' ');

          const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            temperature: 0.3,
            messages: [
              {
                role: 'system',
                content: `You are an expert resume reviewer and career advisor. Analyze the resume content and provide detailed feedback specifically for the given job position.

Job Position Details:
- Title: ${jobProfile.title}
- Department: ${jobProfile.department}
- Location: ${jobProfile.location}
- Employment Type: ${jobProfile.type}
- Salary Range: ${jobProfile.salary}
- Description: ${jobProfile.description || 'Not provided'}

Return ONLY valid JSON with this structure:
{
  "summary": "Brief 2-3 sentence summary of the candidate's profile and how well they match the ${jobProfile.title} position",
  "strengths": ["List of 3-5 key strengths that are relevant to the ${jobProfile.title} role"],
  "weaknesses": ["List of 2-4 areas where the candidate may not fully match the ${jobProfile.title} requirements or areas for improvement"],
  "recommendation": "Overall recommendation for hiring potential for the ${jobProfile.title} position with specific reasoning",
  "experienceLevel": "junior|mid-level|senior",
  "keySkills": ["List of technical and soft skills relevant to ${jobProfile.title} and ${jobProfile.department}"],
  "roleMatch": "poor|fair|good|excellent - how well the candidate matches the job requirements"
}`,
              },
              {
                role: 'user',
                content: `Please analyze this resume content specifically for the ${jobProfile.title} position in ${jobProfile.department}. Evaluate how well the candidate's background, skills, and experience align with this role:

Resume filename: ${resumeFileName}
Job Position: ${jobProfile.title}
Department: ${jobProfile.department}

Extracted content: ${extractedText}`,
              },
            ],
            response_format: { type: 'json_object' },
          });

          const raw = completion.choices[0]?.message?.content ?? '{}';
          resumeAnalysis = JSON.parse(raw);
        }
      } else {
        // If it's stored as text (from text-create API)
        const resumeText = buffer.toString('utf8');

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0.3,
          messages: [
            {
              role: 'system',
              content: `You are an expert resume reviewer and career advisor. Analyze the resume text and provide detailed feedback specifically for the given job position.

Job Position Details:
- Title: ${jobProfile.title}
- Department: ${jobProfile.department}
- Location: ${jobProfile.location}
- Employment Type: ${jobProfile.type}
- Salary Range: ${jobProfile.salary}
- Description: ${jobProfile.description || 'Not provided'}

Return ONLY valid JSON with this structure:
{
  "summary": "Brief 2-3 sentence summary of the candidate's profile and how well they match the ${jobProfile.title} position",
  "strengths": ["List of 3-5 key strengths that are relevant to the ${jobProfile.title} role"],
  "weaknesses": ["List of 2-4 areas where the candidate may not fully match the ${jobProfile.title} requirements or areas for improvement"],
  "recommendation": "Overall recommendation for hiring potential for the ${jobProfile.title} position with specific reasoning",
  "experienceLevel": "junior|mid-level|senior",
  "keySkills": ["List of technical and soft skills relevant to ${jobProfile.title} and ${jobProfile.department}"],
  "roleMatch": "poor|fair|good|excellent - how well the candidate matches the job requirements"
}`,
            },
            {
              role: 'user',
              content: `Please analyze this resume specifically for the ${jobProfile.title} position in ${jobProfile.department}. Evaluate how well the candidate's background, skills, and experience align with this role:

Job Position: ${jobProfile.title}
Department: ${jobProfile.department}

Resume Content:
${resumeText.substring(0, 8000)}`,
            },
          ],
          response_format: { type: 'json_object' },
        });

        const raw = completion.choices[0]?.message?.content ?? '{}';
        resumeAnalysis = JSON.parse(raw);
      }
    } catch (analysisError: any) {
      console.error('❌ Failed to analyze resume:', analysisError);
      return NextResponse.json(
        {
          error: 'Failed to analyze resume',
          details: analysisError.message,
          suggestions: [
            'Make sure the resume is a valid PDF or text file',
            'Ensure the resume contains readable text',
            'Try uploading a different format',
          ],
        },
        { status: 400 },
      );
    }

    // Validate AI response
    if (!resumeAnalysis || !resumeAnalysis.summary) {
      return NextResponse.json(
        { error: 'Unable to generate meaningful analysis from resume' },
        { status: 400 },
      );
    }

    console.log('✅ Resume analysis completed:', resumeAnalysis.summary);

    return NextResponse.json({
      success: true,
      feedback: resumeAnalysis,
    });
  } catch (err: any) {
    console.error('[RESUME_VALIDATION_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to validate resume', details: err.message },
      { status: 500 },
    );
  }
}
