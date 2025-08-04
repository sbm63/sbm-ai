// app/api/candidates/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { Buffer } from 'buffer';

const sql = neon(process.env.NEON_DATABASE_URL!);

// GET /api/candidates → list all (unchanged)
export async function GET() {
  console.log('[GET_CANDIDATES] connecting to', process.env.NEON_DATABASE_URL);
  try {
    const { rows: candidates } = await sql`
      SELECT
        id,
        first_name        AS "firstName",
        last_name         AS "lastName",
        email,
        phone,
        resume_file_name  AS "resumeFileName",
        resume            AS "resumeBase64",
        created_at        AS "createdAt"
      FROM candidates;
    `;
    console.log('[GET_CANDIDATES] found rows:', candidates.length);
    return NextResponse.json({ candidates });
  } catch (err) {
    console.error('[GET_CANDIDATES]', err);
    return NextResponse.json(
      { error: 'Failed to fetch candidates' },
      { status: 500 }
    );
  }
}

// POST /api/candidates → create one (multipart/form-data)
export async function POST(req: NextRequest) {
  try {
    const formData   = await req.formData();
    const firstName  = formData.get('firstName') as string;
    const lastName   = formData.get('lastName')  as string;
    const email      = formData.get('email')     as string;
    const phone      = (formData.get('phone')    as string) || '';
    const resumeFile = formData.get('resume');

    if (
      !firstName ||
      !lastName  ||
      !email     ||
      !(resumeFile instanceof File)
    ) {
      return NextResponse.json(
        { error: 'firstName, lastName, email and a PDF file are required' },
        { status: 400 }
      );
    }

    // ensure table exists
 
    // convert file to base64
    const buffer        = Buffer.from(await resumeFile.arrayBuffer());
    const resumeBase64  = buffer.toString('base64');
    const resumeName    = resumeFile.name;

    // perform insert
    const result = await sql`
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
        first_name        AS "firstName",
        last_name         AS "lastName",
        email,
        phone,
        resume            AS "resumeBase64",
        resume_file_name  AS "resumeFileName",
        created_at        AS "createdAt";
    `;

 
    return NextResponse.json({ success: true, candidate: result });
  } catch (err) {
    console.error('[CREATE_CANDIDATE]', err);
    return NextResponse.json({ error: 'Failed to create candidate' }, { status: 500 });
  }
}
