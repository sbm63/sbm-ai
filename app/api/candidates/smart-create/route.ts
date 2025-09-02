import { NextRequest, NextResponse } from 'next/server';
import { db } from '@vercel/postgres';
import { Buffer } from 'buffer';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: NextRequest) {
  console.log('🚀 Smart create API called');
  
  try {
    const formData = await req.formData();
    const resumeFile = formData.get('resume');
    
    if (!(resumeFile instanceof File)) {
      return NextResponse.json(
        { error: 'Resume file is required' },
        { status: 400 }
      );
    }
    
    console.log('📄 File received:', {
      name: resumeFile.name,
      size: `${(resumeFile.size / 1024).toFixed(1)}KB`,
      type: resumeFile.type
    });
    
    // Convert file to base64 for AI analysis
    const buffer = Buffer.from(await resumeFile.arrayBuffer());
    const base64Data = buffer.toString('base64');
    
    console.log('📄 File converted to base64, size:', buffer.length, 'bytes');
    
    // Extract candidate info using AI with vision
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: `You are an expert at analyzing resumes. Extract candidate information from the provided PDF document.
          
          Return ONLY valid JSON with this exact structure:
          {
            "firstName": "first name from resume",
            "lastName": "last name from resume", 
            "email": "email address from resume",
            "phone": "phone number from resume"
          }
          
          IMPORTANT:
          - firstName, lastName, and email are REQUIRED and must not be empty
          - If phone is not found, use empty string
          - Look carefully for contact information in headers, footers, and contact sections
          - Be precise with name extraction (avoid titles like Mr., Dr., etc.)`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Please analyze this resume PDF and extract the candidate information:'
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:application/pdf;base64,${base64Data}`
              }
            }
          ]
        }
      ],
      response_format: { type: 'json_object' }
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    console.log('🤖 AI response:', raw);
    const candidateInfo = JSON.parse(raw);
    
    if (!candidateInfo.firstName || !candidateInfo.lastName || !candidateInfo.email) {
      console.log('❌ Missing fields:', candidateInfo);
      return NextResponse.json(
        { 
          error: 'Could not extract required information',
          aiResponse: candidateInfo,
          hint: 'Make sure the PDF contains clear contact information'
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
        ${buffer.toString('base64')},
        ${resumeFile.name}
      )
      RETURNING id, first_name AS "firstName", last_name AS "lastName", email, phone;
    `;

    console.log('✅ Candidate created:', rows[0]);
    
    return NextResponse.json({
      success: true,
      message: 'Candidate created successfully',
      candidate: rows[0],
      extractedInfo: candidateInfo
    });
    
  } catch (err: any) {
    console.error('💥 Error:', err);
    return NextResponse.json(
      { error: 'Failed to create candidate', details: err.message },
      { status: 500 }
    );
  }
}