// app/api/create-job/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@vercel/postgres';
import { executeWithRetry } from '@/lib/db-retry';

// Ensure the `jobs` table exists (you can remove this after your first deploy)
async function ensureTable() {
  await executeWithRetry(async () => {
    // pgcrypto gives us gen_random_uuid()
    await db.sql`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
    `;
    await db.sql`
      CREATE TABLE IF NOT EXISTS jobs (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title        TEXT NOT NULL,
        department   TEXT,
        location     TEXT,
        type         TEXT,
        salary       TEXT,
        description  TEXT NOT NULL,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;
  });
}

export async function GET() {
  try {
    await ensureTable();

    const { rows: jobs } = await executeWithRetry(
      () =>
        db.sql`
        SELECT
          id,
          title,
          department,
          location,
          type,
          salary,
          description,
          created_at AS "createdAt"
        FROM jobs
        ORDER BY created_at DESC;
      `,
    );

    return NextResponse.json({ jobs });
  } catch (err) {
    console.error('[GET_JOBS]', err);
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { title, department, location, type, salary, description } =
      await req.json();

    if (!title || !description) {
      return NextResponse.json(
        {
          error: 'Missing required fields: title and description are required',
        },
        { status: 400 },
      );
    }

    await ensureTable();

    const { rows } = await executeWithRetry(
      () =>
        db.sql`
        INSERT INTO jobs (
          title, department, location, type, salary, description
        ) VALUES (
          ${title},
          ${department},
          ${location},
          ${type},
          ${salary},
          ${description}
        )
        RETURNING id;
      `,
    );

    const jobId = rows[0]?.id;

    return NextResponse.json({ success: true, jobId });
  } catch (err) {
    console.error('[CREATE_JOB_API]', err);
    return NextResponse.json(
      { error: 'Failed to create job' },
      { status: 500 },
    );
  }
}
