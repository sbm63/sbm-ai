// app/api/candidates/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '@/lib/dynamo'; // your shared DynamoDBDocumentClient

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: process.env.CANDIDATE_TABLE_NAME!,
        Key: { candidateId: params.id },
      }),
    );

    if (!result.Item) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 },
      );
    }

    // result.Item is already plain JS
    return NextResponse.json({ candidate: result.Item });
  } catch (err) {
    console.error('[GET_CANDIDATE]', err);
    return NextResponse.json(
      { error: 'Failed to fetch candidate' },
      { status: 500 },
    );
  }
}
