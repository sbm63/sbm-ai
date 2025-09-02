import { NextRequest, NextResponse } from 'next/server';
import { db } from '@vercel/postgres';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: NextRequest) {
  console.log('🚀 Text-based candidate creation started');
  
  try {
    const { resumeText } = await req.json();
    
    if (!resumeText || typeof resumeText !== 'string' || !resumeText.trim()) {
      return NextResponse.json(
        { error: 'Resume text is required' },
        { status: 400 }
      );
    }
    
    console.log('📄 Resume text received:', {
      length: resumeText.length,
      preview: resumeText.substring(0, 200) + '...'
    });
    
    // Test database connection and ensure table exists
    try {
      await db.sql`SELECT 1 as test`;
      console.log('✅ Database connection successful');
      
      // Create table if it doesn't exist
      await db.sql`
        CREATE TABLE IF NOT EXISTS candidates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          first_name TEXT NOT NULL,
          last_name  TEXT NOT NULL,
          email      TEXT NOT NULL,
          phone      TEXT,
          resume     TEXT NOT NULL,
          resume_file_name TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT now()
        );
      `;
      console.log('✅ Candidates table ready');
    } catch (dbError: any) {
      console.error('❌ Database setup failed:', dbError.message);
      return NextResponse.json(
        { error: 'Database setup failed', details: dbError.message },
        { status: 500 }
      );
    }
    
    // Extract candidate info using AI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: `Extract candidate information from resume text. Return JSON with this exact structure:
          {
            "firstName": "first name",
            "lastName": "last name", 
            "email": "email address",
            "phone": "phone number (include if found, empty string if not)"
          }
          REQUIREMENTS:
          - firstName, lastName, and email must not be empty
          - If no phone number is found, return empty string
          - Return only valid email addresses
          - Names should be properly capitalized`
        },
        {
          role: 'user',
          content: `Extract information from this resume:\n\n${resumeText.substring(0, 8000)}`
        }
      ],
      response_format: { type: 'json_object' }
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    console.log('🤖 AI response:', raw);
    
    let candidateInfo;
    try {
      candidateInfo = JSON.parse(raw);
    } catch (parseError) {
      console.error('❌ Failed to parse AI response:', parseError);
      return NextResponse.json(
        { error: 'Failed to parse AI response', aiResponse: raw },
        { status: 500 }
      );
    }
    
    // Validate extracted information
    if (!candidateInfo.firstName || !candidateInfo.lastName || !candidateInfo.email) {
      console.log('❌ Missing required fields:', candidateInfo);
      return NextResponse.json(
        { 
          error: 'Could not extract required information (firstName, lastName, email)',
          extractedInfo: candidateInfo,
          resumePreview: resumeText.substring(0, 500)
        },
        { status: 400 }
      );
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(candidateInfo.email)) {
      console.log('❌ Invalid email format:', candidateInfo.email);
      return NextResponse.json(
        { 
          error: 'Invalid email address extracted',
          extractedInfo: candidateInfo
        },
        { status: 400 }
      );
    }
    
    // Create candidate in database
    const { rows } = await db.sql`
      INSERT INTO candidates (
        first_name, last_name, email, phone, resume, resume_file_name
      ) VALUES (
        ${candidateInfo.firstName.trim()},
        ${candidateInfo.lastName.trim()},
        ${candidateInfo.email.toLowerCase().trim()},
        ${candidateInfo.phone?.trim() || ''},
        ${Buffer.from(resumeText).toString('base64')},
        ${'resume-text-' + Date.now() + '.txt'}
      )
      RETURNING id, first_name AS "firstName", last_name AS "lastName", email, phone;
    `;

    console.log('✅ Candidate created:', rows[0]);
    
    return NextResponse.json({
      success: true,
      message: 'Candidate created successfully from resume text',
      candidate: rows[0],
      extractedInfo: candidateInfo
    });
    
  } catch (err: any) {
    console.error('💥 Error creating candidate:', err);
    return NextResponse.json(
      { error: 'Failed to create candidate', details: err.message },
      { status: 500 }
    );
  }
}