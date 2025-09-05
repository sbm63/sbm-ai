// app/api/candidates/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@vercel/postgres';
import { executeWithRetry } from '@/lib/db-retry';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // Ensure the table exists and fetch candidate with retry logic
    const { rows } = await executeWithRetry(async () => {
      // Ensure the table exists (optional once migrations are in place)
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

      // Fetch the candidate by ID
      return db.sql`
        SELECT
          id,
          first_name       AS "firstName",
          last_name        AS "lastName",
          email,
          phone,
          resume_file_name AS "resumeFileName",
          resume           AS "resumeBase64",
          created_at       AS "createdAt"
        FROM candidates
        WHERE id = ${params.id};
      `;
    });

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ candidate: rows[0] });
  } catch (err) {
    console.error('[GET_CANDIDATE]', err);
    return NextResponse.json(
      { error: 'Failed to fetch candidate' },
      { status: 500 },
    );
  }
}
