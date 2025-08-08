// app/api/interviews/[candidateId]/feedback/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@vercel/postgres';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id: candidateId } = params;

  try {
    // 1) Load stored responses from candidates table
    const { rows } = await db.sql`
      SELECT responses
      FROM candidates
      WHERE id = ${candidateId}
    `;
    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 },
      );
    }
    const responses = rows[0].responses;

    // 2) Call OpenAI to generate feedback
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: [
            'You are a seasoned technical interviewer.',
            'Given a candidate’s Q&A, produce ONLY valid JSON with these keys:',
            '- overall_score (0–100)',
            '- summary (short paragraph)',
            '- strengths (array of strings)',
            '- improvements (array of strings)',
            '- hire_recommendation ("YES"|"NO"|"MAYBE")',
            '- per_question (array of objects with question, answer, score (0–10), comment)',
          ].join(' '),
        },
        {
          role: 'user',
          content: `Interview responses:\n${JSON.stringify(
            responses,
            null,
            2,
          )}`,
        },
      ],
    });

    // 3) Strip any ``` fences and parse JSON
    let raw = completion.choices[0]?.message?.content ?? '';
    raw = raw
      .trim()
      .replace(/^```(?:json)?\s*/, '')
      .replace(/```$/, '');

    let report;
    try {
      report = JSON.parse(raw);
    } catch (err) {
      console.error('[PARSE_ERROR]', err, 'raw=', raw);
      return NextResponse.json(
        { error: 'Failed to parse AI response as JSON' },
        { status: 500 },
      );
    }

    // 4) Return the report
    return NextResponse.json({ report });
  } catch (err) {
    console.error('[GENERATE_FEEDBACK]', err);
    return NextResponse.json(
      { error: 'Failed to generate feedback' },
      { status: 500 },
    );
  }
}
