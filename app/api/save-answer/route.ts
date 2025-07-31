// /app/api/save-answer/route.ts
import { docClient } from '@/lib/dynamo';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const { candidateId, userResponse } = (await request.json()) as {
    candidateId: string;
    userResponse: { question: string; answer: string }[];
  };

  if (!candidateId || !Array.isArray(userResponse)) {
    return NextResponse.json(
      { error: 'Missing candidateId or userResponse array' },
      { status: 400 },
    );
  }

  try {
    const now = new Date().toISOString();
    // overwrite (or create) item with full QA array
    const item = {
      candidateId,
      qa: userResponse,
      updatedAt: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: process.env.REPORTS_TABLE!,
        Item: item,
      }),
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: 'Could not save record' },
      { status: 500 },
    );
  }
}
