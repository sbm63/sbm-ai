// app/api/start-interview/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@vercel/postgres';
import OpenAI from 'openai';
import { Buffer } from 'buffer';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // Fetch the candidate by ID
    const { rows } = await db.sql`
      SELECT
        resume,
        resume_file_name AS "resumeFileName",
        created_at       AS "createdAt"
      FROM candidates
      WHERE id = ${params.id};
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 },
      );
    }

    const { resume: resumeBase64, resumeFileName } = rows[0];

    // Convert resume to base64 for AI analysis
    let resumeAnalysis;
    try {
      const buffer = Buffer.from(resumeBase64, 'base64');
      
      // Check if it's a PDF or text file
      const isPDF = buffer.slice(0, 4).toString() === '%PDF';
      
      console.log('📄 Analyzing resume:', {
        fileName: resumeFileName,
        isPDF,
        size: `${(buffer.length / 1024).toFixed(1)}KB`
      });

      if (isPDF) {
        // Use AI to analyze PDF directly
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0.3,
          messages: [
            {
              role: 'system',
              content: `You are an expert resume reviewer and career advisor. Analyze the resume PDF and provide detailed feedback.
              
              Return ONLY valid JSON with this structure:
              {
                "summary": "Brief 2-3 sentence summary of the candidate's profile and experience level",
                "strengths": ["List of 3-5 key strengths based on the resume"],
                "weaknesses": ["List of 2-4 areas for improvement or missing elements"],
                "recommendation": "Overall recommendation for hiring potential with specific reasoning",
                "experienceLevel": "junior|mid-level|senior",
                "keySkills": ["List of technical and soft skills identified"]
              }`
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Please analyze this resume PDF and provide comprehensive feedback:'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:application/pdf;base64,${resumeBase64}`
                  }
                }
              ]
            }
          ],
          response_format: { type: 'json_object' }
        });

        const raw = completion.choices[0]?.message?.content ?? '{}';
        resumeAnalysis = JSON.parse(raw);
      } else {
        // If it's stored as text (from text-create API)
        const resumeText = buffer.toString('utf8');
        
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0.3,
          messages: [
            {
              role: 'system',
              content: `You are an expert resume reviewer and career advisor. Analyze the resume text and provide detailed feedback.
              
              Return ONLY valid JSON with this structure:
              {
                "summary": "Brief 2-3 sentence summary of the candidate's profile and experience level",
                "strengths": ["List of 3-5 key strengths based on the resume"],
                "weaknesses": ["List of 2-4 areas for improvement or missing elements"],
                "recommendation": "Overall recommendation for hiring potential with specific reasoning",
                "experienceLevel": "junior|mid-level|senior",
                "keySkills": ["List of technical and soft skills identified"]
              }`
            },
            { 
              role: 'user', 
              content: `Please analyze this resume and provide comprehensive feedback:\n\n${resumeText.substring(0, 8000)}` 
            }
          ],
          response_format: { type: 'json_object' }
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
            'Try uploading a different format'
          ]
        },
        { status: 400 }
      );
    }

    // Validate AI response
    if (!resumeAnalysis || !resumeAnalysis.summary) {
      return NextResponse.json(
        { error: 'Unable to generate meaningful analysis from resume' },
        { status: 400 }
      );
    }

    console.log('✅ Resume analysis completed:', resumeAnalysis.summary);

    return NextResponse.json({ 
      success: true,
      feedback: resumeAnalysis
    });

  } catch (err: any) {
    console.error('[RESUME_VALIDATION_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to validate resume', details: err.message },
      { status: 500 },
    );
  }
}