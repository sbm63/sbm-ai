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

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const contentType = req.headers.get('content-type');
    let firstName: string, lastName: string, email: string, phone: string, resume: File | null = null;

    if (contentType?.includes('multipart/form-data')) {
      // FormData with potential resume update
      const formData = await req.formData();
      firstName = formData.get('firstName') as string;
      lastName = formData.get('lastName') as string;
      email = formData.get('email') as string;
      phone = (formData.get('phone') as string) || '';
      resume = formData.get('resume') as File;
    } else {
      // JSON without resume update
      const body = await req.json();
      firstName = body.firstName;
      lastName = body.lastName;
      email = body.email;
      phone = body.phone || '';
    }

    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: 'First name, last name, and email are required' },
        { status: 400 },
      );
    }

    // Handle resume processing if provided
    let resumeBase64: string | null = null;
    let resumeFileName: string | null = null;
    
    if (resume && resume.size > 0) {
      const bytes = await resume.arrayBuffer();
      resumeBase64 = Buffer.from(bytes).toString('base64');
      resumeFileName = resume.name;
    }

    const { rows } = await executeWithRetry(async () => {
      if (resumeBase64 && resumeFileName) {
        // Update with new resume
        return db.sql`
          UPDATE candidates
          SET 
            first_name = ${firstName},
            last_name = ${lastName},
            email = ${email},
            phone = ${phone},
            resume = ${resumeBase64},
            resume_file_name = ${resumeFileName}
          WHERE id = ${params.id}
          RETURNING
            id,
            first_name AS "firstName",
            last_name AS "lastName",
            email,
            phone,
            resume_file_name AS "resumeFileName"
        `;
      } else {
        // Update without resume
        return db.sql`
          UPDATE candidates
          SET 
            first_name = ${firstName},
            last_name = ${lastName},
            email = ${email},
            phone = ${phone}
          WHERE id = ${params.id}
          RETURNING
            id,
            first_name AS "firstName",
            last_name AS "lastName",
            email,
            phone,
            resume_file_name AS "resumeFileName"
        `;
      }
    });

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ 
      message: 'Candidate updated successfully',
      candidate: rows[0] 
    });
  } catch (err) {
    console.error('[UPDATE_CANDIDATE]', err);
    return NextResponse.json(
      { error: 'Failed to update candidate' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { rows } = await executeWithRetry(async () => {
      return db.sql`
        DELETE FROM candidates
        WHERE id = ${params.id}
        RETURNING id, first_name, last_name
      `;
    });

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ 
      message: 'Candidate deleted successfully',
      deletedCandidate: rows[0] 
    });
  } catch (err) {
    console.error('[DELETE_CANDIDATE]', err);
    return NextResponse.json(
      { error: 'Failed to delete candidate' },
      { status: 500 },
    );
  }
}
