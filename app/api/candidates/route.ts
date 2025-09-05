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
        type: resumeFile.type,
      });

      // Test database connection with retries and ensure table exists
      let dbReady = false;
      let lastError = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`🔄 Database connection attempt ${attempt}/3...`);
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
          dbReady = true;
          break;
        } catch (dbError: any) {
          lastError = dbError;
          console.error(
            `❌ Database attempt ${attempt} failed:`,
            dbError.message,
          );

          if (attempt < 3) {
            console.log(`⏳ Waiting 2 seconds before retry...`);
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
      }

      if (!dbReady) {
        console.error('❌ All database connection attempts failed');
        return NextResponse.json(
          {
            error: 'Database connection failed after 3 attempts',
            details: lastError?.message,
            suggestions: [
              'Check if your database is active and not sleeping',
              'Verify your POSTGRES_URL environment variable is correct',
              'Ensure your database plan allows connections',
              'Try again in a few minutes if this is a temporary issue',
            ],
          },
          { status: 500 },
        );
      }

      // Convert PDF to buffer for processing
      const buffer = Buffer.from(await resumeFile.arrayBuffer());
      const resumeBase64 = buffer.toString('base64');

      // Check if it's a PDF
      const isPDF = buffer.slice(0, 4).toString() === '%PDF';

      console.log('📄 Processing file:', {
        fileName: resumeFile.name,
        isPDF,
        size: `${(buffer.length / 1024).toFixed(1)}KB`,
      });

      // Use OpenAI's native PDF processing (same as validation API)
      let candidateInfo;

      if (isPDF) {
        try {
          // Upload PDF file to OpenAI
          console.log('📤 Uploading PDF to OpenAI Files API...');
          const file = await openai.files.create({
            file: new File([buffer], resumeFile.name, {
              type: 'application/pdf',
            }),
            purpose: 'assistants',
          });

          console.log('✅ File uploaded successfully:', file.id);

          // Process the PDF using GPT-4o with native PDF support
          const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
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
                - Be precise with name extraction (avoid titles like Mr., Dr., etc.)`,
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `Please analyze this resume PDF (${resumeFile.name}) and extract the candidate information:`,
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
            await openai.files.del(file.id);
            console.log('🗑️ Temporary file cleaned up');
          } catch (cleanupError) {
            console.warn('⚠️ Failed to cleanup temporary file:', cleanupError);
          }

          const raw = completion.choices[0]?.message?.content ?? '{}';
          console.log('🤖 AI response:', raw);
          candidateInfo = JSON.parse(raw);
        } catch (fileError: any) {
          console.warn(
            '⚠️ OpenAI Files API failed, falling back to text extraction:',
            fileError.message,
          );

          // Fallback to simple text analysis if Files API fails
          const pdfText = buffer
            .toString('utf8')
            .replace(/[^\x20-\x7E\n\r]/g, ' ')
            .trim();
          const words = pdfText.split(/\s+/).filter((word) => word.length > 2);
          const extractedText = words.slice(0, 1000).join(' '); // Limit to prevent token issues

          const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            temperature: 0.1,
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

IMPORTANT: Only return the JSON object, no other text.`,
              },
              {
                role: 'user',
                content: `Resume filename: ${resumeFile.name}

Extracted text: "${extractedText}"

Extract the candidate's firstName, lastName, email, and phone number. If the extracted text is fragmented, try to infer information from patterns and the filename.`,
              },
            ],
            response_format: { type: 'json_object' },
          });

          const raw = completion.choices[0]?.message?.content ?? '{}';
          console.log('🤖 Fallback AI response:', raw);
          candidateInfo = JSON.parse(raw);
        }
      } else {
        // Handle non-PDF files (existing text processing logic)
        const resumeText = buffer.toString('utf8');

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0.1,
          messages: [
            {
              role: 'system',
              content: `You are an expert at analyzing resumes. Extract candidate information from the provided text document.
              
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
              - Look carefully for contact information`,
            },
            {
              role: 'user',
              content: `Please analyze this resume and extract the candidate information:\n\n${resumeText.substring(
                0,
                8000,
              )}`,
            },
          ],
          response_format: { type: 'json_object' },
        });

        const raw = completion.choices[0]?.message?.content ?? '{}';
        console.log('🤖 Text file AI response:', raw);
        candidateInfo = JSON.parse(raw);
      }

      if (
        !candidateInfo.firstName ||
        !candidateInfo.lastName ||
        !candidateInfo.email
      ) {
        console.log('❌ Missing required fields:', candidateInfo);
        return NextResponse.json(
          {
            error:
              'Could not extract required candidate information from resume. Please ensure the resume contains clear name and email information.',
            aiResponse: candidateInfo,
          },
          { status: 400 },
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
        extractedInfo: candidateInfo,
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
