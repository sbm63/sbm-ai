// app/api/signup/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@vercel/postgres';

export async function POST(req: NextRequest) {
  try {
    // 1) Parse & validate input
    const { firstName, lastName, email, phone, password } =
      (await req.json()) as {
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        password: string;
      };
    if (!firstName || !lastName || !email || !phone || !password) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 },
      );
    }

    // 2) Ensure users table exists
    await db.sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        first_name TEXT NOT NULL,
        last_name  TEXT NOT NULL,
        email      TEXT NOT NULL UNIQUE,
        phone      TEXT NOT NULL,
        password   TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `;

    // 3) Insert new user
    const { rows } = await db.sql`
      INSERT INTO users (first_name, last_name, email, phone, password)
      VALUES (
        ${firstName},
        ${lastName},
        ${email},
        ${phone},
        ${password}
      )
      RETURNING
        id,
        first_name  AS "firstName",
        last_name   AS "lastName",
        email,
        phone,
        created_at  AS "createdAt";
    `;

    const user = rows[0];
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    console.error('[SIGNUP]', err);
    // Handle duplicate email error
    if ((err as any).message.includes('duplicate key value')) {
      return NextResponse.json(
        { error: 'Email already in use' },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 },
    );
  }
}
