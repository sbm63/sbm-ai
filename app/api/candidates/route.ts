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

      // Convert PDF to buffer and try different text extraction approaches
      const buffer = Buffer.from(await resumeFile.arrayBuffer());
      const resumeBase64 = buffer.toString('base64');
      
      console.log('📄 Attempting advanced PDF text extraction');
      
      // Try multiple encoding approaches to extract text
      let extractedText = '';
      
      // Method 1: Try UTF-8 extraction
      try {
        const utf8String = buffer.toString('utf8');
        const utf8Matches = utf8String.match(/[a-zA-Z0-9@._-]+/g);
        if (utf8Matches) {
          extractedText += utf8Matches.join(' ') + ' ';
        }
      } catch (e) {
        console.log('UTF-8 extraction failed');
      }
      
      // Method 2: ASCII extraction with better filtering
      const asciiString = buffer.toString('ascii');
      const readableChars = asciiString.match(/[a-zA-Z0-9@._\-\s]{2,}/g);
      if (readableChars) {
        extractedText += readableChars.join(' ') + ' ';
      }
      
      // Method 3: Look for specific patterns in binary data
      const binaryString = buffer.toString('binary');
      
      // Extract email patterns
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const emails = binaryString.match(emailRegex);
      if (emails) {
        extractedText += emails.join(' ') + ' ';
      }
      
      // Extract phone patterns
      const phoneRegex = /[\+]?[1-9]?[\d\s\-\(\)]{7,15}/g;
      const phones = binaryString.match(phoneRegex);
      if (phones) {
        extractedText += phones.filter(p => /\d{3,}/.test(p)).join(' ') + ' ';
      }
      
      // Method 4: Extract words from PDF objects
      const wordRegex = /\b[A-Za-z]{2,}\b/g;
      const words = binaryString.match(wordRegex);
      if (words) {
        // Filter meaningful words (not PDF commands)
        const meaningfulWords = words.filter(word => 
          word.length > 2 && 
          word.length < 50 && 
          !/^(obj|endobj|stream|endstream|xref|trailer|startxref|PDF)$/i.test(word)
        );
        extractedText += meaningfulWords.slice(0, 100).join(' ') + ' ';
      }
      
      // Clean and normalize text
      extractedText = extractedText
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s@._-]/g, ' ')
        .trim();
      
      console.log('📄 Extracted text length:', extractedText.length);
      console.log('📄 Sample extracted text:', extractedText.substring(0, 500));
      
      // Check if extraction was successful enough
      const hasEmail = /@/.test(extractedText);
      const hasWords = extractedText.split(' ').filter(w => w.length > 2).length > 5;
      
      if (!hasEmail && !hasWords) {
        console.log('❌ Text extraction failed, falling back to manual entry mode');
        return NextResponse.json(
          { 
            error: 'Unable to automatically extract information from this PDF. Please use the manual "Create Candidate" option instead.',
            suggestion: 'The PDF format is not compatible with automatic extraction. You can manually create the candidate by going to "New Candidate" and entering the information yourself.',
            fileName: resumeFile.name
          },
          { status: 400 }
        );
      }
      
      // Use OpenAI with enhanced prompting for better extraction
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 1000,
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: `You are an expert resume parser. Extract candidate information from the provided text that was extracted from a PDF resume.

EXTRACTION GUIDELINES:
1. Names: Look for capitalized words that could be first/last names, often at the beginning
2. Emails: Look for patterns with @ symbol and domain extensions
3. Phones: Look for digit sequences that could be phone numbers
4. Be flexible with fragmented text - piece together information intelligently
5. If filename contains a name (like "resume_john_doe.pdf"), use it as backup

Return JSON format:
{
  "firstName": "first name or empty string",
  "lastName": "last name or empty string", 
  "email": "email address or empty string",
  "phone": "phone number or empty string"
}

IMPORTANT: Only return the JSON object, no other text.`
          },
          {
            role: 'user',
            content: `Resume filename: ${resumeFile.name}

Extracted text: "${extractedText}"

Extract the candidate's firstName, lastName, email, and phone number. If the extracted text is fragmented, try to infer information from patterns and the filename.`
          }
        ],
        response_format: { type: 'json_object' }
      });

      const raw = completion.choices[0]?.message?.content ?? '{}';
      console.log('🤖 AI response:', raw);
      const candidateInfo = JSON.parse(raw);
      
      if (!candidateInfo.firstName || !candidateInfo.lastName || !candidateInfo.email) {
        console.log('❌ Missing required fields:', candidateInfo);
        return NextResponse.json(
          { 
            error: 'Could not extract required candidate information from resume. Please ensure the resume contains clear name and email information.',
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
