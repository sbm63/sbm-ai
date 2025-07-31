// app/api/validate-resume/route.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { Buffer } from 'buffer';
import { docClient } from '@/lib/dynamo';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const candidateId = searchParams.get('candidateId');
    if (!candidateId) {
      return NextResponse.json(
        { valid: false, message: 'Missing candidateId' },
        { status: 400 },
      );
    }

    // Fetch stored candidate resume (base64 PDF/Text)
    const getRes = await docClient.send(
      new GetCommand({
        TableName: process.env.CANDIDATE_TABLE_NAME!,
        Key: { candidateId },
        ProjectionExpression: 'resume',
      }),
    );
    const resumeBase64 = getRes.Item?.resume as string;
    if (!resumeBase64) {
      return NextResponse.json(
        { valid: false, message: 'No resume found for this candidate' },
        { status: 404 },
      );
    }

    // Decode to UTF-8 text (assumes resume stored as text PDF or plain text)
    const resumeText = Buffer.from(resumeBase64, 'base64').toString('utf-8');
    console.log('Resume text:', resumeText);
    // Ask OpenAI to summarize
    const systemPrompt = `You are a helpful assistant that summarizes candidate resumes concisely.`;
    const userPrompt = `Please provide a concise summary (2-3 sentences) of the following resume content:\n\n${resumeText}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const summary =
      completion.choices[0]?.message?.content?.trim() ??
      'No summary generated.';

    return NextResponse.json({ valid: true, summary });
  } catch (err) {
    console.error('[VALIDATE_RESUME]', err);
    return NextResponse.json(
      { valid: false, message: 'Failed to summarize resume' },
      { status: 500 },
    );
  }
}
