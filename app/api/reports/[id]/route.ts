// app/api/interviews/[candidateId]/report/route.ts


import { NextRequest, NextResponse } from 'next/server'
import { db } from '@vercel/postgres'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id:candidateId } = params

  try {
    // 1) Load stored responses
    const { rows } = await db.sql`
      SELECT responses
      FROM interviews
      WHERE candidate_id = ${candidateId}
    `
    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Interview not found' },
        { status: 404 }
      )
    }
    const responses = rows[0].responses

    // 2) Call OpenAI
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
            '- hire_recommendation ("YES"|"NO"|"MAYBE")'
          ].join(' ')
        },
        {
          role: 'user',
          content: `Interview responses:\n${JSON.stringify(responses, null, 2)}`
        }
      ]
    })

    // 3) Clean up any ``` fences before parsing
    let raw = completion.choices[0]?.message?.content ?? ''
    raw = raw.trim()
      .replace(/^```(?:json)?\s*/, '')   // remove leading ``` or ```json
      .replace(/```$/, '')               // remove trailing ```
    
    let report
    try {
      report = JSON.parse(raw)
    } catch (parseErr) {
      console.error('[PARSE_ERROR]', parseErr, 'raw=', raw)
      return NextResponse.json(
        { error: 'Failed to parse AI response as JSON' },
        { status: 500 }
      )
    }

    return NextResponse.json({ report })
  } catch (err) {
    console.error('[GENERATE_REPORT]', err)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}
