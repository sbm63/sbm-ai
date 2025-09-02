// app/api/start-interview/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@vercel/postgres';
import pdfParse from 'pdf-parse';
import OpenAI from 'openai';
import { Buffer } from 'buffer';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Method 1: Use PDF.co API (free tier available)
async function parsePDFWithAPI(base64Data: string): Promise<string> {
  try {
    const response = await fetch('https://api.pdf.co/v1/pdf/convert/to/text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.PDFCO_API_KEY || 'demo' // You can use 'demo' for testing
      },
      body: JSON.stringify({
        file: `data:application/pdf;base64,${base64Data}`,
        pages: '1-10' // Limit to first 10 pages
      })
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(`PDF.co API error: ${result.message || 'Unknown error'}`);
    }

    if (result.error) {
      throw new Error(`PDF.co API error: ${result.message}`);
    }

    // Get the text from the result URL
    const textResponse = await fetch(result.url);
    const text = await textResponse.text();
    
    return text;
  } catch (error: any) {
    console.error('PDF.co API error:', error.message);
    throw new Error(`PDF API parsing failed: ${error.message}`);
  }
}

// Method 2: Simple PDF text extraction (basic but works for many PDFs)
async function parsePDFSimple(base64Data: string): Promise<string> {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    const pdfString = buffer.toString('latin1'); // Use latin1 for better binary handling
    
    // Look for text objects in PDF
    const textRegex = /\((.*?)\)/g;
    const streamRegex = /stream\s*(.*?)\s*endstream/g;
    
    let extractedText = '';
    let match;
    
    // Extract text from parentheses (direct text objects)
    while ((match = textRegex.exec(pdfString)) !== null) {
      const text = match[1];
      if (text && text.length > 2 && /[a-zA-Z]/.test(text)) {
        extractedText += text + ' ';
      }
    }
    
    // Extract text from streams if direct method didn't work well
    if (extractedText.length < 100) {
      const streamMatches = pdfString.match(streamRegex);
      if (streamMatches) {
        streamMatches.forEach(stream => {
          // Simple decompression attempt - look for readable text
          const content = stream.replace(/^stream\s*/, '').replace(/\s*endstream$/, '');
          const readableMatches = content.match(/[A-Za-z]{3,}/g);
          if (readableMatches) {
            extractedText += readableMatches.join(' ') + ' ';
          }
        });
      }
    }
    
    // Clean up the extracted text
    extractedText = extractedText
      .replace(/[^\x20-\x7E\s]/g, ' ') // Remove non-printable characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    if (extractedText.length < 50) {
      throw new Error('Insufficient readable text extracted from PDF');
    }
    
    return extractedText;
  } catch (error: any) {
    console.error('Simple PDF parsing error:', error.message);
    throw new Error(`Simple PDF parsing failed: ${error.message}`);
  }
}

// Method 3: Traditional pdf-parse library
async function parsePDFWithLibrary(buffer: Buffer): Promise<string> {
  try {
    const pdfData = await pdfParse(buffer);
    return pdfData.text;
  } catch (error: any) {
    console.error('pdf-parse library error:', error.message);
    throw new Error(`pdf-parse library failed: ${error.message}`);
  }
}

// Main PDF parsing function with multiple fallbacks
async function parsePDFSafely(resumeBase64: string): Promise<string> {
  const buffer = Buffer.from(resumeBase64, 'base64');
  
  // Validate it's a PDF
  const pdfHeader = buffer.subarray(0, 8).toString();
  if (!pdfHeader.includes('%PDF')) {
    throw new Error('Invalid PDF format - missing PDF header');
  }
  
  console.log('🔧 Attempting to parse PDF, size:', buffer.length, 'bytes');
  
  // Try method 1: Traditional pdf-parse library first
  try {
    const text = await parsePDFWithLibrary(buffer);
    if (text && text.trim().length > 50) {
      console.log('✅ pdf-parse library successful, extracted', text.length, 'characters');
      return text.trim();
    }
  } catch (error: any) {
    console.log('❌ pdf-parse library failed:', error.message);
  }
  
  // Try method 2: Simple extraction
  try {
    const text = await parsePDFSimple(resumeBase64);
    if (text && text.length > 50) {
      console.log('✅ Simple parsing successful, extracted', text.length, 'characters');
      return text;
    }
  } catch (error: any) {
    console.log('❌ Simple parsing failed:', error.message);
  }

  // Try method 3: External API (most reliable but requires internet)
  try {
    const text = await parsePDFWithAPI(resumeBase64);
    if (text && text.trim().length > 50) {
      console.log('✅ API parsing successful, extracted', text.length, 'characters');
      return text.trim();
    }
  } catch (error: any) {
    console.log('❌ API method failed:', error.message);
  }
  
  // If all methods fail, throw error
  throw new Error('All PDF parsing methods failed. Please try uploading the resume as a text file or try a different PDF format.');
}

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
        // Use the enhanced PDF parsing with multiple fallbacks
        resumeText = await parsePDFSafely(resumeBase64);
      } else {
        // If it's stored as text (from text-create API)
        resumeText = buf.toString('utf8');
      }
      
      console.log('📄 Resume text length:', resumeText.length);
      if (process.env.NODE_ENV === 'development') {
        console.log('📄 First 300 chars:', resumeText.substring(0, 300));
      }
      
    } catch (parseError: any) {
      console.error('❌ Failed to parse resume:', parseError);
      return NextResponse.json(
        { 
          error: 'Failed to extract text from PDF resume',
          details: parseError.message,
          suggestions: [
            'Try uploading the resume as a .txt or .docx file',
            'Ensure the PDF contains selectable text (not just images)',
            'Try a different PDF format or recreate the PDF'
          ]
        },
        { status: 400 }
      );
    }

    // Validate extracted text
    if (!resumeText || resumeText.trim().length < 100) {
      return NextResponse.json(
        { 
          error: 'Resume text is too short or empty after extraction',
          extractedLength: resumeText?.length || 0,
          minRequired: 100,
          suggestion: 'The PDF may contain only images or unreadable text'
        },
        { status: 400 }
      );
    }

    console.log('🤖 Sending to OpenAI for analysis...');

    // Send to OpenAI for analysis
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