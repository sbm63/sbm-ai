// app/api/evaluate-interview/route.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const ddb = DynamoDBDocumentClient.from(ddbClient);

type QA = { question: string; answer: string };

export async function POST(req: NextRequest) {
  try {
    const { candidateId, role } = (await req.json()) as {
      candidateId: string;
      role: string;
    };

    if (!candidateId || !role) {
      return NextResponse.json(
        { error: 'Missing candidateId or role' },
        { status: 400 },
      );
    }

    // 1️⃣ Fetch stored responses
    const getRes = await ddb.send(
      new GetCommand({
        TableName: process.env.DYNAMODB_TABLE_NAME!,
        Key: { candidateId },
        ProjectionExpression: 'qa',
      }),
    );

    const qa: QA[] = getRes.Item?.qa;
    if (!qa || !Array.isArray(qa) || qa.length === 0) {
      return NextResponse.json(
        { error: 'No stored responses for this candidate' },
        { status: 404 },
      );
    }

    // 2️⃣ Build prompts
    const system = `
You are a strict technical interviewer evaluating a candidate.
Return ONLY valid JSON—no extra text.
    `.trim();

    const user = `
Role: ${role}
Candidate ID: ${candidateId}
Q&A:
${JSON.stringify(qa, null, 2)}

Return JSON with:
{
  "overall_score": 0-100,
  "summary": "short paragraph",
  "strengths": ["..."],
  "improvements": ["..."],
  "hire_recommendation": "YES" | "NO" | "MAYBE",
  "per_question": [
    { "question": "...", "answer": "...", "score": 0-10, "comment": "..." }
  ]
}
    `.trim();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const feedback = JSON.parse(raw);

    // 3️⃣ Persist feedback in its own table
    const reportId = crypto.randomUUID();
    await ddb.send(
      new PutCommand({
        TableName: process.env.DYNAMODB_REPORTS_TABLE!,
        Item: {
          reportId,
          candidateId,
          role,
          feedback,
          createdAt: new Date().toISOString(),
        },
      }),
    );

    // 4️⃣ Return reportId + feedback
    return NextResponse.json({ reportId, feedback });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: 'Failed to evaluate interview' },
      { status: 500 },
    );
  }
}
