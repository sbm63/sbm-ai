import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ message: "Test API working" });
}

export async function GET() {
  return NextResponse.json({ message: "Test API working" });
}