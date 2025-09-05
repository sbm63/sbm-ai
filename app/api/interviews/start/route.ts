import { NextRequest, NextResponse } from 'next/server';
import { db } from '@vercel/postgres';
import { executeWithRetry } from '@/lib/db-retry';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const { candidateId, jobProfileId } = await req.json();

    // Get job profile for context
    const { rows: jobRows } = await executeWithRetry(
      () => db.sql`
      SELECT 
        id, title, description, department, location, type, salary, questions,
        created_at AS "createdAt"
      FROM jobs 
      WHERE id = ${jobProfileId};
    `,
    );

    if (jobRows.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const jobProfile = jobRows[0];

    // Get candidate resume for context
    const { rows: candidateRows } = await executeWithRetry(
      () => db.sql`
      SELECT resume FROM candidates WHERE id = ${candidateId};
    `,
    );

    let candidateContext = '';
    if (candidateRows.length > 0 && candidateRows[0].resume) {
      try {
        const resumeBuffer = Buffer.from(candidateRows[0].resume, 'base64');
        const isPDF = resumeBuffer.slice(0, 4).toString() === '%PDF';

        if (!isPDF) {
          candidateContext = resumeBuffer.toString('utf8').substring(0, 1000);
        }
      } catch (e) {
        console.log('Could not extract resume context');
      }
    }

    // Generate initial question using AI
    const initialQuestionResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: `You are starting a technical interview for the position: ${
            jobProfile.title
          }.
          
          Job Description: ${
            jobProfile.description || 'No specific description provided'
          }
          Department: ${jobProfile.department || 'Not specified'}
          Location: ${jobProfile.location || 'Not specified'}
          
          Generate an appropriate opening question for this interview. The question should:
          - Be welcoming but professional
          - Allow the candidate to introduce themselves and their background
          - Be relevant to the job position
          - Set a comfortable tone for the interview
          
          Return ONLY a JSON object with this structure:
          {
            "question": "Your opening interview question here",
            "type": "opening"
          }`,
        },
        {
          role: 'user',
          content: `Job Title: ${jobProfile.title}
          
          ${
            candidateContext
              ? `Brief candidate background: ${candidateContext}`
              : ''
          }
          
          Generate the opening question for this interview.`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const initialQuestionText =
      initialQuestionResponse.choices[0]?.message?.content || '{}';
    let initialQuestion;

    try {
      const questionData = JSON.parse(initialQuestionText);
      initialQuestion = questionData.question;
    } catch (e) {
      console.error('Failed to parse initial question:', e);
      initialQuestion = `Hi! Thank you for joining us today. To get started, could you please tell me about yourself and what interests you about the ${jobProfile.title} position?`;
    }

    // Initialize interview record with empty responses
    await executeWithRetry(
      () => db.sql`
      INSERT INTO interviews (candidate_id, responses)
      VALUES (
        ${candidateId},
        ${JSON.stringify([])}::jsonb
      )
      ON CONFLICT (candidate_id) DO UPDATE
      SET
        responses = '[]'::jsonb,
        updated_at = now();
    `,
    );

    return NextResponse.json({
      initialQuestion,
      customQuestions: jobProfile.questions || [], // Include custom questions from job profile
      maxQuestions: 8,
      jobProfile: {
        title: jobProfile.title,
        description: jobProfile.description,
      },
    });
  } catch (error) {
    console.error('[START_INTERVIEW_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to start AI interview' },
      { status: 500 },
    );
  }
}
