// app/api/start-interview/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@vercel/postgres';
import pdfParse from 'pdf-parse';
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

    const { resume: resumeBase64 } = rows[0];

    // Decode & parse PDF to plain text
    let resumeText = '';
    try {
      const buf = Buffer.from(resumeBase64, 'base64');
      
      // Check if it's a PDF or text file
      const isPDF = buf.slice(0, 4).toString() === '%PDF';
      
      if (isPDF) {
        const pdfData = await pdfParse(buf);
        resumeText = pdfData.text;
      } else {
        // If it's stored as text (from text-create API)
        resumeText = buf.toString('utf8');
      }
      
      console.log('📄 Resume text length:', resumeText.length);
      console.log('📄 First 300 chars:', resumeText.substring(0, 300));
      
    } catch (parseError) {
      console.error('❌ Failed to parse resume:', parseError);
      return NextResponse.json(
        { error: 'Failed to parse resume file' },
        { status: 500 }
      );
    }

    if (!resumeText.trim()) {
      return NextResponse.json(
        { error: 'Resume content is empty or could not be extracted' },
        { status: 400 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `You are an expert resume reviewer and career advisor. Analyze the resume and provide detailed feedback.
          
          Return ONLY valid JSON with this structure:
          {
            "summary": "Brief 2-3 sentence summary of the candidate's profile and experience level",
            "strengths": ["List of 3-5 key strengths based on the resume"],
            "weaknesses": ["List of 2-4 areas for improvement or missing elements"],
            "recommendation": "Overall recommendation for hiring potential with specific reasoning",
            "experienceLevel": "junior|mid-level|senior",
            "keySkills": ["List of technical and soft skills identified"]
          }`,
        },
        { 
          role: 'user', 
          content: `Please analyze this resume and provide comprehensive feedback:\n\n${resumeText.substring(0, 6000)}` 
        },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    console.log('🤖 AI feedback response:', raw);
    
    let feedback;
    try {
      feedback = JSON.parse(raw);
    } catch (jsonError) {
      console.error('❌ Failed to parse AI response:', jsonError);
      return NextResponse.json(
        { error: 'Failed to parse AI feedback response' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ 
      success: true,
      feedback,
      resumeLength: resumeText.length 
    });

  } catch (err: any) {
    console.error('[RESUME_VALIDATION_ERROR]', err);
    return NextResponse.json(
      { error: 'Failed to validate resume', details: err.message },
      { status: 500 },
    );
  }
}
