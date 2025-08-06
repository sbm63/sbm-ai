// app/api/candidates/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@vercel/postgres';
// import pdf from 'pdf-parse';
import OpenAI from 'openai';
// import { Buffer } from 'buffer';

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

    // 2) Decode & parse PDF to plain text
    // const buf = Buffer.from(resumeBase64, 'base64');
    // const { text: resumeText } = await pdf(buf);
    console.log('Resume Text:', resumeBase64);
  
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `You are an expert resume reviewer. Return ONLY valid JSON: { summary, strengths, weaknesses, recommendation }.`,
        },
        { role: 'user', content: `resumeBase64:\n\n${resumeBase64}` },
      ],
      response_format: { type: 'json_object' },
    });


    const raw = completion.choices[0]?.message?.content ?? '{}';
    const feedback = JSON.parse(raw);
    return NextResponse.json({ feedback });

    // return NextResponse.json({ candidate: rows[0] });
  } catch (err) {
    console.error('[GET_CANDIDATE]', err);
    return NextResponse.json(
      { error: 'Failed to fetch candidate' },
      { status: 500 },
    );
  }
}
