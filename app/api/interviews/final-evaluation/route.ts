import { NextRequest, NextResponse } from 'next/server';
import { db } from '@vercel/postgres';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const candidateId = searchParams.get('candidateId');
  
  if (!candidateId) {
    return NextResponse.json({ error: 'candidateId is required' }, { status: 400 });
  }

  try {
    const { rows } = await db.sql`
      SELECT evaluation FROM interview_evaluations WHERE candidate_id = ${candidateId};
    `;

    if (rows.length === 0) {
      return NextResponse.json({ evaluation: null }, { status: 200 });
    }

    return NextResponse.json({ evaluation: rows[0].evaluation }, { status: 200 });
  } catch (error) {
    console.error('[GET_FINAL_EVALUATION_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to retrieve final evaluation' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { candidateId } = await req.json();

    // Get interview responses
    const { rows: interviewRows } = await db.sql`
      SELECT responses FROM interviews WHERE candidate_id = ${candidateId};
    `;
    
    if (interviewRows.length === 0) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }

    const responses = interviewRows[0].responses;

    // Get candidate info for context
    const { rows: candidateRows } = await db.sql`
      SELECT first_name, last_name, email FROM candidates WHERE id = ${candidateId};
    `;

    const candidate = candidateRows[0];

    // Generate comprehensive final evaluation
    const finalEvaluationResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `You are an expert HR manager providing a comprehensive final interview evaluation.
          
          Analyze the complete interview session and provide detailed feedback.
          
          Return ONLY valid JSON with this exact structure:
          {
            "overallScore": 1-10,
            "recommendation": "hire|maybe|reject",
            "summary": "Comprehensive summary of the candidate's performance",
            "detailedFeedback": {
              "strengths": ["List of key strengths demonstrated"],
              "weaknesses": ["Areas needing improvement"],
              "technicalSkills": ["Technical competencies observed"],
              "communicationSkills": "Assessment of communication abilities",
              "problemSolving": "Problem-solving approach evaluation"
            },
            "nextSteps": "Recommended next steps in the hiring process",
            "improvementAreas": ["Specific areas for candidate development"],
            "standoutMoments": ["Notable highlights from the interview"]
          }`
        },
        {
          role: 'user',
          content: `Candidate: ${candidate.first_name} ${candidate.last_name}
          
Complete Interview Transcript:
${responses.map((qa: any, idx: number) => 
  `Q${idx + 1}: ${qa.question}
A${idx + 1}: ${qa.answer}
Individual Score: ${qa.evaluation?.score || 'N/A'}/10
Feedback: ${qa.evaluation?.feedback || 'No feedback'}

`).join('')}

Please provide a comprehensive final evaluation of this interview.`
        }
      ],
      response_format: { type: 'json_object' }
    });

    const finalEvaluationText = finalEvaluationResponse.choices[0]?.message?.content || '{}';
    let finalEvaluation;
    
    try {
      finalEvaluation = JSON.parse(finalEvaluationText);
    } catch (e) {
      console.error('Failed to parse final evaluation:', e);
      // Fallback evaluation
      const scores = responses.map((qa: any) => qa.evaluation?.score || 5);
      const avgScore = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
      
      finalEvaluation = {
        overallScore: Math.round(avgScore * 10) / 10,
        recommendation: avgScore >= 7 ? 'hire' : avgScore >= 5 ? 'maybe' : 'reject',
        summary: 'Interview completed successfully. Detailed analysis available.',
        detailedFeedback: {
          strengths: ['Participated in interview'],
          weaknesses: ['Areas for improvement identified'],
          technicalSkills: ['Technical assessment completed'],
          communicationSkills: 'Communication assessed during interview',
          problemSolving: 'Problem-solving approach observed'
        },
        nextSteps: 'Review with hiring team',
        improvementAreas: ['Continue professional development'],
        standoutMoments: ['Engaged throughout interview process']
      };
    }

    // Store final evaluation
    await db.sql`
      CREATE TABLE IF NOT EXISTS interview_evaluations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        candidate_id UUID NOT NULL REFERENCES candidates(id),
        evaluation JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(candidate_id)
      );
    `;

    await db.sql`
      INSERT INTO interview_evaluations (candidate_id, evaluation)
      VALUES (
        ${candidateId},
        ${JSON.stringify(finalEvaluation)}::jsonb
      )
      ON CONFLICT (candidate_id) DO UPDATE
      SET
        evaluation = EXCLUDED.evaluation,
        created_at = now();
    `;

    return NextResponse.json({
      success: true,
      evaluation: finalEvaluation,
      interviewStats: {
        totalQuestions: responses.length,
        averageScore: responses.reduce((acc: number, qa: any) => 
          acc + (qa.evaluation?.score || 5), 0) / responses.length,
        completionTime: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[FINAL_EVALUATION_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to generate final evaluation' },
      { status: 500 }
    );
  }
}