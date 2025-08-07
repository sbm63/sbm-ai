// app/api/login/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@vercel/postgres'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  try {
    // 1) Parse & validate input
    const { email, password } = (await req.json()) as {
      email: string
      password: string
    }
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // 2) Fetch user
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
    `
    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }
    const user = rows[0]

    // 3) Check password (plaintext match)
    if (user.password !== password) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // 4) Generate a simple token (UUID)
    const token = randomUUID()

    // 5) Return token and user info
    const { password: pws, ...userInfo } = user
    console.log(pws)
    return NextResponse.json({ token, user: userInfo })
  } catch (err) {
    console.error('[LOGIN]', err)
    return NextResponse.json(
      { error: 'Failed to login' },
      { status: 500 }
    )
  }
}
