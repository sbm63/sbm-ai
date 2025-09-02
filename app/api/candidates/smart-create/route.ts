import { NextRequest, NextResponse } from 'next/server';
import { db } from '@vercel/postgres';
import { Buffer } from 'buffer';
import OpenAI from 'openai';
import pdfParse from 'pdf-parse';

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
    
    // Extract text using pdf-parse
    const buffer = Buffer.from(await resumeFile.arrayBuffer());
    const data = await pdfParse(buffer);
    
    console.log('📄 Extracted text length:', data.text.length);
    console.log('📄 First 500 chars:', data.text.substring(0, 500));
    
    // Extract candidate info using AI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: `Extract candidate information from resume text. Return JSON:
          {
            "firstName": "first name",
            "lastName": "last name", 
            "email": "email address",
            "phone": "phone number"
          }
          REQUIRED: firstName, lastName, and email must not be empty.`
        },
        {
          role: 'user',
          content: `Extract from this resume:\n\n${data.text.substring(0, 8000)}`
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
          extractedText: data.text.substring(0, 1000),
          aiResponse: candidateInfo
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