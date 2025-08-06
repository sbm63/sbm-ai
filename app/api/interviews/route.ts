// app/api/interviews/route.ts


import { NextRequest, NextResponse } from 'next/server'
import { db } from '@vercel/postgres'

export async function POST(req: NextRequest) {
  const { candidateId, userResponse } = (await req.json()) as {
    candidateId: string
    userResponse: { question: string; answer: string }[]
  }

  try {
    // 1) Ensure table exists, with a UNIQUE constraint on candidate_id
    await db.sql`
      CREATE TABLE IF NOT EXISTS interviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        candidate_id UUID NOT NULL REFERENCES candidates(id),
        responses JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(candidate_id)
      );
    `

    // 2) Upsert: insert or update by candidate_id
    const { rows } = await db.sql`
      INSERT INTO interviews (candidate_id, responses)
      VALUES (
        ${candidateId},
        ${JSON.stringify(userResponse)}::jsonb
      )
      ON CONFLICT (candidate_id) DO UPDATE
      SET
        responses = EXCLUDED.responses,
        updated_at = now()
      RETURNING
        id,
        candidate_id      AS "candidateId",
        responses         AS "userResponse",
        created_at        AS "createdAt",
        updated_at        AS "updatedAt";
    `

    const interview = rows[0]
    return NextResponse.json({ interview }, { status: 200 })
  } catch (err) {
    console.error('[UPSERT_INTERVIEW]', err)
    return NextResponse.json(
      { error: 'Failed to save or update interview' },
      { status: 500 }
    )
  }
}
