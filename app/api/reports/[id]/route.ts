// app/api/interviews/[candidateId]/report/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@vercel/postgres';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id: candidateId } = params;
  console.log(candidateId);
  try {
    // 1) Load stored responses
    const { rows } = await db.sql`
      SELECT responses
      FROM interviews
      WHERE candidate_id = ${candidateId}
    `;
    console.log(JSON.stringify(rows));
    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Interview not found' },
        { status: 404 },
      );
    }

    // 2) Return the saved responses directly
    const responses = rows[0].responses;
    return NextResponse.json({ report: responses });
  } catch (err) {
    console.error('[FETCH_REPORT]', err);
    return NextResponse.json(
      { error: 'Failed to fetch report' },
      { status: 500 },
    );
  }
}
