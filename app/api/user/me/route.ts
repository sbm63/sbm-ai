import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = cookies();
  const raw = cookieStore.get('user')?.value;
  if (!raw)
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const user = JSON.parse(raw);
    return NextResponse.json(user, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Bad user cookie' }, { status: 400 });
  }
}
