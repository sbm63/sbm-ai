// app/api/candidates/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ScanCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '@/lib/dynamo';
import { Buffer } from 'buffer';

// GET /api/candidates → list all
export async function GET() {
  try {
    const { Items } = await docClient.send(
      new ScanCommand({ TableName: process.env.CANDIDATE_TABLE_NAME! }),
    );
    return NextResponse.json({ candidates: Items ?? [] });
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
        { error: 'firstName, lastName, email and a PDF file are required' },
        { status: 400 },
      );
    }

    // convert file to base64 string
    const arrayBuffer = await resumeFile.arrayBuffer();
    const resumeBase64 = Buffer.from(arrayBuffer).toString('base64');

    const item = {
      candidateId: crypto.randomUUID(),
      firstName,
      lastName,
      email,
      phone,
      resume: resumeBase64,
      resumeFileName: resumeFile.name,
      createdAt: new Date().toISOString(),
    };

    await docClient.send(
      new PutCommand({
        TableName: process.env.CANDIDATE_TABLE_NAME!,
        Item: item,
      }),
    );

    return NextResponse.json({ success: true, candidate: item });
  } catch (err) {
    console.error('[CREATE_CANDIDATE]', err);
    return NextResponse.json(
      { error: 'Failed to create candidate' },
      { status: 500 },
    );
  }
}
