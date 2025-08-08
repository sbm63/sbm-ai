export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@vercel/postgres';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = (await req.json()) as {
      email: string;
      password: string;
    };
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 },
      );
    }

    const { rows } = await db.sql`
      SELECT
        id,
        first_name AS "firstName",
        last_name  AS "lastName",
        email,
        phone,
        password
      FROM users
      WHERE email = ${email}
    `;
    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 },
      );
    }
    const user = rows[0];
    if (user.password !== password) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 },
      );
    }

    const token = randomUUID();
    const { password: pw, ...userInfo } = user;
    console.log(pw);
    // Build response and set cookies
    const res = NextResponse.json({ token, user: userInfo }, { status: 200 });

    // HttpOnly cookies so they’re not readable by client JS
    const opts = {
      httpOnly: true,
      secure: true,
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    };

    res.cookies.set('token', token, opts);
    // Store minimal user info needed for profile
    res.cookies.set('user', JSON.stringify(userInfo), opts);

    return res;
  } catch (err) {
    console.error('[LOGIN]', err);
    return NextResponse.json({ error: 'Failed to login' }, { status: 500 });
  }
}
