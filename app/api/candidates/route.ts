// app/api/candidates/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@vercel/postgres';
import { Buffer } from 'buffer';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// GET /api/candidates → list all
export async function GET() {
  try {
    // create table if needed (optional once created)
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

    const { rows: candidates } = await db.sql`
      SELECT
        id,
        first_name       AS "firstName",
        last_name        AS "lastName",
        email,
        phone,
        resume_file_name AS "resumeFileName",
        resume           AS "resumeBase64",
        created_at       AS "createdAt"
      FROM candidates;
    `;

    return NextResponse.json({ candidates });
  } catch (err) {
    console.error('[GET_CANDIDATES]', err);
    return NextResponse.json(
      { error: 'Failed to fetch candidates' },
      { status: 500 },
    );
  }
}

// POST /api/candidates → create one (multipart/form-data)
export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const isSmartCreate = url.searchParams.get('smart') === 'true';
    
    const formData = await req.formData();
    const resumeFile = formData.get('resume');

    if (!(resumeFile instanceof File)) {
      return NextResponse.json(
        { error: 'Resume file is required' },
        { status: 400 },
      );
    }

    if (isSmartCreate) {
      console.log('🚀 Smart candidate creation started...');
      console.log('📄 File received:', {
        name: resumeFile.name,
        size: `${(resumeFile.size / 1024).toFixed(1)}KB`,
        type: resumeFile.type
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

      // Convert to buffer and extract text
      const buffer = Buffer.from(await resumeFile.arrayBuffer());
      const resumeBase64 = buffer.toString('base64');
      
      // Simple text extraction from PDF
      const pdfString = buffer.toString('latin1');
      const textRegex = /\((.*?)\)/g;
      let extractedText = '';
      let match;
      
      while ((match = textRegex.exec(pdfString)) !== null) {
        const text = match[1];
        if (text && text.length > 1 && /[a-zA-Z@]/.test(text)) {
          extractedText += text + ' ';
        }
      }
      
      extractedText = extractedText.replace(/\s+/g, ' ').trim();
      
      console.log('📄 Extracted text length:', extractedText.length);
      console.log('📄 First 500 chars:', extractedText.substring(0, 500));
      
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
            content: `Extract from this resume:\n\n${extractedText.substring(0, 8000)}`
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
            extractedText: extractedText.substring(0, 1000),
            aiResponse: candidateInfo
          },
          { status: 400 }
        );
      }
      
      // Create candidate with extracted info
      const { rows } = await db.sql`
        INSERT INTO candidates (
          first_name, last_name, email, phone, resume, resume_file_name
        ) VALUES (
          ${candidateInfo.firstName.trim()},
          ${candidateInfo.lastName.trim()},
          ${candidateInfo.email.toLowerCase().trim()},
          ${candidateInfo.phone?.trim() || ''},
          ${resumeBase64},
          ${resumeFile.name}
        )
        RETURNING id, first_name AS "firstName", last_name AS "lastName", email, phone;
      `;

      console.log('✅ Smart candidate created:', rows[0]);
      
      return NextResponse.json({
        success: true,
        message: 'Candidate created successfully from resume',
        candidate: rows[0],
        extractedInfo: candidateInfo
      });
    }

    // Regular manual creation
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const email = formData.get('email') as string;
    const phone = (formData.get('phone') as string) || '';

    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: 'firstName, lastName, email and a file are required' },
        { status: 400 },
      );
    }

    // convert file to base64
    const buffer = Buffer.from(await resumeFile.arrayBuffer());
    const resumeBase64 = buffer.toString('base64');
    const resumeName = resumeFile.name;

    const { rows } = await db.sql`
      INSERT INTO candidates (
        first_name, last_name, email, phone, resume, resume_file_name
      ) VALUES (
        ${firstName},
        ${lastName},
        ${email},
        ${phone},
        ${resumeBase64},
        ${resumeName}
      )
      RETURNING
        id,
        first_name       AS "firstName",
        last_name        AS "lastName",
        email,
        phone,
        resume           AS "resumeBase64",
        resume_file_name AS "resumeFileName",
        created_at       AS "createdAt";
    `;

    return NextResponse.json({ success: true, candidate: rows[0] });
  } catch (err: any) {
    console.error('[CREATE_CANDIDATE]', err);
    return NextResponse.json(
      { error: 'Failed to create candidate', details: err.message },
      { status: 500 },
    );
  }
}
