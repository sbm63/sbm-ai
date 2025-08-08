// app/api/candidates/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@vercel/postgres';
import { Buffer } from 'buffer';

// GET /api/candidates → list all
export async function GET() {
  try {
    // create table if needed (optional once created)
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

    const { rows: candidates } = await db.sql`
      SELECT
        id,
        first_name       AS "firstName",
        last_name        AS "lastName",
        email,
        phone,
        resume_file_name AS "resumeFileName",
        resume           AS "resumeBase64",
        created_at       AS "createdAt"
      FROM candidates;
    `;

    return NextResponse.json({ candidates });
  } catch (err) {
    console.error('[GET_CANDIDATES]', err);
    return NextResponse.json(
      { error: 'Failed to fetch candidates' },
      { status: 500 },
    );
  }
}

// POST /api/candidates → create one (multipart/form-data)
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const email = formData.get('email') as string;
    const phone = (formData.get('phone') as string) || '';
    const resumeFile = formData.get('resume');

    if (!firstName || !lastName || !email || !(resumeFile instanceof File)) {
      return NextResponse.json(
        { error: 'firstName, lastName, email and a file are required' },
        { status: 400 },
      );
    }

    // convert file to base64
    const buffer = Buffer.from(await resumeFile.arrayBuffer());
    const resumeBase64 = buffer.toString('base64');
    const resumeName = resumeFile.name;

    const { rows } = await db.sql`
      INSERT INTO candidates (
        first_name, last_name, email, phone, resume, resume_file_name
      ) VALUES (
        ${firstName},
        ${lastName},
        ${email},
        ${phone},
        ${resumeBase64},
        ${resumeName}
      )
      RETURNING
        id,
        first_name       AS "firstName",
        last_name        AS "lastName",
        email,
        phone,
        resume           AS "resumeBase64",
        resume_file_name AS "resumeFileName",
        created_at       AS "createdAt";
    `;

    return NextResponse.json({ success: true, candidate: rows[0] });
  } catch (err) {
    console.error('[CREATE_CANDIDATE]', err);
    return NextResponse.json(
      { error: 'Failed to create candidate' },
      { status: 500 },
    );
  }
}
