// app/api/jobs/[jobId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@vercel/postgres';
import { executeWithRetry } from '@/lib/db-retry';

async function ensureColumn() {
  await executeWithRetry(
    () => db.sql`CREATE EXTENSION IF NOT EXISTS pgcrypto;`,
  );
  await executeWithRetry(
    () => db.sql`
    ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS questions JSONB NOT NULL DEFAULT '[]'::jsonb;
  `,
  );
}

type QItem = { question: string; expectedAnswer?: string };

function cleanQuestions(input: unknown): QItem[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: QItem[] = [];
  for (const it of input) {
    const q = (it?.question ?? '').toString().trim();
    if (!q) continue;
    const key = q.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      question: q,
      expectedAnswer: (it?.expectedAnswer ?? '').toString(),
    });
  }
  return out;
}

function mergeQuestions(existing: QItem[], incoming: QItem[]) {
  const map = new Map<string, QItem>();
  for (const it of existing) map.set(it.question.toLowerCase(), it);
  for (const it of incoming) map.set(it.question.toLowerCase(), it); // overwrite expectedAnswer on dup
  return Array.from(map.values());
}

// GET /api/jobs/[jobId] -> single job with questions
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  console.log(params.id);
  try {
    await ensureColumn();
    const { rows } = await executeWithRetry(
      () => db.sql`
      SELECT id, title, department, location, type, salary, description,
             created_at AS "createdAt", questions
      FROM jobs
      WHERE id = ${params.id}
      LIMIT 1;
    `,
    );
    if (!rows.length)
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('[GET_JOB]', err);
    return NextResponse.json({ error: 'Failed to fetch job' }, { status: 500 });
  }
}

// PATCH /api/jobs/[jobId]
// Body:
// {
//   "title?": "...",
//   "department?": "...",
//   "location?": "...",
//   "type?": "...",
//   "salary?": "...",
//   "description?": "...",
//   "questions?": [{ "question": "...", "expectedAnswer": "..." }],
//   "questionMode?": "append" | "replace"   // default: "append"
// }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const jobId = params.id;

  try {
    await ensureColumn();
    const body = await req.json().catch(() => ({}));
    const {
      title,
      department,
      location,
      type,
      salary,
      description,
      questions,
      questionMode,
    } = body || {};

    // verify job + get current questions
    const { rows: currentRows } = await executeWithRetry(
      () => db.sql`
      SELECT questions FROM jobs WHERE id = ${jobId} LIMIT 1;
    `,
    );
    if (!currentRows.length) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    let finalQuestions: QItem[] | undefined;
    if (Array.isArray(questions)) {
      const clean = cleanQuestions(questions);
      if ((questionMode ?? 'append') === 'replace') {
        finalQuestions = clean;
      } else {
        finalQuestions = mergeQuestions(currentRows[0].questions ?? [], clean);
      }
    }

    // Use COALESCE so undefined fields don't overwrite
    const qJson = finalQuestions ? JSON.stringify(finalQuestions) : null;

    await executeWithRetry(
      () => db.sql`
      UPDATE jobs
      SET
        title       = COALESCE(${title}, title),
        department  = COALESCE(${department}, department),
        location    = COALESCE(${location}, location),
        type        = COALESCE(${type}, type),
        salary      = COALESCE(${salary}, salary),
        description = COALESCE(${description}, description),
        questions   = COALESCE(${qJson}::jsonb, questions)
      WHERE id = ${jobId};
    `,
    );

    const { rows } = await executeWithRetry(
      () => db.sql`
      SELECT id, title, department, location, type, salary, description,
             created_at AS "createdAt", questions
      FROM jobs
      WHERE id = ${jobId}
      LIMIT 1;
    `,
    );
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('[PATCH_JOB]', err);
    return NextResponse.json(
      { error: 'Failed to update job' },
      { status: 500 },
    );
  }
}

// PUT /api/job-profiles/[id] - Update job profile
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json();
    const { title, department, location, type, salary, description } = body;

    if (!title || !department || !location || !type || !salary) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 },
      );
    }

    const { rows } = await executeWithRetry(() => {
      return db.sql`
        UPDATE jobs
        SET 
          title = ${title},
          department = ${department},
          location = ${location},
          type = ${type},
          salary = ${salary},
          description = ${description || ''}
        WHERE id = ${params.id}
        RETURNING
          id,
          title,
          department,
          location,
          type,
          salary,
          description
      `;
    });

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Job profile not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ 
      message: 'Job profile updated successfully',
      job: rows[0] 
    });
  } catch (err) {
    console.error('[UPDATE_JOB_PROFILE]', err);
    return NextResponse.json(
      { error: 'Failed to update job profile' },
      { status: 500 },
    );
  }
}

// DELETE /api/job-profiles/[id] - Delete job profile
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { rows } = await executeWithRetry(() => {
      return db.sql`
        DELETE FROM jobs
        WHERE id = ${params.id}
        RETURNING id, title
      `;
    });

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Job profile not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ 
      message: 'Job profile deleted successfully',
      deletedJob: rows[0] 
    });
  } catch (err) {
    console.error('[DELETE_JOB_PROFILE]', err);
    return NextResponse.json(
      { error: 'Failed to delete job profile' },
      { status: 500 },
    );
  }
}
