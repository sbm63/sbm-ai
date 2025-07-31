// app/api/create-job/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ScanCommand } from '@aws-sdk/client-dynamodb';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { docClient } from '@/lib/dynamo';

export async function GET() {
  try {
    const result = await docClient.send(
      new ScanCommand({ TableName: process.env.JOB_TABLE_NAME! }),
    );
    // result.Items is already plain JS objects thanks to DynamoDBDocumentClient
    const jobs = (result.Items ?? []).map((item) => unmarshall(item));

    // wrap it in the same shape you’re saving
    return NextResponse.json({ jobs });
  } catch (err) {
    console.error('[GET_JOBS]', err);
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, department, location, type, salary, description } = body;

    if (!title || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    const item = {
      jobId: crypto.randomUUID(),
      title,
      department,
      location,
      type,
      salary,
      description,
      createdAt: new Date().toISOString(),
    };

    await docClient.send(
      new PutCommand({
        TableName: process.env.JOB_TABLE_NAME!,
        Item: item,
      }),
    );

    return NextResponse.json({ success: true, jobId: item.jobId });
  } catch (error) {
    console.error('[CREATE_JOB_API]', error);
    return NextResponse.json(
      { error: 'Failed to create job' },
      { status: 500 },
    );
  }
}
