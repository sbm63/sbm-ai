// app/api/report/[candidateId]/route.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '@/lib/dynamo';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type QA = { question: string; answer: string };
type Feedback = {
  overall_score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  hire_recommendation: 'YES' | 'NO' | 'MAYBE';
  per_question: {
    question: string;
    answer: string;
    score: number;
    comment: string;
  }[];
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { candidateId: string } },
) {
  const { candidateId } = params;
  if (!candidateId) {
    return NextResponse.json(
      { error: 'Missing candidateId in path' },
      { status: 400 },
    );
  }

  try {
    // 1️⃣ Try to fetch existing report
    const rep = await docClient.send(
      new GetCommand({
        TableName: process.env.REPORTS_TABLE!,
        Key: { candidateId },
      }),
    );

    if (rep.Item?.feedback) {
      return NextResponse.json(rep.Item.feedback as Feedback);
    }

    // 2️⃣ No report yet → fetch stored Q&A
    const qaRes = await docClient.send(
      new GetCommand({
        TableName: process.env.RESPONSE_TABLE_NAME!,
        Key: { candidateId },
        ProjectionExpression: 'qa',
      }),
    );
    const qa: QA[] = qaRes.Item?.qa;
    if (!qa || !Array.isArray(qa) || qa.length === 0) {
      return NextResponse.json(
        { error: 'No stored responses for this candidate' },
        { status: 404 },
      );
    }

    // 3️⃣ Build and send prompt to OpenAI
    const system = `
You are a strict technical interviewer evaluating a candidate.
Return ONLY valid JSON—no extra text.
    `.trim();

    const user = `
Role: ${rep.Item?.role ?? 'Unknown Role'}
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
    const feedback = JSON.parse(raw) as Feedback;

    // 4️⃣ Persist new report
    await docClient.send(
      new PutCommand({
        TableName: process.env.REPORTS_TABLE!,
        Item: {
          candidateId,
          feedback,
          createdAt: new Date().toISOString(),
        },
      }),
    );

    // 5️⃣ Return freshly generated feedback
    return NextResponse.json(feedback);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: 'Failed to fetch or generate report' },
      { status: 500 },
    );
  }
}
