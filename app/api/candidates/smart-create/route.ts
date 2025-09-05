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
        { status: 400 },
      );
    }

    console.log('📄 File received:', {
      name: resumeFile.name,
      size: `${(resumeFile.size / 1024).toFixed(1)}KB`,
      type: resumeFile.type,
    });

    // Convert file to buffer for processing
    const buffer = Buffer.from(await resumeFile.arrayBuffer());

    console.log('📄 File converted to buffer, size:', buffer.length, 'bytes');

    // Extract candidate info using OpenAI native PDF processing
    let completion;
    let candidateInfo;

    try {
      // Use OpenAI's native PDF processing with Files API (2025 feature)
      console.log(
        '📤 Uploading PDF to OpenAI Files API for native processing...',
      );

      const file = await openai.files.create({
        file: new File([buffer], resumeFile.name, { type: 'application/pdf' }),
        purpose: 'assistants',
      });

      console.log('✅ File uploaded successfully:', file.id);

      completion = await openai.chat.completions.create({
        model: 'gpt-4o', // Use gpt-4o for native PDF support
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
    } catch (fileError: any) {
      console.warn(
        '⚠️ OpenAI Files API failed, falling back to advanced text extraction:',
        fileError.message,
      );

      // Fallback to advanced text extraction (same as candidate creation)
      console.log('📄 Attempting advanced PDF text extraction...');

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
        extractedText += phones.filter((p) => /\d{3,}/.test(p)).join(' ') + ' ';
      }

      // Method 4: Extract words from PDF objects
      const wordRegex = /\b[A-Za-z]{2,}\b/g;
      const words = binaryString.match(wordRegex);
      if (words) {
        const meaningfulWords = words.filter(
          (word) =>
            word.length > 2 &&
            word.length < 50 &&
            !/^(obj|endobj|stream|endstream|xref|trailer|startxref|PDF)$/i.test(
              word,
            ),
        );
        extractedText += meaningfulWords.slice(0, 100).join(' ') + ' ';
      }

      // Clean and normalize text
      extractedText = extractedText
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s@._-]/g, ' ')
        .trim();

      console.log('📄 Extracted text sample:', extractedText.substring(0, 300));

      // Check if extraction was successful enough
      const hasEmail = /@/.test(extractedText);
      const hasWords =
        extractedText.split(' ').filter((w) => w.length > 2).length > 5;

      if (!hasEmail && !hasWords) {
        console.log('❌ Text extraction failed completely');
        return NextResponse.json(
          {
            error:
              'Unable to automatically extract information from this PDF. Please use the manual "Create Candidate" option instead.',
            suggestion:
              'The PDF format is not compatible with automatic extraction. You can manually create the candidate by entering the information yourself.',
            fileName: resumeFile.name,
          },
          { status: 400 },
        );
      }

      // Use GPT-4o-mini with extracted text
      completion = await openai.chat.completions.create({
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
    }

    const raw = completion.choices[0]?.message?.content ?? '{}';
    console.log('🤖 AI response:', raw);
    const candidateInfo = JSON.parse(raw);

    if (
      !candidateInfo.firstName ||
      !candidateInfo.lastName ||
      !candidateInfo.email
    ) {
      console.log('❌ Missing fields:', candidateInfo);
      return NextResponse.json(
        {
          error: 'Could not extract required information',
          aiResponse: candidateInfo,
          hint: 'Make sure the PDF contains clear contact information',
        },
        { status: 400 },
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
      extractedInfo: candidateInfo,
    });
  } catch (err: any) {
    console.error('💥 Error:', err);
    return NextResponse.json(
      { error: 'Failed to create candidate', details: err.message },
      { status: 500 },
    );
  }
}
